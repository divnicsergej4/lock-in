-- Lock In: due date, nudges and pin notifications for shared goals.
--
--   * goals.deadline: an optional due date. Every member can change it, like the name and the target.
--   * Nudge (Andrija, 28 October 2026): a member reminds another member of the same goal with a push
--     "<name> nudged you: <goal> is waiting on you 👀". At most one nudge from the same person to the same person
--     per goal every 24 hours, never to yourself, needs a trial or subscription. Anyone can switch nudge alerts off
--     (set_nudge_alerts): then no push comes; the nudge still shows in the app ("Luka nudged you"), and the one who
--     nudged is not told that the alerts are off.
--   * Pins: when the goal passes 25, 50 or 75% the other members get "<goal>: the 50% pin clicked", at 100%
--     "<goal> is unlocked 🔓 ...". Same rules as 0005 (not the one who paid, only members with a plan and alerts on,
--     at most one notification per person per goal every 10 minutes, merged).
--   Squad streak, fair share, pace and the pins on screen are worked out in the app from the contributions every
--   member can already see: no new tables for them.
--
-- Apply in the Supabase dashboard: SQL editor -> paste this whole file -> Run (after 0005).

-- ---------------------------------------------------------------------------
-- Due date
-- ---------------------------------------------------------------------------
alter table public.goals add column deadline date
  check (deadline is null or deadline between date '2000-01-01' and date '2100-12-31');
grant update (deadline) on public.goals to authenticated;

