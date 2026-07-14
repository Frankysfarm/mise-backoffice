-- Migration 247: Liefer-Qualitäts-Index + Empfohlene-Artikel-Chips (Phase 1562–1566)

create table if not exists liefer_qualitaets_index_snapshots (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  index_wert smallint not null,
  puenktlichkeit_pct smallint,
  kundenbewertung_avg numeric(3,2),
  storno_rate_pct smallint,
  vollstaendigkeit_pct smallint,
  trend_vs_7tage smallint,
  status text check (status in ('excellent','gut','mittel','kritisch')),
  generiert_am timestamptz not null default now()
);

create index if not exists idx_liefer_qualitaets_index_snapshots_location
  on liefer_qualitaets_index_snapshots(location_id, generiert_am desc);

create table if not exists bestellungs_komplexitaets_log (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  offene_bestellungen smallint,
  avg_artikel numeric(5,2),
  unique_kategorien smallint,
  komplex_score smallint,
  ampel text check (ampel in ('gruen','gelb','rot')),
  erfasst_am timestamptz not null default now()
);

create table if not exists kunden_zufriedenheits_ampel_log (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null,
  durchschnitt_letzte5 numeric(3,2),
  ampel text check (ampel in ('gruen','gelb','rot')),
  erfasst_am timestamptz not null default now()
);

create table if not exists empfohlene_artikel_chips_impressions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  artikel_id uuid,
  artikel_name text,
  geklickt boolean default false,
  erfasst_am timestamptz not null default now()
);

create index if not exists idx_empfohlene_artikel_chips_location
  on empfohlene_artikel_chips_impressions(location_id, erfasst_am desc);
