-- Migration 223: Bestellmuster-Heatmap + Fahrer-Effizienz-Rangliste + Schicht-Abschluss
-- Phase 1128: Tages-Bestellmuster-Heatmap (7×24 Matrix Snapshots)
-- Phase 1130: Fahrer-Effizienz-Rangliste (tägliche Snapshots)
-- Phase 1131: Schicht-Abschluss-Zusammenfassung (persistierte Berichte)

-- Table: bestellmuster_heatmap_snapshots
-- Stores precomputed 7×24 order frequency matrix per location per day
CREATE TABLE IF NOT EXISTS bestellmuster_heatmap_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  wochentag     smallint NOT NULL CHECK (wochentag BETWEEN 0 AND 6), -- 0=Mo, 6=So
  stunde        smallint NOT NULL CHECK (stunde BETWEEN 0 AND 23),
  anzahl        integer NOT NULL DEFAULT 0,
  intensitaet   text NOT NULL DEFAULT 'leer' CHECK (intensitaet IN ('leer','niedrig','mittel','hoch','peak')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, snapshot_date, wochentag, stunde)
);

CREATE INDEX IF NOT EXISTS idx_bestellmuster_snapshots_location_date
  ON bestellmuster_heatmap_snapshots (location_id, snapshot_date DESC);

-- Table: fahrer_effizienz_rangliste_snapshots
-- Daily driver efficiency ranking snapshots for trending
CREATE TABLE IF NOT EXISTS fahrer_effizienz_rangliste_snapshots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  fahrer_id           uuid NOT NULL,
  snapshot_date       date NOT NULL,
  rang                smallint NOT NULL,
  stopps_gesamt       integer NOT NULL DEFAULT 0,
  stopps_pro_stunde   numeric(5,2) NOT NULL DEFAULT 0,
  km_gesamt           numeric(8,2) NOT NULL DEFAULT 0,
  km_pro_stopp        numeric(5,2) NOT NULL DEFAULT 0,
  puenktlichkeit_pct  smallint NOT NULL DEFAULT 0,
  gesamt_score        smallint NOT NULL DEFAULT 0,
  badge               text CHECK (badge IN ('gold','silber','bronze')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, fahrer_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_fahrer_rangliste_location_date
  ON fahrer_effizienz_rangliste_snapshots (location_id, snapshot_date DESC);

-- Table: schicht_abschluss_berichte
-- Persisted shift completion summaries per driver per day
CREATE TABLE IF NOT EXISTS schicht_abschluss_berichte (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fahrer_id           uuid NOT NULL,
  location_id         uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  schicht_datum       date NOT NULL,
  schicht_start       timestamptz,
  schicht_ende        timestamptz,
  schicht_dauer_min   integer NOT NULL DEFAULT 0,
  stopps_gesamt       integer NOT NULL DEFAULT 0,
  km_gesamt           numeric(8,2) NOT NULL DEFAULT 0,
  umsatz_eur          numeric(10,2) NOT NULL DEFAULT 0,
  trinkgeld_eur       numeric(8,2) NOT NULL DEFAULT 0,
  puenktlichkeit_pct  smallint NOT NULL DEFAULT 0,
  score               smallint NOT NULL DEFAULT 0,
  score_label         text NOT NULL DEFAULT 'Befriedigend',
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fahrer_id, schicht_datum)
);

CREATE INDEX IF NOT EXISTS idx_schicht_abschluss_fahrer_date
  ON schicht_abschluss_berichte (fahrer_id, schicht_datum DESC);

CREATE INDEX IF NOT EXISTS idx_schicht_abschluss_location_date
  ON schicht_abschluss_berichte (location_id, schicht_datum DESC);

-- RLS Policies
ALTER TABLE bestellmuster_heatmap_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE fahrer_effizienz_rangliste_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE schicht_abschluss_berichte ENABLE ROW LEVEL SECURITY;

-- Service role has full access (backend API writes)
CREATE POLICY "service_full_access_bestellmuster" ON bestellmuster_heatmap_snapshots
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_full_access_effizienz_rangliste" ON fahrer_effizienz_rangliste_snapshots
  FOR ALL TO service_role USING (true);

CREATE POLICY "service_full_access_schicht_abschluss" ON schicht_abschluss_berichte
  FOR ALL TO service_role USING (true);
