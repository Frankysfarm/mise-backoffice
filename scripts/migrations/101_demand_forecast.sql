-- 101_demand_forecast.sql
-- Phase 201: Smart Demand Forecasting — Accuracy Tracking
-- Stores hourly forecasts and compares them with actuals for calibration

CREATE TABLE IF NOT EXISTS demand_forecast_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      text NOT NULL,
  forecast_for_hour timestamptz NOT NULL,
  forecast_at      timestamptz NOT NULL DEFAULT now(),
  weekday          smallint NOT NULL,        -- 0=So … 6=Sa
  hour_of_day      smallint NOT NULL,        -- 0–23 Berlin local time
  expected_orders  integer NOT NULL,
  confidence_orders integer NOT NULL,
  peak_orders      integer NOT NULL,
  recommended_min_drivers  integer NOT NULL,
  recommended_target_drivers integer NOT NULL,
  actual_orders    integer,                  -- filled in 1h after the slot ends
  accuracy_pct     numeric(5,2),             -- (1 - |actual-expected|/max(actual,1)) * 100
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (location_id, forecast_for_hour)
);

CREATE INDEX IF NOT EXISTS idx_dfs_location_hour
  ON demand_forecast_snapshots (location_id, forecast_for_hour DESC);
CREATE INDEX IF NOT EXISTS idx_dfs_weekday
  ON demand_forecast_snapshots (location_id, weekday, hour_of_day);
CREATE INDEX IF NOT EXISTS idx_dfs_pending_actuals
  ON demand_forecast_snapshots (location_id, forecast_for_hour)
  WHERE actual_orders IS NULL;

-- View: per weekday+hour accuracy (last 30 days)
CREATE OR REPLACE VIEW v_demand_forecast_accuracy AS
SELECT
  location_id,
  weekday,
  hour_of_day,
  COUNT(*)                                         AS data_points,
  ROUND(AVG(expected_orders)::numeric, 1)          AS avg_expected,
  ROUND(AVG(actual_orders)::numeric, 1)            AS avg_actual,
  ROUND(AVG(accuracy_pct)::numeric, 1)             AS avg_accuracy_pct,
  ROUND(STDDEV(accuracy_pct)::numeric, 1)          AS stddev_accuracy_pct,
  MAX(actual_orders)                               AS peak_actual,
  SUM(actual_orders)                               AS total_orders_30d
FROM demand_forecast_snapshots
WHERE
  actual_orders IS NOT NULL
  AND forecast_for_hour >= NOW() - INTERVAL '30 days'
GROUP BY location_id, weekday, hour_of_day;

-- View: overall accuracy summary per location
CREATE OR REPLACE VIEW v_demand_forecast_summary AS
SELECT
  location_id,
  COUNT(*)                                                              AS total_snapshots,
  COUNT(actual_orders)                                                  AS evaluated_snapshots,
  ROUND(AVG(accuracy_pct) FILTER (WHERE actual_orders IS NOT NULL)::numeric, 1)
                                                                        AS avg_accuracy_pct,
  ROUND(AVG(ABS(actual_orders - expected_orders))
        FILTER (WHERE actual_orders IS NOT NULL)::numeric, 1)          AS avg_abs_error,
  ROUND(AVG(CASE
    WHEN actual_orders IS NOT NULL AND actual_orders > 0
    THEN ABS(actual_orders - expected_orders) * 100.0 / actual_orders
    ELSE NULL
  END)::numeric, 1)                                                    AS avg_mape,
  SUM(actual_orders)   FILTER (WHERE actual_orders IS NOT NULL)        AS total_actual_orders,
  SUM(expected_orders) FILTER (WHERE actual_orders IS NOT NULL)        AS total_expected_orders,
  MIN(forecast_for_hour)                                                AS earliest_snapshot,
  MAX(forecast_for_hour)                                                AS latest_snapshot
FROM demand_forecast_snapshots
GROUP BY location_id;

-- RLS: service_role only
ALTER TABLE demand_forecast_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_demand_forecast" ON demand_forecast_snapshots;
CREATE POLICY "service_role_demand_forecast" ON demand_forecast_snapshots
  TO service_role USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_demand_forecast_snapshot_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_dfs_updated_at ON demand_forecast_snapshots;
CREATE TRIGGER trg_dfs_updated_at
  BEFORE UPDATE ON demand_forecast_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_demand_forecast_snapshot_ts();
