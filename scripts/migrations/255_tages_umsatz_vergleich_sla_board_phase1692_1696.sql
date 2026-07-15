-- Migration 255: Tages-Umsatz-Vergleich + Zone-SLA-Board + Schicht-Rangliste
-- Phase 1692-1696: Backend APIs + Kitchen/Dispatch/Fahrer/Storefront Komponenten

-- Tages-Umsatz-Snapshots für Trend-Verlauf
CREATE TABLE IF NOT EXISTS tages_umsatz_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  datum           date NOT NULL,
  umsatz_eur      numeric(10,2) NOT NULL DEFAULT 0,
  bestellungen    int NOT NULL DEFAULT 0,
  erstellt_am     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, datum)
);

CREATE INDEX IF NOT EXISTS idx_tages_umsatz_snapshots_location_datum
  ON tages_umsatz_snapshots (location_id, datum DESC);

-- Schicht-Rangliste-Snapshots für Verlauf
CREATE TABLE IF NOT EXISTS schicht_rangliste_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  fahrer_id       uuid NOT NULL,
  datum           date NOT NULL,
  rang            int NOT NULL,
  punkte          numeric(6,1) NOT NULL DEFAULT 0,
  stopps          int NOT NULL DEFAULT 0,
  avg_liefer_min  numeric(5,1),
  sla_pct         numeric(5,1),
  erstellt_am     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, fahrer_id, datum)
);

CREATE INDEX IF NOT EXISTS idx_schicht_rangliste_snapshots_location_datum
  ON schicht_rangliste_snapshots (location_id, datum DESC);

CREATE INDEX IF NOT EXISTS idx_schicht_rangliste_snapshots_fahrer_datum
  ON schicht_rangliste_snapshots (fahrer_id, datum DESC);

-- Zone-SLA-Log für historische Auswertung
CREATE TABLE IF NOT EXISTS zonen_sla_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  zone_label      char(1) NOT NULL CHECK (zone_label IN ('A','B','C','D')),
  datum           date NOT NULL,
  gesamt_stopps   int NOT NULL DEFAULT 0,
  sla_ok_stopps   int NOT NULL DEFAULT 0,
  sla_pct         numeric(5,1) NOT NULL DEFAULT 100,
  avg_liefer_min  numeric(5,1),
  erstellt_am     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, zone_label, datum)
);

CREATE INDEX IF NOT EXISTS idx_zonen_sla_log_location_datum
  ON zonen_sla_log (location_id, datum DESC);

COMMENT ON TABLE tages_umsatz_snapshots  IS 'Tägliche Umsatz-Snapshots für Phase-1692-Vergleiche';
COMMENT ON TABLE schicht_rangliste_snapshots IS 'Schicht-Ranglisten-Verlauf je Fahrer für Phase 1695';
COMMENT ON TABLE zonen_sla_log          IS 'Historischer SLA-Log je Zone für Phase 1694';
