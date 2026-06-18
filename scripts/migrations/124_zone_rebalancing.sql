-- Migration 124: Smart Zone Rebalancing Engine
-- Phase 237 — Automatische Umverteilung von Fahrern zwischen Zonen bei Kapazitäts-Ungleichgewicht

-- ── Zone Capacity Snapshots ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zone_capacity_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  zone_name       TEXT NOT NULL,          -- A/B/C/D
  snapshotted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active_drivers  INT  NOT NULL DEFAULT 0,
  pending_orders  INT  NOT NULL DEFAULT 0,
  active_tours    INT  NOT NULL DEFAULT 0,
  avg_wait_min    NUMERIC(6,2),
  utilization_pct NUMERIC(5,2),           -- pending_orders / max(1, active_drivers * 3) * 100
  load_level      TEXT NOT NULL DEFAULT 'normal' -- 'low' | 'normal' | 'high' | 'overloaded'
);

CREATE INDEX IF NOT EXISTS idx_zone_cap_snap_loc_at
  ON zone_capacity_snapshots(location_id, snapshotted_at DESC);
CREATE INDEX IF NOT EXISTS idx_zone_cap_snap_loc_zone
  ON zone_capacity_snapshots(location_id, zone_name, snapshotted_at DESC);

ALTER TABLE zone_capacity_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_zone_snap_read" ON zone_capacity_snapshots
  FOR SELECT USING (
    location_id IN (SELECT location_id FROM employees WHERE user_id = auth.uid())
  );

-- ── Zone Rebalancing Events ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zone_rebalancing_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger_reason  TEXT NOT NULL,          -- 'overload_zone_X' | 'manual' | 'scheduled'
  from_zone       TEXT NOT NULL,
  to_zone         TEXT NOT NULL,
  driver_ids      UUID[] NOT NULL DEFAULT '{}',
  drivers_moved   INT  NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'suggested', -- 'suggested' | 'applied' | 'dismissed'
  applied_by      UUID REFERENCES auth.users(id),
  applied_at      TIMESTAMPTZ,
  notes           TEXT,
  snapshot_before JSONB,                  -- zone loads before rebalancing
  snapshot_after  JSONB                   -- zone loads after rebalancing
);

CREATE INDEX IF NOT EXISTS idx_zone_rebal_loc_at
  ON zone_rebalancing_events(location_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_zone_rebal_status
  ON zone_rebalancing_events(location_id, status);

ALTER TABLE zone_rebalancing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_zone_rebal_read" ON zone_rebalancing_events
  FOR SELECT USING (
    location_id IN (SELECT location_id FROM employees WHERE user_id = auth.uid())
  );
CREATE POLICY "employee_zone_rebal_insert" ON zone_rebalancing_events
  FOR INSERT WITH CHECK (
    location_id IN (SELECT location_id FROM employees WHERE user_id = auth.uid())
  );
CREATE POLICY "employee_zone_rebal_update" ON zone_rebalancing_events
  FOR UPDATE USING (
    location_id IN (SELECT location_id FROM employees WHERE user_id = auth.uid())
  );

-- ── Views ─────────────────────────────────────────────────────────────────────

-- Current zone utilization (latest snapshot per zone per location)
CREATE OR REPLACE VIEW v_zone_utilization_current AS
SELECT DISTINCT ON (location_id, zone_name)
  location_id,
  zone_name,
  snapshotted_at,
  active_drivers,
  pending_orders,
  active_tours,
  avg_wait_min,
  utilization_pct,
  load_level
FROM zone_capacity_snapshots
ORDER BY location_id, zone_name, snapshotted_at DESC;

-- Unresolved rebalancing suggestions
CREATE OR REPLACE VIEW v_pending_rebalancing AS
SELECT *
FROM zone_rebalancing_events
WHERE status = 'suggested'
ORDER BY triggered_at DESC;

-- ── Prune RPC ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_zone_snapshots(days_to_keep INT DEFAULT 30)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted INT;
BEGIN
  DELETE FROM zone_capacity_snapshots
  WHERE snapshotted_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
