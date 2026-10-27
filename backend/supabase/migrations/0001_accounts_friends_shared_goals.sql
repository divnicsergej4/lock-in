-- Lock In: accounts, friends and shared goals
--
-- Rules (from Andrija):
--   * Every user pays (7-day trial, then a subscription). Anything that changes data needs an active trial or subscription.
--   * People connect through "Add a friend": an invite goes to an email address, the other person accepts it.
--   * Friends can be put into a shared goal. Everyone in a goal is equal: there is no owner or admin.
--     Any member can rename the goal, change the target and add their friends.
--   * Leaving a goal deletes that person's contributions. When the last member leaves, the goal is gone.
--   * Personal spending never touches this database: it stays on the phone. Only shared goals live here.
--
-- Apply in the Supabase dashboard: SQL editor -> paste this whole file -> Run.

-- ---------------------------------------------------------------------------
-- Helpers live in their own schema so the public API does not expose them.
-- ---------------------------------------------------------------------------
create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  display_name text not null default '' check (char_length(display_name) <= 40),
  created_at   timestamptz not null default now()
);

-- Mirror of the store subscription, written only by the server (RevenueCat webhook, service role).
-- active_until covers both the free trial and paid periods.
create table public.subscriptions (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  active_until timestamptz not null,
  product      text,
  updated_at   timestamptz not null default now()
);

