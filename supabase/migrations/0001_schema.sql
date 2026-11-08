-- DOMINACIJA: Rise of Empires — relacijska shema (PostgreSQL / Supabase)
-- Autoritativno stanje mijenja ISKLJUČIVO server (service role). Klijenti čitaju kroz RLS.

create type campaign_status as enum ('waiting', 'active', 'completed', 'disabled');
create type order_status as enum ('draft', 'submitted', 'locked', 'executed', 'failed', 'cancelled');
create type terrain_type as enum ('plains', 'forest', 'mountains', 'desert', 'water', 'special');

-- ───────── korisnici i profili ─────────
-- "users" je Supabase auth.users; ovdje je javni profil.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  preferred_faction text,
  is_admin boolean not null default false,
  notification_prefs jsonb not null default '{"invitation":true,"alliance_offer":true,"trade_offer":true,"attack":true,"resolution":true,"diplomatic":true,"campaign_complete":true,"phase":false,"achievement":true,"warning":true,"push":false}',
  achievements text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────── kampanje ─────────
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 40),
  owner_id uuid not null references profiles(id),
  invite_code text not null unique,
  status campaign_status not null default 'waiting',
  min_players int not null default 4 check (min_players between 4 and 8),
  max_players int not null default 6 check (max_players between 4 and 8 and max_players >= min_players),
  dev_simulation boolean not null default false,
  seed text not null,
  config_overrides jsonb,
  schedule jsonb not null,
  current_round int not null default 1 check (current_round between 1 and 7),
  round_opens_at timestamptz,
  round_deadline timestamptz,
  version bigint not null default 1,          -- optimistička konkurentnost
  last_resolved_round int not null default 0, -- idempotentno razrješenje
  disabled_reason text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index campaigns_owner_idx on campaigns(owner_id);
create index campaigns_status_deadline_idx on campaigns(status, round_deadline);

create table campaign_players (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid references profiles(id),           -- null = bot (samo dev simulacije)
  slot text not null,                              -- p1..p8
  name text not null,
  faction text,
  is_bot boolean not null default false,
  status text not null default 'active' check (status in ('active', 'resistance')),
  stability numeric not null default 80 check (stability between 0 and 100),
  tax text not null default 'normal' check (tax in ('low', 'normal', 'high')),
  ready boolean not null default false,
  autopilot boolean not null default false,
  missed_rounds int not null default 0,
  reputation jsonb not null default '{}',
  stats jsonb not null default '{}',
  capital_territory_id uuid,
  joined_at timestamptz not null default now(),
  unique (campaign_id, slot),
  unique (campaign_id, user_id),
  check (is_bot or user_id is not null)
);
create index campaign_players_user_idx on campaign_players(user_id);

create table resources (
  campaign_player_id uuid primary key references campaign_players(id) on delete cascade,
  gold numeric not null default 0 check (gold >= 0),
  food numeric not null default 0 check (food >= 0),
  iron numeric not null default 0 check (iron >= 0),
  wood numeric not null default 0 check (wood >= 0),
  influence numeric not null default 0 check (influence >= 0),
  updated_at timestamptz not null default now()
);

-- ───────── karta ─────────
create table territories (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  code text not null,                 -- npr. h4_3
  name text not null,
  col int not null, row int not null, q int not null, r int not null,
  terrain terrain_type not null,
  deposit text,
  owner_player_id uuid references campaign_players(id) on delete set null,
  region_id text not null,
  defense_level int not null default 0 check (defense_level between 0 and 5),
  population int not null default 0 check (population >= 0),
  stability numeric not null default 70 check (stability between 0 and 100),
  importance int not null default 1 check (importance between 1 and 5),
  is_capital boolean not null default false,
  capital_of uuid references campaign_players(id),
  siege_progress int not null default 0,
  isolated_days int not null default 0,
  effects jsonb not null default '[]',
  unique (campaign_id, code),
  unique (campaign_id, col, row)
);
create index territories_owner_idx on territories(owner_player_id);

create table buildings (
  id uuid primary key default gen_random_uuid(),
  territory_id uuid not null unique references territories(id) on delete cascade,
  type text not null,
  level int not null default 1 check (level between 1 and 3),
  construction_type text, construction_level int, construction_completes_round int
);

create table military_units (        -- katalog (konfiguracija, ne stanje)
  type text primary key,
  attack numeric not null, defense numeric not null, movement int not null,
  cost jsonb not null, upkeep jsonb not null, terrain_modifiers jsonb not null
);

create table armies (               -- garnizon po teritoriju
  id uuid primary key default gen_random_uuid(),
  territory_id uuid not null references territories(id) on delete cascade,
  unit_type text not null references military_units(type),
  count int not null check (count >= 0),
  unique (territory_id, unit_type)
);

