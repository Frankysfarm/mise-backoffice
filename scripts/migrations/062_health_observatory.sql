-- =============================================================
-- Migration 062: Health Observatory
-- Delivery-System-Gesundheitsmonitoring + Integritäts-Audit
-- =============================================================

-- 1. Periodische Operational-KPI-Snapshots pro Location
CREATE TABLE IF NOT EXISTS delivery_health_snapshots (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      text         NOT NULL,
  snapshot_at      timestamptz  NOT NULL DEFAULT now(),
  drivers_online   int          NOT NULL DEFAULT 0,
  drivers_active   int          NOT NULL DEFAULT 0,
  pending_orders   int          NOT NULL DEFAULT 0,
  active_tours     int          NOT NULL DEFAULT 0,
  dispatch_queue   int          NOT NULL DEFAULT 0,
  open_alerts      int          NOT NULL DEFAULT 0,
  avg_eta_min      numeric(6,1),
  eta_accuracy_pct numeric(5,1),
  health_score     int          NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  created_at       timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_snapshots_location_time
  ON delivery_health_snapshots(location_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_snapshots_time
  ON delivery_health_snapshots(snapshot_at DESC);

ALTER TABLE delivery_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_health_snapshots
  ON delivery_health_snapshots FOR ALL
  USING (auth.role() = 'service_role');

-- 2. Multi-Tenant-Isolations-Audit-Log
CREATE TABLE IF NOT EXISTS delivery_isolation_audits (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  audited_at    timestamptz  NOT NULL DEFAULT now(),
  table_name    text         NOT NULL,
  total_rows    bigint       NOT NULL DEFAULT 0,
  orphaned_rows bigint       NOT NULL DEFAULT 0,
  severity      text         NOT NULL DEFAULT 'ok'
                CHECK (severity IN ('ok', 'warning', 'critical')),
  notes         text
);

CREATE INDEX IF NOT EXISTS idx_isolation_audits_time
  ON delivery_isolation_audits(audited_at DESC);

CREATE INDEX IF NOT EXISTS idx_isolation_audits_table
  ON delivery_isolation_audits(table_name, audited_at DESC);

ALTER TABLE delivery_isolation_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_isolation_audits
  ON delivery_isolation_audits FOR ALL
  USING (auth.role() = 'service_role');

-- 3. 24h-Trend-View: stündliche Durchschnitte pro Location
CREATE OR REPLACE VIEW v_health_trend_24h AS
SELECT
  location_id,
  date_trunc('hour', snapshot_at) AS hour_bucket,
  ROUND(AVG(drivers_online))::int    AS avg_drivers_online,
  ROUND(AVG(pending_orders))::int    AS avg_pending_orders,
  ROUND(AVG(active_tours))::int      AS avg_active_tours,
  ROUND(AVG(dispatch_queue))::int    AS avg_dispatch_queue,
  ROUND(AVG(health_score))::int      AS avg_health_score,
  MIN(health_score)::int             AS min_health_score,
  COUNT(*)::int                      AS sample_count
FROM delivery_health_snapshots
WHERE snapshot_at > now() - interval '24 hours'
GROUP BY location_id, date_trunc('hour', snapshot_at)
ORDER BY location_id, hour_bucket;

-- 4. Cleanup-Funktion: Snapshots älter als 7 Tage löschen
CREATE OR REPLACE FUNCTION prune_old_health_snapshots()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pruned int;
BEGIN
  DELETE FROM delivery_health_snapshots
  WHERE snapshot_at < now() - interval '7 days';
  GET DIAGNOSTICS pruned = ROW_COUNT;
  RETURN pruned;
END;
$$;
