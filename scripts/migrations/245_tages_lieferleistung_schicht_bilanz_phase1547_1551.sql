-- Migration 245: Tages-Lieferleistung & Schicht-Bilanz — Phasen 1547–1551
-- 2026-07-14

-- Tabelle: tages_lieferleistungs_snapshots
-- Speichert tägliche Lieferleistungs-Snapshots je Location für Trend-Analyse
CREATE TABLE IF NOT EXISTS tages_lieferleistungs_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  datum date NOT NULL,
  avg_lieferzeit_min numeric(5,1) DEFAULT 0,
  puenktlichkeits_rate numeric(5,2) DEFAULT 0,
  storno_rate numeric(5,2) DEFAULT 0,
  bewertung_avg numeric(3,2) DEFAULT 0,
  bewertung_count integer DEFAULT 0,
  bestellungen_gesamt integer DEFAULT 0,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id, datum)
);
CREATE INDEX IF NOT EXISTS idx_tages_lieferleistung_location_datum
  ON tages_lieferleistungs_snapshots (location_id, datum DESC);

-- Tabelle: fahrer_schicht_bilanzen
-- Live-Schicht-Bilanz je Fahrer (Verdienst, Trinkgeld, Bewertung, Stopps)
CREATE TABLE IF NOT EXISTS fahrer_schicht_bilanzen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  schicht_datum date NOT NULL DEFAULT CURRENT_DATE,
  stopps_heute integer DEFAULT 0,
  stopps_ziel integer DEFAULT 15,
  verdienst_heute numeric(8,2) DEFAULT 0,
  trinkgeld_heute numeric(8,2) DEFAULT 0,
  bewertung_avg numeric(3,2) DEFAULT 0,
  bewertung_count integer DEFAULT 0,
  schicht_start_at timestamptz,
  on_time_quote numeric(5,2) DEFAULT 0,
  aktualisiert_am timestamptz DEFAULT now(),
  UNIQUE(driver_id, schicht_datum)
);
CREATE INDEX IF NOT EXISTS idx_fahrer_schicht_bilanz_driver_datum
  ON fahrer_schicht_bilanzen (driver_id, schicht_datum DESC);

-- Tabelle: standort_bewertungen_cache
-- Cached Bewertungs-Aggregate je Location für Storefront-Teaser
CREATE TABLE IF NOT EXISTS standort_bewertungen_cache (
  location_id uuid PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  avg_sterne numeric(3,2) DEFAULT 0,
  anzahl integer DEFAULT 0,
  top_kommentar text,
  aktualisiert_am timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE tages_lieferleistungs_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE fahrer_schicht_bilanzen ENABLE ROW LEVEL SECURITY;
ALTER TABLE standort_bewertungen_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tages_snapshot_select" ON tages_lieferleistungs_snapshots
  FOR SELECT USING (true);
CREATE POLICY "tages_snapshot_insert" ON tages_lieferleistungs_snapshots
  FOR INSERT WITH CHECK (true);

CREATE POLICY "schicht_bilanz_select" ON fahrer_schicht_bilanzen
  FOR SELECT USING (true);
CREATE POLICY "schicht_bilanz_upsert" ON fahrer_schicht_bilanzen
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "bewertungen_cache_select" ON standort_bewertungen_cache
  FOR SELECT USING (true);
CREATE POLICY "bewertungen_cache_upsert" ON standort_bewertungen_cache
  FOR ALL USING (true) WITH CHECK (true);
