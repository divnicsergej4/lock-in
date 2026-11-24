-- Lock In: the launch list ("Get notified at launch" on lockintracker.app, Andrija 24 Nov 2026).
--
-- The website's one form: someone leaves an email to get one message when Lock In is out. A signed-out visitor
-- (role anon, the publishable key) can only call public.join_waitlist; nobody can read the list through the API,
-- because it lives in schema app, which the API does not serve. Andrija reads it in the SQL editor:
--   select email, source, created_at from app.waitlist order by created_at;
-- Someone who asks to be taken off:
--   delete from app.waitlist where email = 'their@email';
--
-- Against a script filling the list: an address is stored once (a repeat changes nothing and looks the same to the
-- visitor, so the form never tells whether an address is already on the list), and the whole list takes at most
-- 300 new addresses an hour and 2,000 a day. Nothing is emailed on sign-up, so the form cannot be used to send mail
-- to strangers.
--
-- Apply after 0007: Supabase dashboard -> SQL editor -> paste this whole file -> Run.

create table app.waitlist (
  email      text primary key
             check (char_length(email) <= 254 and email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source     text check (source ~ '^[a-z0-9_-]{1,30}$'),  -- where they came from, e.g. ?from=instagram
  created_at timestamptz not null default now()
);
create index waitlist_created on app.waitlist (created_at);
alter table app.waitlist enable row level security;  -- no policies: only the owner (SQL editor) and join_waitlist
revoke all on app.waitlist from public, anon, authenticated;

create function public.join_waitlist(email text, source text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  e text := lower(btrim(join_waitlist.email));
  s text := nullif(lower(btrim(coalesce(join_waitlist.source, ''))), '');
begin
  if e is null or char_length(e) > 254 or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address.' using errcode = 'P0001', hint = 'invalid';
  end if;
  if s is not null and s !~ '^[a-z0-9_-]{1,30}$' then s := null; end if;
  -- one sign-up at a time, so parallel calls cannot slip past the limits together
  perform pg_advisory_xact_lock(hashtextextended('waitlist', 0));
  if exists (select 1 from app.waitlist w where w.email = e) then return; end if;
  if (select count(*) from app.waitlist w where w.created_at > now() - interval '1 hour') >= 300
     or (select count(*) from app.waitlist w where w.created_at > now() - interval '1 day') >= 2000 then
    raise exception 'Too many sign-ups right now. Try again in a little while.' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  insert into app.waitlist (email, source) values (e, s);
end $$;
revoke all on function public.join_waitlist(text, text) from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text) to anon;
