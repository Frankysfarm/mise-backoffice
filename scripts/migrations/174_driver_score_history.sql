-- Phase 359: Driver Score History + Feedback Integration
-- Add f_feedback column to driver_composite_scores
ALTER TABLE driver_composite_scores
  ADD COLUMN IF NOT EXISTS f_feedback NUMERIC(5,2) NOT NULL DEFAULT 0;

-- Weekly snapshot history table
CREATE TABLE IF NOT EXISTS driver_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'week',
  period_start DATE NOT NULL,
  composite_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'D',
  f_punctuality NUMERIC(5,2) NOT NULL DEFAULT 0,
  f_rating NUMERIC(5,2) NOT NULL DEFAULT 0,
  f_efficiency NUMERIC(5,2) NOT NULL DEFAULT 0,
  f_reliability NUMERIC(5,2) NOT NULL DEFAULT 0,
  f_activity NUMERIC(5,2) NOT NULL DEFAULT 0,
  f_volume NUMERIC(5,2) NOT NULL DEFAULT 0,
  f_feedback NUMERIC(5,2) NOT NULL DEFAULT 0,
  data_points INTEGER NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(location_id, driver_id, period, period_start)
);

CREATE INDEX IF NOT EXISTS idx_driver_score_history_location
  ON driver_score_history (location_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_driver_score_history_driver
  ON driver_score_history (driver_id, period_start DESC);

ALTER TABLE driver_score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON driver_score_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION prune_driver_score_history(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pruned INTEGER;
BEGIN
  DELETE FROM driver_score_history
  WHERE snapshot_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS pruned = ROW_COUNT;
  RETURN pruned;
END;
$$;
