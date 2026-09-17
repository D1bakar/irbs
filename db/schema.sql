-- RailBook LP6 schema (Postgres). Local dev uses JSON file store with same shapes (see lib/store.js).
-- Run: psql $DATABASE_URL -f db/schema.sql
create table if not exists stations (
  code text primary key,
  name text not null,
  state text not null,
  pf int default 0,
  amen text[] default '{}',
  km int default 0
);
create table if not exists specials (
  id text primary key,
  no text, name text not null,
  s_from text, s_to text, dates text,
  tag text, org text, by_div text,
  s_when text, state text, img text
);
create table if not exists alerts (
  id text primary key,
  type text not null,
  ref text not null,
  contact text not null,
  created_at timestamptz default now(),
  confirmed boolean default false,
  unique (type, ref, contact)
);
create table if not exists vendor_drafts (
  id text primary key,
  kind text not null check (kind in ('stall','tour')),
  what text not null,
  phone text not null,
  status text default 'pending',
  created_at timestamptz default now()
);
create table if not exists trips (
  id text primary key,
  s_from text, s_to text, s_date text,
  cls text, quota text, pax int default 1,
  train_no text,
  created_at timestamptz default now()
);
create table if not exists crowd_votes (
  id bigserial primary key,
  trip_ref text not null,
  rating int check (rating between 1 and 5),
  created_at timestamptz default now()
);
create table if not exists consent_log (
  id bigserial primary key,
  anon_id text,
  functional boolean, analytics boolean,
  created_at timestamptz default now()
);
create table if not exists api_events (
  id bigserial primary key,
  name text not null,
  meta jsonb default '{}',
  created_at timestamptz default now()
);
create table if not exists otp_codes (
  phone text primary key,
  code text not null,
  exp_at timestamptz not null,
  attempts int default 0
);
create index if not exists idx_alerts_contact on alerts (contact);
create index if not exists idx_trips_date on trips (s_date);
