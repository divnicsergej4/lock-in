-- Lock In: protection against abuse and runaway costs
--
--   * Rate limits per user (auth.uid()) on everything the app can write: friend requests, answers, goals,
--     adding people to goals, editing goals, contributions, invite emails.
--   * One app-wide daily cap on invite emails, so a bug or an attacker cannot run up the email bill.
--   * Quotas: at most 10 shared goals per person, 20 people per goal, 200 friends, 50 unanswered invites.
--
-- The server (service role, no user in the token) is never limited.
-- Errors the app can show as they are: rate limits have hint 'rate_limited', quotas have hint 'quota'.
--
-- Apply after 0001: Supabase dashboard -> SQL editor -> paste this whole file -> Run.

-- ---------------------------------------------------------------------------
-- Rate limits
-- ---------------------------------------------------------------------------
-- Every limit is one row. Change a number without a new migration, for example:
--   update app.rate_limits set max_count = 1000 where action = 'invite_email' and app_wide;
create table app.rate_limits (
  action    text not null,
  per       interval not null,
  app_wide  boolean not null default false,  -- true: counts everyone together, false: each user on their own
  max_count int not null check (max_count > 0),
  message   text not null,                   -- %s becomes max_count
  primary key (action, per, app_wide)
);

insert into app.rate_limits (action, per, app_wide, max_count, message) values
  ('friend_request',            '1 hour',  false, 10, 'You can send up to %s friend requests per hour. Try again later.'),
  ('friend_request',            '1 day',   false, 30, 'You can send up to %s friend requests per day. Try again tomorrow.'),
  ('friend_request_same_email', '7 days',  false,  3, 'You can invite the same email up to %s times per week.'),
  ('friend_response',           '1 hour',  false, 30, 'You can answer up to %s friend requests per hour. Try again later.'),
  ('goal_create',               '1 hour',  false, 30, 'You can create up to %s shared goals per hour. Try again later.'),
  ('goal_add_friend',           '1 hour',  false, 30, 'You can add up to %s people to goals per hour. Try again later.'),
  ('goal_edit',                 '1 hour',  false, 60, 'You can edit shared goals up to %s times per hour. Try again later.'),
  ('contribution',              '1 hour',  false, 60, 'You can save up to %s contributions per hour. Try again later.'),
  ('invite_email',              '1 day',   false, 30, 'You can send up to %s invite emails per day. Try again tomorrow.'),
  ('invite_email',              '1 day',   true, 100, 'Invite emails are paused for today. Try again tomorrow.');

-- One row per counted action. Old rows are cleaned up as new ones come in.
create table app.rate_events (
  user_id uuid references auth.users(id) on delete set null,  -- kept (without the user) so app-wide counts stay right
  action  text not null,
  subject text,                                               -- e.g. the invited email, for per-recipient limits
  at      timestamptz not null default now()
);
create index rate_events_user on app.rate_events (user_id, action, at);
create index rate_events_action on app.rate_events (action, at);

