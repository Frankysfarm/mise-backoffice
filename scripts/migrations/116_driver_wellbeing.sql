-- Migration 116: Smart Driver Wellbeing Index
-- Phase 226 — composite burnout-prevention score per driver
-- Aggregates: fatigue + satisfaction + retention + incentive health

-- ─── Main Table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_wellbeing_snapshots (
  id              UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id     UUID         NOT NULL REFERENCES locations(id)    ON DELETE CASCADE,
  driver_id       UUID         NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  snapshot_date   DATE         NOT NULL,

  -- Composite wellbeing score (0–100, higher = better)
  wellbeing_score NUMERIC(5,1) NOT NULL DEFAULT 0,
  wellbeing_tier  TEXT         GENERATED ALWAYS AS (
    CASE
      WHEN wellbeing_score >= 80 THEN 'thriving'
      WHEN wellbeing_score >= 60 THEN 'healthy'
      WHEN wellbeing_score >= 40 THEN 'stressed'
      ELSE                            'burnout_risk'
    END
  ) STORED,

  -- Component scores (each 0–100)
  fatigue_component      NUMERIC(5,1) NOT NULL DEFAULT 50,
  satisfaction_component NUMERIC(5,1) NOT NULL DEFAULT 50,
  retention_component    NUMERIC(5,1) NOT NULL DEFAULT 50,
  incentive_component    NUMERIC(5,1) NOT NULL DEFAULT 50,

  -- Raw signals (for drill-down)
  latest_fatigue_score      NUMERIC(5,1),
  latest_satisfaction_score NUMERIC(5,1),
  latest_retention_score    NUMERIC(5,1),
  incentive_eur_7d          NUMERIC(10,2),

  -- Intervention tracking
  intervention_triggered BOOLEAN      NOT NULL DEFAULT FALSE,
  intervention_type      TEXT,         -- 'rest_suggestion' | 'bonus' | 'message'
  intervention_at        TIMESTAMPTZ,
  intervention_by        UUID         REFERENCES auth.users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (location_id, driver_id, snapshot_date)
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_wellbeing_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_wellbeing_updated_at
  BEFORE UPDATE ON driver_wellbeing_snapshots
  FOR EACH ROW EXECUTE FUNCTION set_wellbeing_updated_at();

-- ─── Performance Indexes ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_wellbeing_location_date
  ON driver_wellbeing_snapshots (location_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_wellbeing_driver_date
  ON driver_wellbeing_snapshots (driver_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_wellbeing_tier
  ON driver_wellbeing_snapshots (location_id, wellbeing_tier, snapshot_date DESC);

-- ─── Views ────────────────────────────────────────────────────────────────────

-- Latest snapshot per driver per location (for dashboard overview)
CREATE OR REPLACE VIEW v_driver_wellbeing_overview AS
SELECT
  w.location_id,
  COUNT(*)                                                  AS total_drivers,
  ROUND(AVG(w.wellbeing_score), 1)                          AS avg_wellbeing_score,
  COUNT(*) FILTER (WHERE w.wellbeing_tier = 'thriving')     AS thriving_count,
  COUNT(*) FILTER (WHERE w.wellbeing_tier = 'healthy')      AS healthy_count,
  COUNT(*) FILTER (WHERE w.wellbeing_tier = 'stressed')     AS stressed_count,
  COUNT(*) FILTER (WHERE w.wellbeing_tier = 'burnout_risk') AS burnout_risk_count,
  COUNT(*) FILTER (WHERE w.intervention_triggered = TRUE
                     AND w.snapshot_date = CURRENT_DATE)    AS interventions_today
FROM driver_wellbeing_snapshots w
WHERE w.snapshot_date = (
  SELECT MAX(w2.snapshot_date)
  FROM driver_wellbeing_snapshots w2
  WHERE w2.location_id = w.location_id
)
GROUP BY w.location_id;

-- Leaderboard: all drivers ranked by wellbeing score (latest snapshot)
CREATE OR REPLACE VIEW v_driver_wellbeing_leaderboard AS
SELECT
  w.*,
  d.name                AS driver_name,
  d.auth_user_id,
  d.vehicle_type,
  RANK() OVER (PARTITION BY w.location_id ORDER BY w.wellbeing_score DESC) AS wellbeing_rank
FROM driver_wellbeing_snapshots w
JOIN mise_drivers d ON d.id = w.driver_id
WHERE w.snapshot_date = (
  SELECT MAX(w2.snapshot_date)
  FROM driver_wellbeing_snapshots w2
  WHERE w2.location_id = w.location_id
    AND w2.driver_id   = w.driver_id
);

-- ─── Prune Function ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_old_wellbeing_snapshots(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM driver_wellbeing_snapshots
  WHERE snapshot_date < CURRENT_DATE - days_to_keep;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE driver_wellbeing_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_wellbeing"
  ON driver_wellbeing_snapshots FOR ALL
  TO service_role USING (TRUE) WITH CHECK (TRUE);
