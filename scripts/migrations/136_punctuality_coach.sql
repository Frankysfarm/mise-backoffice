-- Migration 136: Fahrer-Pünktlichkeits-Coach
-- Aggregated delay-cause profiles per driver for personalized coaching.
-- Analyzes order_lifecycle_snapshots by driver to identify bottleneck stages.

CREATE TABLE IF NOT EXISTS driver_punctuality_profiles (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id              UUID        NOT NULL,
  driver_id                UUID        NOT NULL,

  -- Analysis window
  period_start             DATE        NOT NULL,
  period_end               DATE        NOT NULL,
  analysis_days            INT         NOT NULL DEFAULT 14,

  -- Sample size
  orders_analyzed          INT         NOT NULL DEFAULT 0,
  on_time_count            INT         NOT NULL DEFAULT 0,
  on_time_rate             NUMERIC(5,2),            -- 0.00–100.00 %

  -- Stage averages for this driver (minutes)
  avg_dispatch_wait_min    NUMERIC(6,2),
  avg_kitchen_prep_min     NUMERIC(6,2),
  avg_pickup_wait_min      NUMERIC(6,2),
  avg_drive_min            NUMERIC(6,2),
  avg_total_min            NUMERIC(6,2),

  -- Delta vs. location-wide average for the same period (positive = driver is slower)
  delta_kitchen_prep_min   NUMERIC(6,2),
  delta_pickup_wait_min    NUMERIC(6,2),
  delta_drive_min          NUMERIC(6,2),

  -- Primary bottleneck stage
  primary_delay_cause      TEXT,                    -- 'kitchen' | 'pickup_wait' | 'driving' | 'none'

  -- Personalised coaching hints (ordered by priority)
  coaching_hints           JSONB        NOT NULL DEFAULT '[]',

  -- Composite punctuality coaching score (0–100, higher = better)
  coaching_score           NUMERIC(5,2),

  -- Trend vs. previous period
  score_trend              TEXT,                    -- 'improving' | 'stable' | 'declining'
  score_delta              NUMERIC(5,2),

  computed_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (location_id, driver_id, period_end)
);

CREATE INDEX IF NOT EXISTS idx_dpp_location_date
  ON driver_punctuality_profiles (location_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_dpp_driver_date
  ON driver_punctuality_profiles (driver_id, period_end DESC);

ALTER TABLE driver_punctuality_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_access_dpp"
  ON driver_punctuality_profiles FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_own_location_dpp"
  ON driver_punctuality_profiles FOR SELECT
  TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM mise_staff WHERE auth_user_id = auth.uid()
    )
  );

-- Latest profile per driver
CREATE OR REPLACE VIEW v_driver_punctuality_latest AS
SELECT DISTINCT ON (location_id, driver_id)
  dpp.*,
  md.name        AS driver_name,
  md.fahrzeug    AS vehicle_type
FROM driver_punctuality_profiles dpp
LEFT JOIN mise_drivers md ON md.id = dpp.driver_id
ORDER BY location_id, driver_id, period_end DESC;

-- Ranking: drivers sorted by coaching_score desc within each location
CREATE OR REPLACE VIEW v_driver_punctuality_ranking AS
SELECT
  dpp.location_id,
  dpp.driver_id,
  md.name                                              AS driver_name,
  md.fahrzeug                                          AS vehicle_type,
  dpp.coaching_score,
  dpp.on_time_rate,
  dpp.orders_analyzed,
  dpp.primary_delay_cause,
  dpp.score_trend,
  dpp.period_end,
  RANK() OVER (
    PARTITION BY dpp.location_id
    ORDER BY dpp.coaching_score DESC NULLS LAST
  )                                                    AS rank
FROM (
  SELECT DISTINCT ON (location_id, driver_id) *
  FROM driver_punctuality_profiles
  ORDER BY location_id, driver_id, period_end DESC
) dpp
LEFT JOIN mise_drivers md ON md.id = dpp.driver_id;

-- Prune old profiles
CREATE OR REPLACE FUNCTION prune_old_punctuality_profiles(p_days INT DEFAULT 90)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  deleted INT;
BEGIN
  DELETE FROM driver_punctuality_profiles
  WHERE period_end < CURRENT_DATE - p_days;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- Auto-update computed_at
CREATE OR REPLACE FUNCTION _trg_dpp_set_computed_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.computed_at := NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_dpp_computed_at ON driver_punctuality_profiles;
CREATE TRIGGER trg_dpp_computed_at
  BEFORE UPDATE ON driver_punctuality_profiles
  FOR EACH ROW EXECUTE FUNCTION _trg_dpp_set_computed_at();

COMMENT ON TABLE driver_punctuality_profiles IS
  'Per-driver delay-cause analysis and personalised coaching insights. '
  'Built by punctuality-coach.ts, updated daily via snapshotAllDriversCoaching().';
