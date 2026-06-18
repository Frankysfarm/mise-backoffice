-- Migration 125: Smart Order Lifecycle Funnel Analysis
-- Captures per-order timing across all 4 delivery stages:
--   Stage 1 dispatch_wait_min  : placed_at → kitchen_notified_at
--   Stage 2 kitchen_prep_min   : kitchen_notified_at → kitchen_ready_at
--   Stage 3 pickup_wait_min    : kitchen_ready_at → pickup stop completed_at
--   Stage 4 drive_min          : pickup stop completed_at → dropoff completed_at

CREATE TABLE IF NOT EXISTS order_lifecycle_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID NOT NULL,
  order_id              UUID NOT NULL UNIQUE,
  bestellnummer         TEXT,

  -- Raw timestamps (UTC)
  placed_at             TIMESTAMPTZ NOT NULL,
  kitchen_notified_at   TIMESTAMPTZ,
  kitchen_ready_at      TIMESTAMPTZ,
  pickup_completed_at   TIMESTAMPTZ,
  delivery_completed_at TIMESTAMPTZ,

  -- Stage durations (minutes, NULL if stage not yet complete)
  dispatch_wait_min     NUMERIC(6,2),
  kitchen_prep_min      NUMERIC(6,2),
  pickup_wait_min       NUMERIC(6,2),
  drive_min             NUMERIC(6,2),
  total_min             NUMERIC(6,2),

  -- Context
  zone                  TEXT,
  vehicle_type          TEXT,
  on_time               BOOLEAN,
  eta_min               NUMERIC(6,2),
  hour_of_day           SMALLINT,
  day_of_week           SMALLINT,

  snapped_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_lifecycle_location_snapped
  ON order_lifecycle_snapshots (location_id, snapped_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_lifecycle_placed
  ON order_lifecycle_snapshots (location_id, placed_at DESC);

-- RLS: service role has full access; authenticated users can read own location
ALTER TABLE order_lifecycle_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access_order_lifecycle"
  ON order_lifecycle_snapshots FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Aggregated view: stage averages per location (last 30 days)
CREATE OR REPLACE VIEW v_lifecycle_stage_averages AS
SELECT
  location_id,
  COUNT(*)                                  AS total_orders,
  ROUND(AVG(dispatch_wait_min)::NUMERIC, 1) AS avg_dispatch_wait_min,
  ROUND(AVG(kitchen_prep_min)::NUMERIC, 1)  AS avg_kitchen_prep_min,
  ROUND(AVG(pickup_wait_min)::NUMERIC, 1)   AS avg_pickup_wait_min,
  ROUND(AVG(drive_min)::NUMERIC, 1)         AS avg_drive_min,
  ROUND(AVG(total_min)::NUMERIC, 1)         AS avg_total_min,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE on_time = true) / NULLIF(COUNT(*), 0),
    1
  )                                          AS on_time_pct
FROM order_lifecycle_snapshots
WHERE snapped_at >= NOW() - INTERVAL '30 days'
GROUP BY location_id;

-- Hourly breakdown view (last 30 days)
CREATE OR REPLACE VIEW v_lifecycle_by_hour AS
SELECT
  location_id,
  hour_of_day,
  COUNT(*)                                  AS order_count,
  ROUND(AVG(dispatch_wait_min)::NUMERIC, 1) AS avg_dispatch_wait_min,
  ROUND(AVG(kitchen_prep_min)::NUMERIC, 1)  AS avg_kitchen_prep_min,
  ROUND(AVG(pickup_wait_min)::NUMERIC, 1)   AS avg_pickup_wait_min,
  ROUND(AVG(drive_min)::NUMERIC, 1)         AS avg_drive_min,
  ROUND(AVG(total_min)::NUMERIC, 1)         AS avg_total_min
FROM order_lifecycle_snapshots
WHERE snapped_at >= NOW() - INTERVAL '30 days'
  AND hour_of_day IS NOT NULL
GROUP BY location_id, hour_of_day
ORDER BY location_id, hour_of_day;

-- Prune RPC
CREATE OR REPLACE FUNCTION prune_old_order_lifecycle_snapshots(days_to_keep INT DEFAULT 60)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  deleted INT;
BEGIN
  DELETE FROM order_lifecycle_snapshots
  WHERE snapped_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
