-- Migration 072: Smart Order Flow Intelligence & Real-time Anomaly Detector
-- Phase 118 — 2026-06-13
--
-- Tracks order-flow velocity in 5-min snapshots and surfaces anomalies
-- (volume spikes/drops, cancellation surges, driver shortages) automatically.

-- ─── Tabellen ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_flow_snapshots (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id               UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  snapshot_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Current window metrics
  orders_last_5min          INTEGER     NOT NULL DEFAULT 0,
  orders_last_15min         INTEGER     NOT NULL DEFAULT 0,
  orders_last_60min         INTEGER     NOT NULL DEFAULT 0,
  cancellations_last_30min  INTEGER     NOT NULL DEFAULT 0,
  failed_deliveries_30min   INTEGER     NOT NULL DEFAULT 0,
  drivers_online            INTEGER     NOT NULL DEFAULT 0,
  avg_eta_min               NUMERIC(5,1),
  -- Historical baseline
  expected_per_5min         NUMERIC(6,3) DEFAULT 0,   -- 4-week rolling avg same weekday+hour
  z_score                   NUMERIC(6,2) DEFAULT 0,   -- deviation from expected
  -- Anomaly classification
  anomaly_type              TEXT        NOT NULL DEFAULT 'none',
  -- CHECK: none | volume_spike | volume_drop | cancellation_surge | failure_cluster | driver_shortage
  UNIQUE (location_id, snapshot_at)
);

CREATE TABLE IF NOT EXISTS flow_anomaly_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ,
  anomaly_type  TEXT        NOT NULL,
  severity      TEXT        NOT NULL DEFAULT 'low',  -- low | medium | high | critical
  z_score       NUMERIC(6,2),
  metrics       JSONB       NOT NULL DEFAULT '{}',
  auto_action   TEXT        NOT NULL DEFAULT 'none', -- none | alert_created | incident_created
  notes         TEXT
);

-- ─── Indizes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_flow_snapshots_loc_time
  ON order_flow_snapshots (location_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_flow_snapshots_anomaly
  ON order_flow_snapshots (location_id, anomaly_type)
  WHERE anomaly_type != 'none';

CREATE INDEX IF NOT EXISTS idx_flow_anomaly_loc_detected
  ON flow_anomaly_events (location_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_flow_anomaly_active
  ON flow_anomaly_events (location_id)
  WHERE resolved_at IS NULL;

-- ─── Views ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_flow_anomaly_recent AS
SELECT
  e.id,
  e.location_id,
  l.name                                                            AS location_name,
  e.detected_at,
  e.resolved_at,
  e.anomaly_type,
  e.severity,
  e.z_score,
  e.metrics,
  e.auto_action,
  e.notes,
  (e.resolved_at IS NULL)                                           AS is_active,
  ROUND(EXTRACT(EPOCH FROM (NOW() - e.detected_at)) / 60)::INTEGER AS minutes_ago
FROM flow_anomaly_events e
JOIN locations          l ON l.id = e.location_id
WHERE e.detected_at > NOW() - INTERVAL '48 hours'
ORDER BY e.detected_at DESC;

-- Hourly aggregation of snapshots for the trend chart (last 24 h)
CREATE OR REPLACE VIEW v_flow_trend_24h AS
SELECT
  location_id,
  DATE_TRUNC('hour', snapshot_at)                      AS hour_bucket,
  ROUND(AVG(orders_last_5min)::NUMERIC, 1)             AS avg_orders_5min,
  ROUND(AVG(expected_per_5min)::NUMERIC, 2)            AS avg_expected,
  ROUND(AVG(z_score)::NUMERIC, 2)                      AS avg_z_score,
  MAX(ABS(COALESCE(z_score, 0)))                       AS max_z_score,
  SUM(orders_last_5min)                                AS total_orders_in_hour,
  SUM(CASE WHEN anomaly_type != 'none' THEN 1 ELSE 0 END) AS anomaly_count,
  COUNT(*)                                             AS snapshot_count
FROM order_flow_snapshots
WHERE snapshot_at > NOW() - INTERVAL '24 hours'
GROUP BY location_id, DATE_TRUNC('hour', snapshot_at)
ORDER BY location_id, hour_bucket;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE order_flow_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_anomaly_events   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_flow_snapshots"  ON order_flow_snapshots;
DROP POLICY IF EXISTS "service_flow_anomalies"  ON flow_anomaly_events;

CREATE POLICY "service_flow_snapshots" ON order_flow_snapshots
  USING (auth.role() = 'service_role');

CREATE POLICY "service_flow_anomalies" ON flow_anomaly_events
  USING (auth.role() = 'service_role');

-- ─── Cleanup-Funktion ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_old_flow_snapshots()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM order_flow_snapshots
  WHERE snapshot_at < NOW() - INTERVAL '14 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