drop function public.create_goal(text, numeric, text);
create function public.create_goal(name text, target numeric, currency text, deadline date default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := app.require_access(); gid uuid;
begin
  perform app.rate_limit(me, 'goal_create');
  perform app.lock_user(me);
  if app.goal_count(me) >= 10 then
    perform app.quota_error('You can be in up to 10 shared goals.');
  end if;
  insert into public.goals (name, target, currency, deadline, created_by)
  values (btrim(name), target, upper(currency), create_goal.deadline, me)
  returning id into gid;
  insert into public.goal_members (goal_id, user_id, added_by) values (gid, me, me);
  return gid;
end $$;
revoke all on function public.create_goal(text, numeric, text, date) from public, anon;
grant execute on function public.create_goal(text, numeric, text, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Nudges
-- ---------------------------------------------------------------------------
-- One row per nudge. Both people must be in the goal: when either leaves, their nudges go with them.
create table public.goal_nudges (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null,
  from_user  uuid not null,
  to_user    uuid not null,
  created_at timestamptz not null default now(),
  check (from_user <> to_user),
  foreign key (goal_id, from_user) references public.goal_members (goal_id, user_id) on delete cascade,
  foreign key (goal_id, to_user) references public.goal_members (goal_id, user_id) on delete cascade
);
create index goal_nudges_goal on public.goal_nudges (goal_id, created_at);

alter table public.goal_nudges enable row level security;
create policy "see nudges you sent or got" on public.goal_nudges for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());
revoke all on public.goal_nudges from public, anon, authenticated;
grant select (id, goal_id, from_user, to_user, created_at) on public.goal_nudges to authenticated;

-- Who switched nudge alerts off. Only the functions read it: nobody else can tell.
create table app.nudge_alerts_off (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table app.nudge_alerts_off enable row level security;
revoke all on app.nudge_alerts_off from public, anon, authenticated;

insert into app.rate_limits (action, per, app_wide, max_count, message) values
  ('nudge',      '1 hour', false, 30, 'You can nudge up to %s times per hour. Try again later.'),
  ('nudge_same', '1 day',  false,  1, 'You already nudged them today. Try again tomorrow.');

-- The push queue learns three new kinds; pct is the pin (25, 50, 75) for 'pin'.
alter table app.push_events drop constraint push_events_kind_check;
alter table app.push_events add constraint push_events_kind_check
  check (kind in ('paid', 'joined', 'left', 'nudged', 'pin', 'unlocked'));
alter table app.push_events add column pct int;

create function public.nudge(goal_id uuid, friend_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := app.require_access();
begin
  if friend_id = me then raise exception 'You can''t nudge yourself.' using errcode = '22023'; end if;
  if not app.is_member(nudge.goal_id, me) or not app.is_member(nudge.goal_id, friend_id) then
    raise exception 'goal not found' using errcode = 'P0002';
  end if;
  perform app.rate_limit(me, 'nudge');
  perform app.rate_limit(me, 'nudge_same', nudge.goal_id || ':' || friend_id);
  insert into public.goal_nudges (goal_id, from_user, to_user) values (nudge.goal_id, me, friend_id);
  insert into app.push_events (goal_id, recipient, kind, actor, actor_name)
  select nudge.goal_id, friend_id, 'nudged', me, (select p.display_name from public.profiles p where p.id = me)
   where exists (select 1 from public.push_tokens t where t.user_id = friend_id)
     and not exists (select 1 from app.nudge_alerts_off o where o.user_id = friend_id)
     and app.has_access(friend_id);
end $$;

-- Settings > Account > "Nudges from friends". No plan needed: anyone can always turn alerts off.
create function public.set_nudge_alerts(allowed boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if allowed then delete from app.nudge_alerts_off where user_id = me;
  else insert into app.nudge_alerts_off (user_id) values (me) on conflict do nothing;
  end if;
end $$;

create function public.nudge_alerts() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from app.nudge_alerts_off where user_id = auth.uid())
$$;

revoke all on function public.nudge(uuid, uuid), public.set_nudge_alerts(boolean), public.nudge_alerts() from public, anon;
grant execute on function public.nudge(uuid, uuid), public.set_nudge_alerts(boolean), public.nudge_alerts() to authenticated;

-- ---------------------------------------------------------------------------
-- Pins: a contribution (new, or an amount changed) that takes the goal past 25 / 50 / 75 / 100%
-- ---------------------------------------------------------------------------
create function app.push_on_pin() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tgt    numeric;
  after  numeric;
  before numeric;
  p      int;
begin
  select g.target into tgt from public.goals g where g.id = new.goal_id;
  if tgt is null or tgt <= 0 then return null; end if;
  select coalesce(sum(c.amount), 0) into after from public.contributions c where c.goal_id = new.goal_id;
  before := after - new.amount + (case when tg_op = 'UPDATE' then old.amount else 0 end);
  foreach p in array array[25, 50, 75] loop
    if before < tgt * p / 100 and after >= tgt * p / 100 and after < tgt then
      perform app.queue_goal_push(new.goal_id, 'pin', new.user_id, null, array[new.user_id]);
      update app.push_events e set pct = p
       where e.goal_id = new.goal_id and e.kind = 'pin' and e.pct is null and e.sent_at is null;
    end if;
  end loop;
  if before < tgt and after >= tgt then
    perform app.queue_goal_push(new.goal_id, 'unlocked', new.user_id, null, array[new.user_id]);
  end if;
  return null;
end $$;
create trigger push_on_pin after insert or update of amount on public.contributions
  for each row execute function app.push_on_pin();
revoke all on function app.push_on_pin() from public, anon, authenticated;

-- Same as 0005, plus the pin in each event.
create or replace function public.claim_goal_pushes(max_groups int default 500)
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
      returning e.id, e.kind, e.actor, e.actor_name, e.amount, e.pct
    )
    select array_agg(d.id order by d.id),
           jsonb_agg(jsonb_build_object('kind', d.kind, 'actor', d.actor, 'actor_name', d.actor_name, 'amount', d.amount,
                                        'pct', d.pct) order by d.id)
      into ids, events from done d;
    select x.name, x.currency into goal_name, currency from public.goals x where x.id = g.gid;
    select array_agg(t.token order by t.created_at) into tokens from public.push_tokens t where t.user_id = g.r;
    if tokens is not null and app.is_member(g.gid, g.r) then
      return next;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Live updates: friendships (an accepted invite shows up at once) and nudges
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.friendships, public.goal_nudges;
  end if;
end $$;
