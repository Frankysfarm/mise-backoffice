-- Migration 118: Smart Delivery Capacity Forecast (Phase 228)
-- 7-day ahead prediction: order volume + driver utilization

CREATE TABLE IF NOT EXISTS capacity_forecast_snapshots (
  id                        uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id               uuid          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_date             date          NOT NULL,
  day_of_week               int           NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  expected_orders           numeric(8,1)  NOT NULL DEFAULT 0,
  expected_orders_low       numeric(8,1)  NOT NULL DEFAULT 0,
  expected_orders_high      numeric(8,1)  NOT NULL DEFAULT 0,
  recommended_drivers       int           NOT NULL DEFAULT 0,
  predicted_utilization_pct numeric(5,1)  NOT NULL DEFAULT 0,
  trend_factor              numeric(6,3)  NOT NULL DEFAULT 1.000,
  confidence_score          int           NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  is_peak_day               boolean       NOT NULL DEFAULT false,
  peak_hour_start           int           CHECK (peak_hour_start BETWEEN 0 AND 23),
  peak_hour_end             int           CHECK (peak_hour_end BETWEEN 0 AND 23),
  data_points               int           NOT NULL DEFAULT 0,
  active_drivers            int           NOT NULL DEFAULT 0,
  computed_at               timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (location_id, forecast_date)
);

ALTER TABLE capacity_forecast_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_capacity_forecast" ON capacity_forecast_snapshots
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_cap_forecast_loc_date
  ON capacity_forecast_snapshots (location_id, forecast_date);

CREATE INDEX IF NOT EXISTS idx_cap_forecast_computed
  ON capacity_forecast_snapshots (location_id, computed_at DESC);

-- Latest 7-day view per location
CREATE OR REPLACE VIEW v_capacity_forecast_7d AS
SELECT DISTINCT ON (location_id, forecast_date)
  id, location_id, forecast_date, day_of_week,
  expected_orders, expected_orders_low, expected_orders_high,
  recommended_drivers, predicted_utilization_pct, trend_factor,
  confidence_score, is_peak_day, peak_hour_start, peak_hour_end,
  data_points, active_drivers, computed_at
FROM capacity_forecast_snapshots
WHERE forecast_date >= CURRENT_DATE
ORDER BY location_id, forecast_date, computed_at DESC;

-- Cleanup RPC
CREATE OR REPLACE FUNCTION prune_old_capacity_forecasts(days_to_keep int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM capacity_forecast_snapshots
  WHERE computed_at < now() - (days_to_keep || ' days')::interval;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
