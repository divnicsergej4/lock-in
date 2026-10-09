-- Lock In: anonimno brojanje korišćenja (bez iznosa, opisa i kategorija)
-- Nalepi sve u Supabase → SQL Editor → Run

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  device_id  text not null check (char_length(device_id) between 8 and 64),
  event      text not null check (event in ('onboard', 'open', 'log')),
  local_day  date not null,
  lang       text check (lang in ('sr', 'en'))
);

alter table public.events enable row level security;

-- Stranica sme samo da UPISUJE nove događaje, nikad da čita, menja ili briše.
drop policy if exists "anon can insert events" on public.events;
create policy "anon can insert events"
  on public.events
  for insert
  to anon
  with check (local_day between current_date - 2 and current_date + 2);

revoke all on public.events from anon, authenticated;
grant insert on public.events to anon;