-- ───────── naredbe (privatne do razrješenja) ─────────
create table orders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  campaign_player_id uuid not null references campaign_players(id) on delete cascade,
  round int not null check (round between 1 and 7),
  type text not null,
  params jsonb not null,
  status order_status not null default 'draft',
  priority int not null default 1,
  cp_cost int not null check (cp_cost >= 0),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_player_round_idx on orders(campaign_player_id, round);

create table conditional_orders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  campaign_player_id uuid not null references campaign_players(id) on delete cascade,
  round int not null,
  trigger jsonb not null, condition jsonb not null, action jsonb not null, resource_req jsonb not null default '{}',
  priority int not null default 1, expires_round int not null,
  status text not null default 'active' check (status in ('active', 'triggered', 'failed', 'expired', 'cancelled')),
  result text, created_at timestamptz not null default now()
);

-- ───────── diplomacija ─────────
create table alliances (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  kind text not null check (kind in ('alliance', 'nap')),
  player_a uuid not null references campaign_players(id) on delete cascade,
  player_b uuid not null references campaign_players(id) on delete cascade,
  started_round int not null, ends_round int,
  secret boolean not null default false,
  status text not null default 'active' check (status in ('active', 'ended', 'broken')),
  terms jsonb not null default '{}',
  check (player_a <> player_b)
);
create table diplomatic_offers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  kind text not null,
  from_player uuid not null references campaign_players(id) on delete cascade,
  to_player uuid not null references campaign_players(id) on delete cascade,
  secret boolean not null default false,
  terms jsonb not null default '{}',
  status text not null default 'pending',
  created_round int not null, expires_round int not null, result_text text,
  check (from_player <> to_player)
);
create table messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  from_player uuid not null references campaign_players(id) on delete cascade,
  to_player uuid not null references campaign_players(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  round int not null,
  created_at timestamptz not null default now(),
  check (from_player <> to_player)
);
create index messages_pair_idx on messages(campaign_id, from_player, to_player);

-- ───────── obavještajna služba, tehnologija, ciljevi ─────────
create table espionage_reports (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  owner_player uuid not null references campaign_players(id) on delete cascade,
  target_player uuid references campaign_players(id) on delete set null,
  territory_code text,
  kind text not null, round int not null,
  confidence text not null check (confidence in ('low', 'medium', 'high', 'failed')),
  data jsonb not null default '{}', summary text not null,
  created_at timestamptz not null default now()
);
create table technology_progress (
  campaign_player_id uuid not null references campaign_players(id) on delete cascade,
  tech_id text not null, researched_round int not null,
  primary key (campaign_player_id, tech_id)
);
create table secret_objectives (
  campaign_player_id uuid primary key references campaign_players(id) on delete cascade,
  type text not null, title text not null, description text not null, params jsonb not null default '{}', completed boolean not null default false
);

-- ───────── događaji, izvještaji, bodovi, obavijesti ─────────
create table world_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  round int not null, type text not null, title text not null, description text not null,
  effects text[] not null default '{}', scope text not null, region_id text, territory_codes text[],
  announced boolean not null default false,
  unique (campaign_id, round)
);
create table battle_reports (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  round int not null, territory_code text not null,
  attacker_players uuid[] not null, defender_player uuid references campaign_players(id),
  outcome text not null, captured boolean not null default false, report jsonb not null
);
create index battle_reports_campaign_idx on battle_reports(campaign_id, round);
create table daily_reports (
  campaign_player_id uuid not null references campaign_players(id) on delete cascade,
  round int not null, report jsonb not null,
  primary key (campaign_player_id, round)
);
create table campaign_scores (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  campaign_player_id uuid not null references campaign_players(id) on delete cascade,
  round int not null,
  public_score int not null,   -- bez tajnog cilja
  breakdown jsonb,             -- puni rastav: vidljiv tek nakon završetka
  primary key (campaign_id, campaign_player_id, round)
);
create table resolutions (      -- idempotentnost: jedno razrješenje po (kampanja, runda)
  campaign_id uuid not null references campaigns(id) on delete cascade,
  round int not null, resolved_at timestamptz not null default now(), state_hash text,
  primary key (campaign_id, round)
);
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  kind text not null, title text not null, body text not null,
  created_at timestamptz not null default now(), read_at timestamptz
);
create index notifications_user_idx on notifications(user_id, created_at desc);
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique, keys jsonb not null, created_at timestamptz not null default now()
);
create table error_log (
  id uuid primary key default gen_random_uuid(), at timestamptz not null default now(),
  location text not null, message text not null, stack text, campaign_id uuid, user_id uuid
);
create table audit_log (
  id uuid primary key default gen_random_uuid(), at timestamptz not null default now(),
  user_id uuid, campaign_id uuid, kind text not null, detail text not null
);
