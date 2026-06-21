-- Migration 185: Driver Score Weekly Benchmarks
-- Phase 387 — Wöchentliche Standort-Durchschnitte aller 7 Score-Faktoren
-- Ermöglicht Benchmark-Vergleich: Fahrer vs. Standort-Ø

CREATE TABLE IF NOT EXISTS driver_score_weekly_benchmarks (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         uuid         NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  week_start          date         NOT NULL,
  driver_count        int          NOT NULL DEFAULT 0,
  avg_composite       numeric(6,2) NOT NULL DEFAULT 0,
  avg_punctuality     numeric(6,2) NOT NULL DEFAULT 0,
  avg_rating          numeric(6,2) NOT NULL DEFAULT 0,
  avg_efficiency      numeric(6,2) NOT NULL DEFAULT 0,
  avg_reliability     numeric(6,2) NOT NULL DEFAULT 0,
  avg_activity        numeric(6,2) NOT NULL DEFAULT 0,
  avg_volume          numeric(6,2) NOT NULL DEFAULT 0,
  avg_feedback        numeric(6,2) NOT NULL DEFAULT 0,
  top_score           numeric(6,2) NOT NULL DEFAULT 0,
  bottom_score        numeric(6,2) NOT NULL DEFAULT 0,
  grade_dist          jsonb        NOT NULL DEFAULT '{}',
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(location_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_dswb_location_week
  ON driver_score_weekly_benchmarks(location_id, week_start DESC);

CREATE OR REPLACE FUNCTION touch_driver_score_weekly_benchmarks()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_dswb_updated_at ON driver_score_weekly_benchmarks;
CREATE TRIGGER trg_dswb_updated_at
  BEFORE UPDATE ON driver_score_weekly_benchmarks
  FOR EACH ROW EXECUTE FUNCTION touch_driver_score_weekly_benchmarks();

ALTER TABLE driver_score_weekly_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full" ON driver_score_weekly_benchmarks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated read own location" ON driver_score_weekly_benchmarks
  FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION prune_driver_score_weekly_benchmarks(days_to_keep integer DEFAULT 365)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pruned integer;
BEGIN
  DELETE FROM driver_score_weekly_benchmarks
    WHERE created_at < now() - (days_to_keep || ' days')::interval;
  GET DIAGNOSTICS pruned = ROW_COUNT;
  RETURN pruned;
END;
$$;

-- View: letzte 12 Wochen pro Standort
CREATE OR REPLACE VIEW v_driver_score_benchmark_trend AS
SELECT
  b.*,
  rank() OVER (PARTITION BY location_id ORDER BY week_start DESC) AS week_rank
FROM driver_score_weekly_benchmarks b;
