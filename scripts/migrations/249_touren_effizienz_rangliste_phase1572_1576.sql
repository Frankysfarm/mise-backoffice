-- Migration 249: Touren-Effizienz-Rangliste + Zubereitungs-Rückstand + Lieferzeit-Ticker
-- Phases 1572–1576
-- 2026-07-14

-- Phase 1572: Touren-Effizienz-Rangliste snapshots
CREATE TABLE IF NOT EXISTS touren_effizienz_rangliste_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL,
  fahrer_id       uuid NOT NULL,
  fahrer_name     text NOT NULL,
  touren_anzahl   int NOT NULL DEFAULT 0,
  stopps_pro_tour numeric(4,1) NOT NULL DEFAULT 0,
  km_pro_stopp    numeric(5,2) NOT NULL DEFAULT 0,
  puenktlichkeitsrate int NOT NULL DEFAULT 0,
  rang            int NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'normal' CHECK (status IN ('top', 'normal', 'schwach')),
  zeitraum_tage   int NOT NULL DEFAULT 7,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_touren_effizienz_rangliste_location ON touren_effizienz_rangliste_snapshots (location_id, created_at DESC);

-- Phase 1573: Zubereitungs-Rückstand log
CREATE TABLE IF NOT EXISTS zubereitungs_rueckstand_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL,
  rueckstand_count int NOT NULL DEFAULT 0,
  ampel           text NOT NULL DEFAULT 'gruen' CHECK (ampel IN ('gruen', 'gelb', 'rot')),
  aeltester_min   int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_zubereitungs_rueckstand_log_location ON zubereitungs_rueckstand_log (location_id, created_at DESC);

-- Phase 1575: Schicht-Bestätigung Erinnerung log
CREATE TABLE IF NOT EXISTS schicht_erinnerungs_karte_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       uuid NOT NULL,
  schicht_id      text NOT NULL,
  countdown_min   int NOT NULL DEFAULT 0,
  action          text NOT NULL DEFAULT 'angezeigt' CHECK (action IN ('angezeigt', 'bestaetigt', 'abgelehnt')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schicht_erinnerungs_karte_driver ON schicht_erinnerungs_karte_log (driver_id, created_at DESC);

-- Phase 1576: Lieferzeit-Echtzeit-Ticker impressions
CREATE TABLE IF NOT EXISTS lieferzeit_echtzeit_ticker_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL,
  location_id     uuid NOT NULL,
  status_angezeigt text NOT NULL,
  eta_min         int,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lieferzeit_ticker_order ON lieferzeit_echtzeit_ticker_log (order_id, created_at DESC);
