-- Migration 184: Driver Score Daily Snapshots + Performance Drop Alerts
-- Phase 385

-- ── 1. driver_score_daily_snapshots ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_score_daily_snapshots (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       uuid         NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id     uuid         NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  snapshot_date   date         NOT NULL,
  composite_score numeric(6,2) NOT NULL DEFAULT 0,
  grade           text         NOT NULL DEFAULT 'D'
    CHECK(grade IN ('A+','A','B','C','D')),
  f_punctuality   numeric(6,2) NOT NULL DEFAULT 0,
  f_rating        numeric(6,2) NOT NULL DEFAULT 0,
  f_efficiency    numeric(6,2) NOT NULL DEFAULT 0,
  f_reliability   numeric(6,2) NOT NULL DEFAULT 0,
  f_activity      numeric(6,2) NOT NULL DEFAULT 0,
  f_volume        numeric(6,2) NOT NULL DEFAULT 0,
  f_feedback      numeric(6,2) NOT NULL DEFAULT 0,
  data_points     int          NOT NULL DEFAULT 0,
  window_days     int          NOT NULL DEFAULT 7,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(driver_id, location_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_dsds_location_date
  ON driver_score_daily_snapshots(location_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_dsds_driver_date
  ON driver_score_daily_snapshots(driver_id, snapshot_date DESC);

CREATE OR REPLACE FUNCTION touch_driver_score_daily_snapshots()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_dsds_updated_at ON driver_score_daily_snapshots;
CREATE TRIGGER trg_dsds_updated_at
  BEFORE UPDATE ON driver_score_daily_snapshots
  FOR EACH ROW EXECUTE FUNCTION touch_driver_score_daily_snapshots();

-- ── 2. driver_score_drop_alerts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_score_drop_alerts (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       uuid         NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id     uuid         NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  alert_date      date         NOT NULL,
  score_today     numeric(6,2) NOT NULL,
  score_baseline  numeric(6,2) NOT NULL,
  drop_magnitude  numeric(6,2) NOT NULL,
  grade_today     text         NOT NULL DEFAULT 'D',
  grade_baseline  text         NOT NULL DEFAULT 'D',
  alert_type      text         NOT NULL DEFAULT 'significant_drop'
    CHECK(alert_type IN ('significant_drop','consecutive_decline','grade_regression')),
  acknowledged    boolean      NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  acknowledged_by uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  UNIQUE(driver_id, location_id, alert_date, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_dsda_location_ack
  ON driver_score_drop_alerts(location_id, acknowledged, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dsda_driver_date
  ON driver_score_drop_alerts(driver_id, alert_date DESC);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE driver_score_daily_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full dsds" ON driver_score_daily_snapshots;
CREATE POLICY "service_role full dsds" ON driver_score_daily_snapshots
  TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated read dsds" ON driver_score_daily_snapshots;
CREATE POLICY "authenticated read dsds" ON driver_score_daily_snapshots
  FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM mise_staff WHERE user_id = auth.uid()
  ));

ALTER TABLE driver_score_drop_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full dsda" ON driver_score_drop_alerts;
CREATE POLICY "service_role full dsda" ON driver_score_drop_alerts
  TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated read dsda" ON driver_score_drop_alerts;
CREATE POLICY "authenticated read dsda" ON driver_score_drop_alerts
  FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM mise_staff WHERE user_id = auth.uid()
  ));

-- ── 4. Prune RPCs ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_driver_score_daily_snapshots(days_to_keep int DEFAULT 90)
  RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM driver_score_daily_snapshots
   WHERE snapshot_date < (CURRENT_DATE - days_to_keep);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

CREATE OR REPLACE FUNCTION prune_driver_score_drop_alerts(days_to_keep int DEFAULT 60)
  RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM driver_score_drop_alerts
   WHERE alert_date < (CURRENT_DATE - days_to_keep)
     AND acknowledged = true;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ── 5. View: daily score trend ────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_driver_score_daily_trend AS
SELECT
  s.driver_id,
  s.location_id,
  md.name         AS driver_name,
  md.vehicle,
  s.snapshot_date,
  s.composite_score,
  s.grade,
  s.f_punctuality,
  s.f_rating,
  s.f_efficiency,
  s.data_points
FROM driver_score_daily_snapshots s
JOIN mise_drivers md ON md.id = s.driver_id
ORDER BY s.driver_id, s.snapshot_date DESC;