-- Counts one more `act` for `uid`, or raises if that would go over any limit for it.
create function app.rate_limit(uid uuid, act text, subj text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  l record;
  n int;
begin
  if uid is null then return; end if;
  -- one request at a time per user and action, so two parallel calls cannot both slip under the limit
  if exists (select 1 from app.rate_limits where action = act and app_wide) then
    perform pg_advisory_xact_lock(hashtextextended('rate:' || act, 0));
  else
    perform pg_advisory_xact_lock(hashtextextended('rate:' || act || ':' || uid, 0));
  end if;
  for l in select * from app.rate_limits where action = act loop
    select count(*) into n from app.rate_events e
     where e.action = act and e.at > now() - l.per
       and (l.app_wide or (e.user_id = uid and e.subject is not distinct from subj));
    if n >= l.max_count then
      raise exception '%', format(l.message, l.max_count) using errcode = 'P0001', hint = 'rate_limited';
    end if;
  end loop;
  insert into app.rate_events (user_id, action, subject) values (uid, act, subj);
  delete from app.rate_events
   where user_id = uid and at < now() - (select max(per) from app.rate_limits) - interval '1 day';
end $$;

-- ---------------------------------------------------------------------------
-- Quotas
-- ---------------------------------------------------------------------------
create function app.quota_error(msg text) returns void
language plpgsql as $$
begin raise exception '%', msg using errcode = 'P0001', hint = 'quota'; end $$;

create function app.lock_user(uid uuid) returns void
language sql as $$ select pg_advisory_xact_lock(hashtextextended('user:' || uid, 0)) $$;

create function app.friend_count(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.friendships where uid in (user_a, user_b)
$$;

create function app.goal_count(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.goal_members where user_id = uid
$$;

-- ---------------------------------------------------------------------------
-- The actions from 0001, same behaviour plus limits and quotas
-- ---------------------------------------------------------------------------
create or replace function public.send_friend_request(email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me     uuid := app.require_access();
  target text := lower(btrim(email));
  them   uuid;
  rid    uuid;
begin
  if target !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email' using errcode = '22023'; end if;
  select id into them from public.profiles where profiles.email = target;
  if them = me then raise exception 'cannot add yourself' using errcode = '22023'; end if;
  if them is not null and app.are_friends(me, them) then raise exception 'already friends' using errcode = '23505'; end if;
  perform app.rate_limit(me, 'friend_request');
  perform app.rate_limit(me, 'friend_request_same_email', target);
  -- they already invited me: accepting is the friendly thing to do
  if them is not null then
    select id into rid from public.friend_requests
     where from_user = them and to_user = me and status = 'pending' limit 1;
    if rid is not null then
      perform public.respond_friend_request(rid, true);
      return rid;
    end if;
  end if;
  perform app.lock_user(me);
  if app.friend_count(me) >= 200 then
    perform app.quota_error('You can have up to 200 friends.');
  end if;
  if (select count(*) from public.friend_requests
       where from_user = me and status = 'pending' and to_email <> target) >= 50 then
    perform app.quota_error('You have 50 invites waiting for an answer. Cancel some or wait for them to answer.');
  end if;
  insert into public.friend_requests (from_user, to_email, to_user) values (me, target, them)
  on conflict (from_user, to_email) where status = 'pending' do update set created_at = now()
  returning id into rid;
  return rid;
end $$;

create or replace function public.respond_friend_request(request_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := app.require_access();
  r  public.friend_requests;
begin
  perform app.rate_limit(me, 'friend_response');
  select * into r from public.friend_requests where id = request_id for update;
  if r.id is null or r.to_user is distinct from me or r.status <> 'pending' then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if accept then
    perform app.lock_user(least(me, r.from_user));
    perform app.lock_user(greatest(me, r.from_user));
    if app.friend_count(me) >= 200 then
      perform app.quota_error('You can have up to 200 friends.');
    end if;
    if app.friend_count(r.from_user) >= 200 then
      perform app.quota_error('They already have 200 friends, the most allowed.');
    end if;
  end if;
  update public.friend_requests set status = case when accept then 'accepted' else 'declined' end, responded_at = now()
   where id = request_id;
  if accept then
    insert into public.friendships (user_a, user_b) values (least(me, r.from_user), greatest(me, r.from_user))
    on conflict do nothing;
  end if;
end $$;

create or replace function public.create_goal(name text, target numeric, currency text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := app.require_access(); gid uuid;
begin
  perform app.rate_limit(me, 'goal_create');
  perform app.lock_user(me);
  if app.goal_count(me) >= 10 then
    perform app.quota_error('You can be in up to 10 shared goals.');
  end if;
  insert into public.goals (name, target, currency, created_by) values (btrim(name), target, upper(currency), me)
  returning id into gid;
  insert into public.goal_members (goal_id, user_id, added_by) values (gid, me, me);
  return gid;
end $$;

-- Any member can bring in any of their own friends.
create or replace function public.add_friend_to_goal(goal_id uuid, friend_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := app.require_access();
begin
  if not app.is_member(goal_id, me) then raise exception 'goal not found' using errcode = 'P0002'; end if;
  if not app.are_friends(me, friend_id) then raise exception 'only friends can be added' using errcode = '42501'; end if;
  if app.is_member(goal_id, friend_id) then return; end if;
  perform app.rate_limit(me, 'goal_add_friend');
  perform 1 from public.goals g where g.id = add_friend_to_goal.goal_id for update;
  perform app.lock_user(friend_id);
  if (select count(*) from public.goal_members m where m.goal_id = add_friend_to_goal.goal_id) >= 20 then
    perform app.quota_error('A shared goal can have up to 20 people.');
  end if;
  if app.goal_count(friend_id) >= 10 then
    perform app.quota_error('Your friend is already in 10 shared goals, the most allowed.');
  end if;
  insert into public.goal_members (goal_id, user_id, added_by) values (goal_id, friend_id, me)
  on conflict do nothing;
end $$;

-- Goals and contributions are written straight to the tables (row level security decides who may),
-- so their limits sit in triggers.
create function app.limit_goal_edit() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform app.rate_limit(auth.uid(), 'goal_edit'); return new; end $$;
create trigger goals_rate_limit before update on public.goals
  for each row execute function app.limit_goal_edit();

create function app.limit_contribution() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform app.rate_limit(auth.uid(), 'contribution'); return new; end $$;
create trigger contributions_rate_limit before insert or update on public.contributions
  for each row execute function app.limit_contribution();

-- ---------------------------------------------------------------------------
-- Invite email: the server function (Edge Function "send-invite-email") calls this with the user's own token
-- right before it sends the email. One email per invite, per-user and app-wide daily limits.
-- ---------------------------------------------------------------------------
alter table public.friend_requests add column emailed_at timestamptz;

create function public.claim_invite_email(request_id uuid) returns table (to_email text, from_name text)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := app.require_access();
  r  public.friend_requests;
begin
  select * into r from public.friend_requests where id = request_id for update;
  if r.id is null or r.from_user <> me or r.status <> 'pending' then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if r.emailed_at is not null and r.emailed_at >= r.created_at then
    raise exception 'invite email already sent' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  perform app.rate_limit(me, 'invite_email');
  update public.friend_requests set emailed_at = now() where id = request_id;
  return query
    select r.to_email, coalesce(nullif(p.display_name, ''), p.email) from public.profiles p where p.id = me;
end $$;

-- ---------------------------------------------------------------------------
-- Privileges: the new tables are for the functions only; the app gets nothing directly
-- ---------------------------------------------------------------------------
alter table app.rate_limits enable row level security;
alter table app.rate_events enable row level security;
revoke all on app.rate_limits, app.rate_events from public, anon, authenticated;

revoke all on function app.rate_limit(uuid, text, text), app.quota_error(text), app.lock_user(uuid),
                       app.friend_count(uuid), app.goal_count(uuid), app.limit_goal_edit(), app.limit_contribution()
  from public, anon, authenticated;

revoke all on function public.claim_invite_email(uuid) from public, anon;
grant execute on function public.claim_invite_email(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Store subscriptions: the RevenueCat webhook (Edge Function "revenuecat-webhook") writes through this.
-- Only the server can call it. Events can arrive late or twice: an older event never overwrites a newer one.
-- ---------------------------------------------------------------------------
create function public.apply_store_event(user_id uuid, active_until timestamptz, product text, event_at timestamptz)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from auth.users u where u.id = apply_store_event.user_id) then return false; end if;
  insert into public.subscriptions as s (user_id, active_until, product, updated_at)
  values (apply_store_event.user_id, apply_store_event.active_until, apply_store_event.product, event_at)
  on conflict on constraint subscriptions_pkey do update
    set active_until = excluded.active_until, product = excluded.product, updated_at = excluded.updated_at
    where s.updated_at <= excluded.updated_at;
  return true;
end $$;
revoke all on function public.apply_store_event(uuid, timestamptz, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_store_event(uuid, timestamptz, text, timestamptz) to service_role;
