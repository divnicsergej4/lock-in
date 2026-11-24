-- Local stand-in for what a Supabase project already has (only for testing the migration on plain Postgres).
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
-- The columns of the real auth.users that Supabase Auth reads and writes when signing in (the real table has more).
-- Like on Supabase, the table belongs to supabase_auth_admin, the role the Auth server writes with.
create role supabase_auth_admin nologin;
create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at         timestamptz,
  confirmation_token varchar(255) default '',
  recovery_token     varchar(255) default '',
  last_sign_in_at    timestamptz,
  raw_app_meta_data  jsonb default '{}'::jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
grant usage on schema auth to supabase_auth_admin;
alter table auth.users owner to supabase_auth_admin;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create publication supabase_realtime;
