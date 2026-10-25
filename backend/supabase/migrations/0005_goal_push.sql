-- Lock In: push notifications for shared goals.
--
-- When someone pays into a goal, joins it or leaves it, every other member gets a notification. The one who did
-- it gets none. Members whose trial or subscription ran out only get "left" (they can still see the goal and
-- always leave it; the rest they cannot act on). Someone who switched the alerts off has no token here.
--
--   1. The app registers this phone's Expo push token (register_push_token) when the user turns on
--      "Shared goal alerts"; switching off, signing out and deleting the account remove it.
--   2. Triggers put one row per recipient into app.push_events (only for members who have a token).
--   3. Every minute pg_cron calls the Edge Function send-goal-push, which takes what may go out now
--      (claim_goal_pushes) and sends it through the Expo Push API.
--   4. Against spam: at most ONE notification per person per goal every 10 minutes. Whatever happens in between
--      waits and goes out as one ("Marko added €120 to Summer trip (3 payments)"). Contributions, joins and
--      edits are also limited per user in 0002 (60 / 30 per hour), so the queue cannot grow without bound.
--
-- Apply in the Supabase dashboard: SQL editor -> paste this whole file -> Run (after 0004). Then the cron job in
-- docs/ZASTITA.md (3.9).

-- ---------------------------------------------------------------------------
-- Push tokens: one row per phone. Everyone sees and removes only their own.
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  token      text primary key check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$'),
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now()
);
create index push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
create policy "see your own push tokens" on public.push_tokens for select to authenticated
  using (user_id = auth.uid());
create policy "remove your own push tokens" on public.push_tokens for delete to authenticated
  using (user_id = auth.uid());
revoke all on public.push_tokens from public, anon, authenticated;
grant select (token, platform, created_at), delete on public.push_tokens to authenticated;

insert into app.rate_limits (action, per, app_wide, max_count, message) values
  ('push_token', '1 hour', false, 20, 'You can turn alerts on up to %s times per hour. Try again later.');

