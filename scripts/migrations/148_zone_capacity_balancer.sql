-- Migration 148: Zone Capacity Balancer
-- Dynamische Fahrer-Zonen-Steuerung bei Surge / Kapazitätsengpässen
-- Phase 307

-- Snapshots: Zonen-Auslastung alle 5 Min
CREATE TABLE IF NOT EXISTS zone_capacity_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    TEXT NOT NULL,
  zone           TEXT NOT NULL,
  snapshot_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pending_orders INT  NOT NULL DEFAULT 0,
  active_orders  INT  NOT NULL DEFAULT 0,
  idle_drivers   INT  NOT NULL DEFAULT 0,
  busy_drivers   INT  NOT NULL DEFAULT 0,
  capacity_score NUMERIC(5,2),        -- 0 = überlastet, 100 = optimal, >100 = unterausgelastet
  demand_score   NUMERIC(5,2),        -- normierter Nachfragedruck 0–100
  imbalance_flag BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zcs_location_at
  ON zone_capacity_snapshots (location_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_zcs_imbalance
  ON zone_capacity_snapshots (location_id, imbalance_flag, snapshot_at DESC);

-- Rebalancing-Empfehlungen: Fahrer verschieben
CREATE TABLE IF NOT EXISTS zone_rebalancing_suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       TEXT NOT NULL,
  suggested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  from_zone         TEXT,                 -- NULL = aktuell idle / keine feste Zone
  to_zone           TEXT NOT NULL,
  driver_id         UUID,
  driver_name       TEXT,
  reason            TEXT NOT NULL,        -- z.B. "Zone A: 8 Bestellungen, 0 freie Fahrer"
  urgency           TEXT NOT NULL DEFAULT 'normal'  -- normal | high | critical
    CHECK (urgency IN ('normal', 'high', 'critical')),
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'dismissed', 'auto_applied')),
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zrs_location_status
  ON zone_rebalancing_suggestions (location_id, status, suggested_at DESC);

CREATE INDEX IF NOT EXISTS idx_zrs_driver
  ON zone_rebalancing_suggestions (driver_id, status);

-- RLS
ALTER TABLE zone_capacity_snapshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_rebalancing_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_own_location" ON zone_capacity_snapshots
  USING (location_id = current_setting('request.jwt.claims', true)::jsonb ->> 'location_id');

CREATE POLICY "admin_own_location" ON zone_rebalancing_suggestions
  USING (location_id = current_setting('request.jwt.claims', true)::jsonb ->> 'location_id');

-- View: aktuellste Zonen-Kapazitäten
CREATE OR REPLACE VIEW v_zone_capacity_latest AS
  SELECT DISTINCT ON (location_id, zone)
    id, location_id, zone, snapshot_at,
    pending_orders, active_orders, idle_drivers, busy_drivers,
    capacity_score, demand_score, imbalance_flag
  FROM zone_capacity_snapshots
  ORDER BY location_id, zone, snapshot_at DESC;

-- View: offene Rebalancing-Empfehlungen
CREATE OR REPLACE VIEW v_zone_rebalancing_pending AS
  SELECT s.*, d.name AS driver_full_name
  FROM zone_rebalancing_suggestions s
  LEFT JOIN mise_drivers d ON d.id = s.driver_id
  WHERE s.status = 'pending'
  ORDER BY
    CASE s.urgency WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
    s.suggested_at DESC;

-- Prune-Funktion: Snapshots älter als N Tage löschen
CREATE OR REPLACE FUNCTION prune_zone_capacity_snapshots(days_old INT DEFAULT 7)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  deleted INT;
BEGIN
  DELETE FROM zone_capacity_snapshots
  WHERE snapshot_at < NOW() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- updated_at Trigger für Rebalancing-Suggestions
CREATE OR REPLACE FUNCTION touch_zone_rebalancing_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_zrs_updated_at ON zone_rebalancing_suggestions;
CREATE TRIGGER trg_zrs_updated_at
  BEFORE UPDATE ON zone_rebalancing_suggestions
  FOR EACH ROW EXECUTE FUNCTION touch_zone_rebalancing_updated_at();