create table public.friend_requests (
  id           uuid primary key default gen_random_uuid(),
  from_user    uuid not null references auth.users(id) on delete cascade,
  to_email     text not null check (to_email = lower(to_email) and to_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  to_user      uuid references auth.users(id) on delete cascade,  -- filled in as soon as that email has an account
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);
create unique index friend_requests_one_pending on public.friend_requests (from_user, to_email) where status = 'pending';
create index friend_requests_to_user on public.friend_requests (to_user) where status = 'pending';
create index friend_requests_to_email on public.friend_requests (to_email) where status = 'pending';

-- One row per pair of friends, stored with the smaller id first.
create table public.friendships (
  user_a     uuid not null references auth.users(id) on delete cascade,
  user_b     uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_user_b on public.friendships (user_b);

create table public.goals (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  target     numeric(14, 2) not null check (target > 0),
  currency   text not null check (currency ~ '^[A-Z]{3}$'),
  created_by uuid references auth.users(id) on delete set null,  -- for history only, gives no extra rights
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goal_members (
  goal_id   uuid not null references public.goals(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  added_by  uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (goal_id, user_id)
);
create index goal_members_user on public.goal_members (user_id);

-- A contribution belongs to a membership: when the member leaves, the cascade removes their contributions.
create table public.contributions (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null,
  user_id    uuid not null,
  amount     numeric(14, 2) not null check (amount > 0),
  note       text check (char_length(note) <= 80),
  created_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goal_members (goal_id, user_id) on delete cascade
);
create index contributions_goal on public.contributions (goal_id, created_at);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer: they read past row level security)
-- ---------------------------------------------------------------------------
create function app.has_access(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subscriptions s where s.user_id = uid and s.active_until > now())
$$;

create function app.is_member(gid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.goal_members m where m.goal_id = gid and m.user_id = uid)
$$;

create function app.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships f where f.user_a = least(a, b) and f.user_b = greatest(a, b))
$$;

create function app.shares_goal(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.goal_members x join public.goal_members y on y.goal_id = x.goal_id
    where x.user_id = a and y.user_id = b)
$$;

create function app.require_access() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not app.has_access(uid) then raise exception 'subscription required' using errcode = 'P0001', hint = 'no_access'; end if;
  return uid;
end $$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
-- A new account gets a profile, and invites that were sent to its email before it existed find it.
create function app.on_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, lower(new.email));
  update public.friend_requests set to_user = new.id
   where to_user is null and status = 'pending' and to_email = lower(new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.on_new_user();

-- The last member out takes the goal with them.
create function app.on_member_left() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.goal_members where goal_id = old.goal_id) then
    delete from public.goals where id = old.goal_id;
  end if;
  return null;
end $$;
create trigger goal_member_left after delete on public.goal_members
  for each row execute function app.on_member_left();

create function app.touch_goal() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger goals_touch before update on public.goals
  for each row execute function app.touch_goal();

-- ---------------------------------------------------------------------------
-- Actions the app calls (RPC). Each one checks who is calling and that they have access.
-- ---------------------------------------------------------------------------
-- "Add a friend": invite by email. Returns the request id; the email itself is sent by a server function.
create function public.send_friend_request(email text) returns uuid
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
  -- they already invited me: accepting is the friendly thing to do
  if them is not null then
    select id into rid from public.friend_requests
     where from_user = them and to_user = me and status = 'pending' limit 1;
    if rid is not null then
      perform public.respond_friend_request(rid, true);
      return rid;
    end if;
  end if;
  insert into public.friend_requests (from_user, to_email, to_user) values (me, target, them)
  on conflict (from_user, to_email) where status = 'pending' do update set created_at = now()
  returning id into rid;
  return rid;
end $$;

create function public.respond_friend_request(request_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := app.require_access();
  r  public.friend_requests;
begin
  select * into r from public.friend_requests where id = request_id for update;
  if r.id is null or r.to_user is distinct from me or r.status <> 'pending' then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  update public.friend_requests set status = case when accept then 'accepted' else 'declined' end, responded_at = now()
   where id = request_id;
  if accept then
    insert into public.friendships (user_a, user_b) values (least(me, r.from_user), greatest(me, r.from_user))
    on conflict do nothing;
  end if;
end $$;

create function public.create_goal(name text, target numeric, currency text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := app.require_access(); gid uuid;
begin
  insert into public.goals (name, target, currency, created_by) values (btrim(name), target, upper(currency), me)
  returning id into gid;
  insert into public.goal_members (goal_id, user_id, added_by) values (gid, me, me);
  return gid;
end $$;

-- Any member can bring in any of their own friends.
create function public.add_friend_to_goal(goal_id uuid, friend_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := app.require_access();
begin
  if not app.is_member(goal_id, me) then raise exception 'goal not found' using errcode = 'P0002'; end if;
  if not app.are_friends(me, friend_id) then raise exception 'only friends can be added' using errcode = '42501'; end if;
  insert into public.goal_members (goal_id, user_id, added_by) values (goal_id, friend_id, me)
  on conflict do nothing;
end $$;

-- Leaving needs no subscription: anyone can always walk out.
create function public.leave_goal(goal_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from public.goal_members m where m.goal_id = leave_goal.goal_id and m.user_id = me;
end $$;

-- What the app shows on the paywall / settings.
create function public.my_access() returns timestamptz
language sql stable security definer set search_path = public as $$
  select active_until from public.subscriptions where user_id = auth.uid()
$$;

-- Totals per goal, so the app does not have to add up every contribution itself.
create view public.goal_totals with (security_invoker = true) as
  select g.id as goal_id, g.name, g.target, g.currency,
         coalesce(sum(c.amount), 0)::numeric(14, 2) as saved,
         count(distinct m.user_id) as members
    from public.goals g
    left join public.goal_members m on m.goal_id = g.id
    left join public.contributions c on c.goal_id = g.id and c.user_id = m.user_id
   group by g.id;

-- ---------------------------------------------------------------------------
-- Row level security: what each signed-in person may see and change directly
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships     enable row level security;
alter table public.goals           enable row level security;
alter table public.goal_members    enable row level security;
alter table public.contributions   enable row level security;

create policy "see yourself, friends and people you share a goal with" on public.profiles for select to authenticated
  using (id = auth.uid() or app.are_friends(id, auth.uid()) or app.shares_goal(id, auth.uid()));
create policy "edit your own name" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "see your own subscription" on public.subscriptions for select to authenticated
  using (user_id = auth.uid());

create policy "see requests you sent or got" on public.friend_requests for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());
create policy "cancel a request you sent" on public.friend_requests for delete to authenticated
  using (from_user = auth.uid() and status = 'pending');

create policy "see your friendships" on public.friendships for select to authenticated
  using (auth.uid() in (user_a, user_b));
create policy "unfriend" on public.friendships for delete to authenticated
  using (auth.uid() in (user_a, user_b));

create policy "members see their goals" on public.goals for select to authenticated
  using (app.is_member(id, auth.uid()));
create policy "members edit their goals" on public.goals for update to authenticated
  using (app.is_member(id, auth.uid()) and app.has_access(auth.uid()))
  with check (app.is_member(id, auth.uid()));

create policy "members see who is in the goal" on public.goal_members for select to authenticated
  using (app.is_member(goal_id, auth.uid()));
create policy "leave a goal" on public.goal_members for delete to authenticated
  using (user_id = auth.uid());

create policy "members see contributions" on public.contributions for select to authenticated
  using (app.is_member(goal_id, auth.uid()));
create policy "add your own contribution" on public.contributions for insert to authenticated
  with check (user_id = auth.uid() and app.is_member(goal_id, auth.uid()) and app.has_access(auth.uid()));
create policy "change your own contribution" on public.contributions for update to authenticated
  using (user_id = auth.uid() and app.has_access(auth.uid())) with check (user_id = auth.uid());
create policy "delete your own contribution" on public.contributions for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Privileges: start from nothing, then open only what the policies above are for
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.subscriptions, public.friend_requests, public.friendships,
              public.goals, public.goal_members, public.contributions, public.goal_totals from anon, authenticated;
grant select on public.profiles, public.subscriptions, public.friend_requests, public.friendships,
                public.goals, public.goal_members, public.contributions, public.goal_totals to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (name, target, currency) on public.goals to authenticated;
grant insert (goal_id, user_id, amount, note) on public.contributions to authenticated;
grant update (amount, note) on public.contributions to authenticated;
grant delete on public.friend_requests, public.friendships, public.goal_members, public.contributions to authenticated;

revoke all on schema app from public;
grant usage on schema app to authenticated;
revoke all on all functions in schema app from public;
grant execute on function app.has_access(uuid), app.is_member(uuid, uuid), app.are_friends(uuid, uuid),
                          app.shares_goal(uuid, uuid), app.require_access() to authenticated;

revoke all on function public.send_friend_request(text), public.respond_friend_request(uuid, boolean),
                       public.create_goal(text, numeric, text), public.add_friend_to_goal(uuid, uuid),
                       public.leave_goal(uuid), public.my_access() from public, anon;
grant execute on function public.send_friend_request(text), public.respond_friend_request(uuid, boolean),
                          public.create_goal(text, numeric, text), public.add_friend_to_goal(uuid, uuid),
                          public.leave_goal(uuid), public.my_access() to authenticated;

-- ---------------------------------------------------------------------------
-- Live updates: everyone in a goal sees new contributions and members right away
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.goals, public.goal_members, public.contributions, public.friend_requests;
  end if;
end $$;
