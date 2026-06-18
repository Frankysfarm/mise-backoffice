-- Migration 114: Smart Shift Performance Prediction — Phase 224

CREATE TABLE IF NOT EXISTS shift_performance_predictions (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id           UUID        NOT NULL,
  snapshot_date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  day_of_week           SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour_bucket           SMALLINT    NOT NULL CHECK (hour_bucket BETWEEN 0 AND 23),
  predicted_driver_count   NUMERIC(5,2) NOT NULL DEFAULT 0,
  predicted_order_count    NUMERIC(5,2) NOT NULL DEFAULT 0,
  predicted_revenue_eur    NUMERIC(8,2) NOT NULL DEFAULT 0,
  confidence_score      NUMERIC(4,3) NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 1),
  actual_driver_count   INT,
  actual_order_count    INT,
  actual_revenue_eur    NUMERIC(8,2),
  data_points           INT         NOT NULL DEFAULT 0,
  signals               JSONB       NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, snapshot_date, day_of_week, hour_bucket)
);

ALTER TABLE shift_performance_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON shift_performance_predictions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_spp_location_date
  ON shift_performance_predictions (location_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_spp_location_dow_hour
  ON shift_performance_predictions (location_id, day_of_week, hour_bucket);

-- VIEW: latest predictions grouped by dow/hour
CREATE OR REPLACE VIEW v_shift_prediction_overview AS
SELECT
  spp.location_id,
  spp.day_of_week,
  spp.hour_bucket,
  spp.predicted_driver_count,
  spp.predicted_order_count,
  spp.predicted_revenue_eur,
  spp.confidence_score,
  spp.data_points,
  spp.snapshot_date
FROM shift_performance_predictions spp
WHERE spp.snapshot_date = (
  SELECT MAX(s2.snapshot_date)
  FROM shift_performance_predictions s2
  WHERE s2.location_id = spp.location_id
);

-- VIEW: accuracy (compare prediction with actuals from same weekday last week)
CREATE OR REPLACE VIEW v_shift_prediction_accuracy AS
SELECT
  location_id,
  AVG(ABS(predicted_order_count - COALESCE(actual_order_count, predicted_order_count))) AS avg_order_error,
  AVG(confidence_score) AS avg_confidence,
  COUNT(*) FILTER (WHERE actual_order_count IS NOT NULL) AS filled_actuals,
  COUNT(*) AS total_slots,
  MAX(snapshot_date) AS latest_snapshot
FROM shift_performance_predictions
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY location_id;

-- RPC: prune old predictions
CREATE OR REPLACE FUNCTION prune_old_shift_predictions(days_to_keep INT DEFAULT 90)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE deleted INT;
BEGIN
  DELETE FROM shift_performance_predictions
  WHERE snapshot_date < CURRENT_DATE - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