-- Saves this phone's token for the signed-in user. A phone that was signed in to another account before moves
-- to this one (the other account stops getting alerts on it). At most 10 phones per person: the oldest goes.
-- No subscription needed: a member whose plan ran out still gets "left".
create function public.register_push_token(token text, platform text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$' then raise exception 'invalid push token' using errcode = '22023'; end if;
  if platform not in ('ios', 'android') then raise exception 'invalid platform' using errcode = '22023'; end if;
  perform app.rate_limit(me, 'push_token');
  delete from public.push_tokens t where t.token = register_push_token.token;
  insert into public.push_tokens (token, user_id, platform) values (register_push_token.token, me, register_push_token.platform);
  delete from public.push_tokens t where t.user_id = me and t.token in (
    select x.token from public.push_tokens x where x.user_id = me order by x.created_at desc offset 10);
end $$;

-- Switching the alerts off or signing out on this phone.
create function public.unregister_push_token(token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from public.push_tokens t where t.token = unregister_push_token.token and t.user_id = auth.uid();
end $$;

revoke all on function public.register_push_token(text, text), public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text), public.unregister_push_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- What is waiting to be sent. The app cannot read or change it.
-- ---------------------------------------------------------------------------
create table app.push_events (
  id         bigint generated always as identity primary key,
  goal_id    uuid not null references public.goals(id) on delete cascade,
  recipient  uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('paid', 'joined', 'left')),
  actor      uuid,           -- no foreign key: the actor may be an account that is being deleted right now
  actor_name text,           -- display name when it happened (NULL: no name -> "Someone")
  amount     numeric(14, 2),
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index push_events_pending on app.push_events (recipient, goal_id) where sent_at is null;
create index push_events_sent on app.push_events (recipient, goal_id, sent_at) where sent_at is not null;
alter table app.push_events enable row level security;
revoke all on app.push_events from public, anon, authenticated;

-- One row for each other member who has alerts on. `skip` are the people who did it (or are it).
create function app.queue_goal_push(gid uuid, kind text, actor uuid, amount numeric, skip uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into app.push_events (goal_id, recipient, kind, actor, actor_name, amount)
  select gid, m.user_id, kind, actor, (select p.display_name from public.profiles p where p.id = actor), amount
    from public.goal_members m
   where m.goal_id = gid
     and m.user_id <> all (skip)
     and exists (select 1 from public.push_tokens t where t.user_id = m.user_id)
     and (kind = 'left' or app.has_access(m.user_id))
     and exists (select 1 from public.goals g where g.id = gid);
end $$;

create function app.push_on_contribution() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform app.queue_goal_push(new.goal_id, 'paid', new.user_id, new.amount, array[new.user_id]);
  return null;
end $$;
create trigger push_on_contribution after insert on public.contributions
  for each row execute function app.push_on_contribution();

-- Joining: whoever added them did it, so neither the new member nor the one who added them gets it.
create function app.push_on_join() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform app.queue_goal_push(new.goal_id, 'joined', new.user_id, null, array[new.user_id, coalesce(new.added_by, new.user_id)]);
  return null;
end $$;
create trigger push_on_join after insert on public.goal_members
  for each row execute function app.push_on_join();

-- Leaving (also when the account is deleted). If it was the last member, the goal is already gone: nothing to send.
create function app.push_on_leave() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform app.queue_goal_push(old.goal_id, 'left', old.user_id, null, array[old.user_id]);
  return null;
end $$;
create trigger push_on_leave after delete on public.goal_members
  for each row execute function app.push_on_leave();

revoke all on function app.queue_goal_push(uuid, text, uuid, numeric, uuid[]), app.push_on_contribution(),
                       app.push_on_join(), app.push_on_leave() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- For the Edge Function (service role only)
-- ---------------------------------------------------------------------------
-- Everything that may go out now: per person and goal, all waiting events, but only if nothing was sent to that
-- person for that goal in the last 10 minutes. They are marked sent here; release_goal_pushes puts them back if
-- the Expo Push API could not be reached. A recipient who left the goal meanwhile gets nothing.
create function public.claim_goal_pushes(max_groups int default 500)
returns table (ids bigint[], recipient uuid, goal_id uuid, goal_name text, currency text, events jsonb, tokens text[])
language plpgsql security definer set search_path = public as $$
declare g record;
begin
  perform pg_advisory_xact_lock(hashtextextended('claim_goal_pushes', 0));
  delete from app.push_events e where e.sent_at < now() - interval '1 day';
  for g in
    select e.recipient as r, e.goal_id as gid from app.push_events e
     where e.sent_at is null
       and not exists (select 1 from app.push_events s where s.recipient = e.recipient and s.goal_id = e.goal_id
                          and s.sent_at > now() - interval '10 minutes')
     group by e.recipient, e.goal_id
     order by min(e.id)
     limit max_groups
  loop
    recipient := g.r;
    goal_id := g.gid;
    with done as (
      update app.push_events e set sent_at = now()
       where e.recipient = g.r and e.goal_id = g.gid and e.sent_at is null
      returning e.id, e.kind, e.actor, e.actor_name, e.amount
    )
    select array_agg(d.id order by d.id),
           jsonb_agg(jsonb_build_object('kind', d.kind, 'actor', d.actor, 'actor_name', d.actor_name, 'amount', d.amount) order by d.id)
      into ids, events from done d;
    select x.name, x.currency into goal_name, currency from public.goals x where x.id = g.gid;
    select array_agg(t.token order by t.created_at) into tokens from public.push_tokens t where t.user_id = g.r;
    if tokens is not null and app.is_member(g.gid, g.r) then
      return next;
    end if;
  end loop;
end $$;

-- The Expo Push API was down: these go out on the next run (still at most one per 10 minutes).
create function public.release_goal_pushes(ids bigint[]) returns void
language sql security definer set search_path = public as $$
  update app.push_events set sent_at = null where id = any (ids)
$$;

-- Tokens the Expo Push API says no longer exist (the app was removed).
create function public.drop_push_tokens(tokens text[]) returns void
language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = any (tokens)
$$;

revoke all on function public.claim_goal_pushes(int), public.release_goal_pushes(bigint[]), public.drop_push_tokens(text[])
  from public, anon, authenticated;
grant execute on function public.claim_goal_pushes(int), public.release_goal_pushes(bigint[]), public.drop_push_tokens(text[])
  to service_role;
