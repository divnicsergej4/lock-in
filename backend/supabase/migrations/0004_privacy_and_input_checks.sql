-- Lock In: who sees what, and what the database accepts.
--
-- Who sees what (decided 25 October 2026, the stricter option): an email address is seen by nobody but its owner.
--   * profiles: other people see only id and display_name: friends, people in a goal with you, and people who
--     sent you a pending friend request (so you know who is asking). profiles.email is not readable by the app at
--     all; your own address comes from your login.
--   * friend_requests: to_user is not readable. Before, whoever sent an invite could see whether that email
--     already had an account (to_user filled in) and its id. Sender and recipient still see the row (the RLS
--     policy reads to_user, the app does not need to).
--   * the invite email names the sender by display_name only, never by their email (claim_invite_email).
--   Realtime sends only the columns a user may select, so these limits hold for live updates too.
--
-- Input checks: no text is empty, only spaces, starts or ends with a space, or has control or invisible
-- characters; length limits; amounts at most 1,000,000,000 (high enough for VND / IDR goals); the invite
-- address is a plain email of at most 254 characters. "No name yet" is now NULL instead of ''.
--
-- Apply in the Supabase dashboard: SQL editor -> paste this whole file -> Run (after 0003).

-- ---------------------------------------------------------------------------
-- Text rules shared by every user-written text
-- ---------------------------------------------------------------------------
-- Not empty, no space at either end, no control characters, no zero-width / direction-changing characters
-- (they can hide or reverse text, e.g. to fake a name).
create function app.clean_text(t text, max_len int) returns boolean
language sql immutable set search_path = '' as $$
  select char_length(t) between 1 and max_len
     and t ~ '^[^[:space:]].*$' and t ~ '^.*[^[:space:]]$'
     and t !~ '[[:cntrl:]]'
     and t !~ '[­؜᠎​-‏‪-‮⁠-⁯﻿]'
$$;

-- ---------------------------------------------------------------------------
-- profiles.display_name: NULL = not set yet
-- ---------------------------------------------------------------------------
alter table public.profiles alter column display_name drop default;
alter table public.profiles alter column display_name drop not null;
update public.profiles set display_name = nullif(btrim(display_name), '');
alter table public.profiles drop constraint profiles_display_name_check;
alter table public.profiles add constraint profiles_display_name_clean
  check (display_name is null or app.clean_text(display_name, 40));

-- ---------------------------------------------------------------------------
-- Goals and contributions
-- ---------------------------------------------------------------------------
alter table public.goals drop constraint goals_name_check;
alter table public.goals add constraint goals_name_clean check (app.clean_text(name, 60));
alter table public.goals add constraint goals_target_max check (target <= 1000000000);
-- goals_currency_check (three capital letters) and goals_target_check (> 0) stay as they are.

update public.contributions set note = nullif(btrim(note), '');
alter table public.contributions drop constraint contributions_note_check;
alter table public.contributions add constraint contributions_note_clean check (note is null or app.clean_text(note, 80));
alter table public.contributions add constraint contributions_amount_max check (amount <= 1000000000);

-- ---------------------------------------------------------------------------
-- Invite address: a plain email (the invite function sends nothing else either)
-- ---------------------------------------------------------------------------
alter table public.friend_requests add constraint friend_requests_to_email_plain check (
  char_length(to_email) <= 254
  and to_email ~ '^[a-z0-9._%+-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'
);

-- ---------------------------------------------------------------------------
-- Who sees which profile: also whoever sent you a pending friend request
-- ---------------------------------------------------------------------------
create function app.asked_me(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friend_requests r
                  where r.from_user = uid and r.to_user = auth.uid() and r.status = 'pending')
$$;
revoke all on function app.asked_me(uuid) from public, anon;
grant execute on function app.asked_me(uuid) to authenticated;

drop policy "see yourself, friends and people you share a goal with" on public.profiles;
create policy "see yourself, friends, people you share a goal with and who asked you" on public.profiles
  for select to authenticated
  using (id = auth.uid() or app.are_friends(id, auth.uid()) or app.shares_goal(id, auth.uid()) or app.asked_me(id));

-- ---------------------------------------------------------------------------
-- Which columns: no emails of other people, no to_user
-- ---------------------------------------------------------------------------
revoke select on public.profiles from authenticated;
grant select (id, display_name) on public.profiles to authenticated;

revoke select on public.friend_requests from authenticated;
grant select (id, from_user, to_email, status, created_at, responded_at, emailed_at) on public.friend_requests to authenticated;

-- ---------------------------------------------------------------------------
-- The invite email names the sender by display name only (NULL -> "A friend" in the email)
-- ---------------------------------------------------------------------------
create or replace function public.claim_invite_email(request_id uuid) returns table (to_email text, from_name text)
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
  return query select r.to_email, p.display_name from public.profiles p where p.id = me;
end $$;
