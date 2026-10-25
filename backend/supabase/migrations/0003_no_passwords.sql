-- Lock In: no passwords, ever.
--
-- Sign-in is only a 6-digit email code, Google or Apple. Supabase cannot switch password sign-in off on its own
-- (anyone with the public key can call signUp / signInWithPassword / updateUser({ password })), so the database
-- makes sure no account ever has a password: every insert and every update of auth.users empties
-- encrypted_password. Supabase Auth treats an empty encrypted_password as "no password" (models.User.Authenticate
-- returns false for "" before comparing anything), so signInWithPassword always ends in "Invalid login
-- credentials", for every account, confirmed or not.
--
-- This also closes the pre-account takeover: someone signs up with another person's email and a password, the
-- account stays unconfirmed, and when the real owner later signs in with a code, Supabase Auth confirms the
-- account but keeps the password (signupVerify and Signup never touch an existing password). With this trigger
-- that password was never stored.
--
-- Code, Google and Apple sign-in never read encrypted_password: a code is checked against confirmation/recovery
-- tokens, Google and Apple against the identity. Accounts made by Google/Apple already have "" here; accounts made
-- by a code get a random temporary password from Supabase Auth (magic_link.go), which is emptied too.
--
-- Supabase allows triggers on auth.users (changelog, 21 April 2025); the function lives outside the auth schema.
-- Apply in the Supabase dashboard: SQL editor -> paste this whole file -> Run (after 0001 and 0002).

create function app.no_password() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.encrypted_password := '';
  return new;
end $$;

create trigger no_password before insert or update on auth.users
  for each row execute function app.no_password();

revoke all on function app.no_password() from public, anon, authenticated;

-- Accounts that already exist: the trigger empties their password on this update.
update auth.users set encrypted_password = '' where encrypted_password is distinct from '';
