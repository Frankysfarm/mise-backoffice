-- Migration 240 — Phase 1522–1526
-- Fahrer-Bonus-Prognose + Bestelltyp-Verteilung + Bonus-Tracker + Bewertungs-Log

-- Phase 1522: Fahrer-Bonus-Prognose-Snapshots
CREATE TABLE IF NOT EXISTS fahrer_bonus_prognose_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES mise_locations(id) ON DELETE CASCADE,
  fahrer_id text NOT NULL,
  fahrer_name text NOT NULL,
  schicht_datum date NOT NULL,
  stopps_heute int NOT NULL DEFAULT 0,
  stopps_ziel int NOT NULL DEFAULT 15,
  fehlende_stopps int NOT NULL DEFAULT 0,
  puenktlichkeit_pct int NOT NULL DEFAULT 0,
  puenktlichkeit_ziel_pct int NOT NULL DEFAULT 80,
  bonus_status text NOT NULL CHECK (bonus_status IN ('erreicht','auf-kurs','nicht-erreichbar')),
  bonus_betrag_eur numeric(8,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fahrer_bonus_prognose_location_datum
  ON fahrer_bonus_prognose_snapshots (location_id, schicht_datum, fahrer_id);

-- Phase 1523: Bestelltyp-Verteilungs-Log
CREATE TABLE IF NOT EXISTS bestelltyp_verteilungs_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES mise_locations(id) ON DELETE CASCADE,
  log_datum date NOT NULL,
  eigenlieferung_count int NOT NULL DEFAULT 0,
  abholung_count int NOT NULL DEFAULT 0,
  tisch_count int NOT NULL DEFAULT 0,
  gesamt_count int NOT NULL DEFAULT 0,
  eigenlieferung_pct int NOT NULL DEFAULT 0,
  abholung_pct int NOT NULL DEFAULT 0,
  tisch_pct int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bestelltyp_verteilungs_location_datum
  ON bestelltyp_verteilungs_log (location_id, log_datum);

-- Phase 1525: Fahrer-Bonus-Tracker-Log (individuelle Fahrer-Sicht)
CREATE TABLE IF NOT EXISTS fahrer_bonus_tracker_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES mise_locations(id) ON DELETE CASCADE,
  fahrer_id text NOT NULL,
  schicht_datum date NOT NULL,
  stopps_stand int NOT NULL DEFAULT 0,
  puenktlichkeit_stand int NOT NULL DEFAULT 0,
  bonus_status text NOT NULL CHECK (bonus_status IN ('erreicht','auf-kurs','nicht-erreichbar')),
  bonus_hochrechnung_eur numeric(8,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fahrer_bonus_tracker_fahrer_datum
  ON fahrer_bonus_tracker_log (fahrer_id, schicht_datum);

-- Phase 1526: Kunden-Bewertungs-Log (Storefront-Sterne-Widget)
CREATE TABLE IF NOT EXISTS kunden_bewertungs_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES mise_locations(id) ON DELETE CASCADE,
  session_id text,
  sterne int NOT NULL CHECK (sterne BETWEEN 1 AND 5),
  quelle text NOT NULL DEFAULT 'storefront_banner',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kunden_bewertungs_location_datum
  ON kunden_bewertungs_log (location_id, created_at);
