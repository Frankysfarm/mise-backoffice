-- Migration 241: Küchen-Durchsatz-Analyse + Warenkorb-Erinnerung (Phasen 1527–1531)
-- Phase 1527: Küchen-Durchsatz-Analyse-API
-- Phase 1528: Tages-Umsatz-Balken-Chart
-- Phase 1529: Küchen-Durchsatz-Widget
-- Phase 1530: Tagesabschluss-Berichts-Karte
-- Phase 1531: Warenkorb-Erinnerungs-Banner

-- Küchen-Durchsatz-Snapshots (für historische Auswertung)
CREATE TABLE IF NOT EXISTS kuechen_durchsatz_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  stunde smallint NOT NULL CHECK (stunde BETWEEN 0 AND 23),
  bestellungen_count integer NOT NULL DEFAULT 0,
  avg_prep_min numeric(5,2),
  kapazitaets_status text CHECK (kapazitaets_status IN ('gut', 'normal', 'kritisch')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kuechen_durchsatz_snapshots_date
  ON kuechen_durchsatz_snapshots (location_id, snapshot_date, stunde);

-- Tagesabschluss-Berichte je Fahrer
CREATE TABLE IF NOT EXISTS fahrer_tagesabschluss_berichte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  schicht_date date NOT NULL DEFAULT CURRENT_DATE,
  schicht_start timestamptz,
  schicht_end timestamptz,
  total_stopps integer NOT NULL DEFAULT 0,
  total_earned_cents integer NOT NULL DEFAULT 0,
  total_km numeric(8,2),
  avg_delivery_min numeric(5,2),
  avg_rating numeric(3,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, schicht_date)
);

-- Warenkorb-Erinnerungs-Impressions (anonymisiert, für A/B-Testing)
CREATE TABLE IF NOT EXISTS warenkorb_erinnerungs_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
  session_hash text NOT NULL,
  cart_item_count integer NOT NULL DEFAULT 0,
  action text CHECK (action IN ('shown', 'dismissed', 'converted')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warenkorb_erinnerungs_impressions_date
  ON warenkorb_erinnerungs_impressions (location_id, created_at);
