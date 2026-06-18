-- Migration 126: Smart Delivery Geo-Heatmap Pro
-- Phase 244 — Stündliche Geo-Snapshots + GeoJSON-Export + Zonen-Auslastung

-- ── Heatmap Snapshots ──────────────────────────────────────────────────────────
-- Speichert stündliche Dichte-Snapshots nach 0.01°-Gitterzellen (~1 km).
-- date_bucket = date_trunc('hour', snapshotted_at) für stabile UPSERTs.

CREATE TABLE IF NOT EXISTS heatmap_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date_bucket     TIMESTAMPTZ NOT NULL,                        -- date_trunc('hour', now())
  hour_of_day     SMALLINT    NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  day_of_week     SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Mo
  grid_lat        NUMERIC(8,4) NOT NULL,
  grid_lng        NUMERIC(8,4) NOT NULL,
  order_count     INT         NOT NULL DEFAULT 1,
  zone            TEXT,
  UNIQUE (location_id, date_bucket, grid_lat, grid_lng)
);

CREATE INDEX IF NOT EXISTS idx_heatmap_snap_loc_bucket
  ON heatmap_snapshots(location_id, date_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_heatmap_snap_hour_dow
  ON heatmap_snapshots(location_id, hour_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS idx_heatmap_snap_zone_bucket
  ON heatmap_snapshots(location_id, zone, date_bucket DESC);

ALTER TABLE heatmap_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_heatmap_snap_read" ON heatmap_snapshots
  FOR SELECT USING (
    location_id IN (SELECT location_id FROM employees WHERE user_id = auth.uid())
  );

CREATE POLICY "service_heatmap_snap_all" ON heatmap_snapshots
  FOR ALL USING (auth.role() = 'service_role');

-- ── Stündliche Zonen-Auslastungs-View (30-Tage Ø) ────────────────────────────
CREATE OR REPLACE VIEW v_zone_hour_utilization AS
SELECT
  location_id,
  zone,
  hour_of_day,
  day_of_week,
  COUNT(DISTINCT date_bucket)::INT           AS snap_count,
  SUM(order_count)::INT                     AS total_orders,
  ROUND(AVG(order_count)::NUMERIC, 2)       AS avg_orders_per_snap,
  MAX(order_count)                          AS peak_orders
FROM heatmap_snapshots
WHERE date_bucket >= NOW() - INTERVAL '30 days'
  AND zone IS NOT NULL
GROUP BY location_id, zone, hour_of_day, day_of_week;

-- ── Aggregierte Heatmap-View (Top-Zellen letzte 30T) ─────────────────────────
CREATE OR REPLACE VIEW v_heatmap_top_cells AS
SELECT
  location_id,
  grid_lat,
  grid_lng,
  zone,
  COUNT(DISTINCT date_bucket)::INT          AS active_days,
  SUM(order_count)::INT                     AS total_orders,
  ROUND(AVG(order_count)::NUMERIC, 2)       AS avg_per_snap,
  MAX(order_count)                          AS peak_count
FROM heatmap_snapshots
WHERE date_bucket >= NOW() - INTERVAL '30 days'
GROUP BY location_id, grid_lat, grid_lng, zone;

-- ── Prune-Funktion ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_heatmap_snapshots(days_to_keep INT DEFAULT 60)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count BIGINT;
BEGIN
  DELETE FROM heatmap_snapshots
  WHERE date_bucket < NOW() - make_interval(days => days_to_keep);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
