-- Migration 239 — Phase 1517–1521
-- Schicht-Umsatz-Prognose + Beliebte-Artikel + Pausen-Log + Prognose-Uhr-Log

-- Phase 1517: Schicht-Umsatz-Prognose-Snapshots
CREATE TABLE IF NOT EXISTS schicht_umsatz_prognose_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES mise_locations(id) ON DELETE CASCADE,
  schicht_datum date NOT NULL,
  umsatz_bisher_eur numeric(10,2) NOT NULL DEFAULT 0,
  umsatz_prognose_eur numeric(10,2) NOT NULL DEFAULT 0,
  umsatz_ziel_eur numeric(10,2) NOT NULL DEFAULT 0,
  tempo_eur_pro_stunde numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('ueber_ziel','auf_ziel','unter_ziel')),
  trend text NOT NULL CHECK (trend IN ('steigend','stabil','fallend')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schicht_umsatz_prognose_location_datum
  ON schicht_umsatz_prognose_snapshots (location_id, schicht_datum);

-- Phase 1518: Bestelllast-Prognose-Uhr-Log
CREATE TABLE IF NOT EXISTS bestelllast_prognose_uhr_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES mise_locations(id) ON DELETE CASCADE,
  stunde int NOT NULL CHECK (stunde BETWEEN 0 AND 23),
  bestellungen_diese_stunde int NOT NULL DEFAULT 0,
  bestellungen_letzte_stunde int NOT NULL DEFAULT 0,
  auslastung_pct int NOT NULL DEFAULT 0,
  level text NOT NULL CHECK (level IN ('niedrig','normal','hoch','kritisch')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bestelllast_prognose_uhr_location
  ON bestelllast_prognose_uhr_log (location_id, created_at DESC);

-- Phase 1520: Fahrer-Pausen-Log
CREATE TABLE IF NOT EXISTS fahrer_pausen_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES delivery_drivers(id) ON DELETE CASCADE,
  schicht_datum date NOT NULL,
  pausen_start timestamptz NOT NULL,
  pausen_ende timestamptz,
  dauer_min int,
  empfehlung_level text CHECK (empfehlung_level IN ('empfohlen','bald','gut')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fahrer_pausen_log_driver_datum
  ON fahrer_pausen_log (driver_id, schicht_datum);

-- Phase 1521: Beliebte-Artikel-Impressions
CREATE TABLE IF NOT EXISTS beliebte_artikel_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES mise_locations(id) ON DELETE CASCADE,
  artikel_id text NOT NULL,
  artikel_name text NOT NULL,
  session_id text,
  action text NOT NULL CHECK (action IN ('view','click')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_beliebte_artikel_impressions_location
  ON beliebte_artikel_impressions (location_id, created_at DESC);
