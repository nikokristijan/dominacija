-- Pohrana stanja za aplikaciju (Next.js server): jedan JSON dokument s optimističnim zaključavanjem.
-- Koristi se isključivo preko service-role ključa na serveru. RLS je uključen BEZ politika,
-- pa anon/authenticated ključevi ne mogu pročitati ništa (lozinke i tajni ciljevi nikad ne napuštaju server).
create table if not exists public.dominacija_state (
  id text primary key,
  version bigint not null default 1,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.dominacija_state enable row level security;
revoke all on public.dominacija_state from anon, authenticated;
