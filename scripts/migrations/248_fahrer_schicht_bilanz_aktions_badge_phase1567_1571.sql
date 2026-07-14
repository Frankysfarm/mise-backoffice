-- Migration 248 — Phase 1567–1571
-- Fahrer-Schicht-Bilanz-API + Warteschlangen-Druck + Schicht-Bilanz-Widget + Tageseinnahmen-Verlauf + Aktions-Badge

-- fahrer_schicht_bilanz_snapshots — Historische Schichtbilanz je Fahrer (für Trend-Analyse)
CREATE TABLE IF NOT EXISTS fahrer_schicht_bilanz_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES mise_locations(id) ON DELETE CASCADE,
  fahrer_id uuid NOT NULL,
  schicht_datum date NOT NULL DEFAULT CURRENT_DATE,
  einnahmen_eur numeric(10,2) NOT NULL DEFAULT 0,
  stopps_count int NOT NULL DEFAULT 0,
  bewertung_avg numeric(3,2),
  km_total int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv','pause','offline')),
  erfasst_am timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fahrer_bilanz_location_datum ON fahrer_schicht_bilanz_snapshots (location_id, schicht_datum DESC);

-- warteschlangen_druck_log — Log bei kritischem Queue-Druck (für Analyse)
CREATE TABLE IF NOT EXISTS warteschlangen_druck_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES mise_locations(id) ON DELETE CASCADE,
  stufe text NOT NULL CHECK (stufe IN ('niedrig','mittel','hoch','kritisch')),
  bestellungen_total int NOT NULL DEFAULT 0,
  bestellungen_5min int NOT NULL DEFAULT 0,
  bestellungen_10min int NOT NULL DEFAULT 0,
  bestellungen_15min int NOT NULL DEFAULT 0,
  erfasst_am timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warteschlangen_druck_location ON warteschlangen_druck_log (location_id, erfasst_am DESC);

-- location_aktionen — Aktuelle Aktionen/Rabatte je Location (für Aktions-Badge Storefront)
CREATE TABLE IF NOT EXISTS location_aktionen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES mise_locations(id) ON DELETE CASCADE,
  titel text NOT NULL,
  beschreibung text NOT NULL DEFAULT '',
  rabatt_pct int CHECK (rabatt_pct BETWEEN 0 AND 100),
  aktiv boolean NOT NULL DEFAULT true,
  gueltig_von timestamptz NOT NULL DEFAULT now(),
  gueltig_bis timestamptz,
  erstellt_am timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_location_aktionen_aktiv ON location_aktionen (location_id, aktiv, gueltig_bis);
