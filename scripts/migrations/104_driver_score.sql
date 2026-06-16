-- Migration 104: Driver Composite Performance Score
-- Phase 205 — composite 0–100 score per driver (weekly/monthly snapshots)

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_composite_scores (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         uuid        NOT NULL,
  location_id       uuid        NOT NULL,
  period            text        NOT NULL CHECK (period IN ('week', 'month')),
  period_start      date        NOT NULL,
  composite_score   numeric(5,2) NOT NULL DEFAULT 0,
  grade             text        NOT NULL DEFAULT 'D' CHECK (grade IN ('A+','A','B','C','D')),
  f_punctuality     numeric(5,2) NOT NULL DEFAULT 0,  -- 0–30
  f_rating          numeric(5,2) NOT NULL DEFAULT 0,  -- 0–25
  f_efficiency      numeric(5,2) NOT NULL DEFAULT 0,  -- 0–15
  f_reliability     numeric(5,2) NOT NULL DEFAULT 0,  -- 0–15
  f_activity        numeric(5,2) NOT NULL DEFAULT 0,  -- 0–10
  f_volume          numeric(5,2) NOT NULL DEFAULT 0,  -- 0–5
  data_points       int         NOT NULL DEFAULT 0,
  computed_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, location_id, period, period_start)
);

CREATE INDEX IF NOT EXISTS idx_driver_composite_scores_loc_period
  ON driver_composite_scores (location_id, period, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_driver_composite_scores_driver
  ON driver_composite_scores (driver_id, location_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE driver_composite_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_read_own_location_scores"
  ON driver_composite_scores FOR SELECT
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

-- ─── Leaderboard View ─────────────────────────────────────────────────────────
-- Latest week score per driver per location

CREATE OR REPLACE VIEW v_driver_score_leaderboard_week AS
SELECT
  dcs.*,
  RANK() OVER (
    PARTITION BY dcs.location_id
    ORDER BY dcs.composite_score DESC
  ) AS score_rank
FROM driver_composite_scores dcs
WHERE
  dcs.period = 'week'
  AND dcs.period_start = (
    SELECT MAX(period_start)
    FROM driver_composite_scores
    WHERE location_id = dcs.location_id AND period = 'week'
  );

CREATE OR REPLACE VIEW v_driver_score_leaderboard_month AS
SELECT
  dcs.*,
  RANK() OVER (
    PARTITION BY dcs.location_id
    ORDER BY dcs.composite_score DESC
  ) AS score_rank
FROM driver_composite_scores dcs
WHERE
  dcs.period = 'month'
  AND dcs.period_start = (
    SELECT MAX(period_start)
    FROM driver_composite_scores
    WHERE location_id = dcs.location_id AND period = 'month'
  );
