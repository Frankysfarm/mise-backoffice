-- Migration 236: Fahrer-Pünktlichkeit + Schicht-Vergleich + Liefergebiet-Prüfung
-- Phase 1502–1506

-- Fahrer-Pünktlichkeits-Snapshots für Trend-Analyse
CREATE TABLE IF NOT EXISTS fahrer_puenktlichkeits_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL,
  fahrer_id      UUID NOT NULL,
  datum          DATE NOT NULL DEFAULT CURRENT_DATE,
  score_pct      INTEGER NOT NULL CHECK (score_pct BETWEEN 0 AND 100),
  puenktlich     INTEGER NOT NULL DEFAULT 0,
  gesamt         INTEGER NOT NULL DEFAULT 0,
  trend          TEXT CHECK (trend IN ('besser', 'gleich', 'schlechter')),
  erfasst_am     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fahrer_puenktl_snap_location
  ON fahrer_puenktlichkeits_snapshots (location_id, datum DESC);

CREATE INDEX IF NOT EXISTS idx_fahrer_puenktl_snap_fahrer
  ON fahrer_puenktlichkeits_snapshots (fahrer_id, datum DESC);

-- Schicht-Vergleich-Log je Fahrer
CREATE TABLE IF NOT EXISTS schicht_vergleichs_log (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fahrer_id                UUID NOT NULL,
  datum                    DATE NOT NULL DEFAULT CURRENT_DATE,
  stopps_heute             INTEGER NOT NULL DEFAULT 0,
  stopps_vorwoche          INTEGER NOT NULL DEFAULT 0,
  verdienst_heute_eur      NUMERIC(10,2) NOT NULL DEFAULT 0,
  verdienst_vorwoche_eur   NUMERIC(10,2) NOT NULL DEFAULT 0,
  km_heute                 NUMERIC(8,2) NOT NULL DEFAULT 0,
  km_vorwoche              NUMERIC(8,2) NOT NULL DEFAULT 0,
  lieferzeit_heute_min     INTEGER NOT NULL DEFAULT 0,
  lieferzeit_vorwoche_min  INTEGER NOT NULL DEFAULT 0,
  erfasst_am               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schicht_vergleich_fahrer
  ON schicht_vergleichs_log (fahrer_id, datum DESC);

-- Liefergebiet-Prüfungs-Log (für Analytics)
CREATE TABLE IF NOT EXISTS liefergebiet_pruefungs_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  UUID NOT NULL,
  plz          TEXT NOT NULL,
  status       TEXT CHECK (status IN ('lieferbar', 'alternatives', 'nicht_lieferbar')),
  zone_name    TEXT,
  geprueft_am  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_liefer_pruef_log_location
  ON liefergebiet_pruefungs_log (location_id, geprueft_am DESC);

CREATE INDEX IF NOT EXISTS idx_liefer_pruef_log_plz
  ON liefergebiet_pruefungs_log (plz, geprueft_am DESC);

-- Bestellstatus-Ampel-Log (für Phase 1503)
CREATE TABLE IF NOT EXISTS bestellstatus_ampel_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL,
  ampel_status  TEXT CHECK (ampel_status IN ('gruen', 'gelb', 'rot')),
  pending_count INTEGER NOT NULL DEFAULT 0,
  preparing_count INTEGER NOT NULL DEFAULT 0,
  ready_count   INTEGER NOT NULL DEFAULT 0,
  erfasst_am    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bestellstatus_ampel_location
  ON bestellstatus_ampel_log (location_id, erfasst_am DESC);
