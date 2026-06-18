-- Migration 115: Live Driver Satisfaction Score — Phase 225

CREATE TABLE IF NOT EXISTS driver_satisfaction_scores (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id         UUID        NOT NULL,
  driver_id           UUID        NOT NULL,
  score_date          DATE        NOT NULL DEFAULT CURRENT_DATE,

  satisfaction_score  NUMERIC(5,2) NOT NULL CHECK (satisfaction_score BETWEEN 0 AND 100),
  satisfaction_tier   TEXT        NOT NULL CHECK (satisfaction_tier IN ('excellent','good','fair','poor')),

  retention_component   NUMERIC(5,2) NOT NULL DEFAULT 50,
  incentive_component   NUMERIC(5,2) NOT NULL DEFAULT 50,
  rating_component      NUMERIC(5,2) NOT NULL DEFAULT 50,
  ontime_component      NUMERIC(5,2) NOT NULL DEFAULT 50,

  retention_score_raw   NUMERIC(5,2),
  incentive_eur_7d      NUMERIC(8,2) NOT NULL DEFAULT 0,
  avg_rating_30d        NUMERIC(4,2),
  ontime_rate_14d       NUMERIC(5,4) NOT NULL DEFAULT 0,
  deliveries_7d         INT         NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (location_id, driver_id, score_date)
);

ALTER TABLE driver_satisfaction_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON driver_satisfaction_scores
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_dss_location_date
  ON driver_satisfaction_scores (location_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_dss_driver_date
  ON driver_satisfaction_scores (driver_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_dss_tier
  ON driver_satisfaction_scores (location_id, satisfaction_tier, score_date DESC);

CREATE OR REPLACE FUNCTION set_dss_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trig_dss_updated_at ON driver_satisfaction_scores;
CREATE TRIGGER trig_dss_updated_at
  BEFORE UPDATE ON driver_satisfaction_scores
  FOR EACH ROW EXECUTE FUNCTION set_dss_updated_at();

-- VIEW: tier overview per location (latest scores)
CREATE OR REPLACE VIEW v_driver_satisfaction_overview AS
SELECT
  dss.location_id,
  COUNT(*) AS total_drivers,
  COUNT(*) FILTER (WHERE dss.satisfaction_tier = 'excellent') AS excellent_count,
  COUNT(*) FILTER (WHERE dss.satisfaction_tier = 'good') AS good_count,
  COUNT(*) FILTER (WHERE dss.satisfaction_tier = 'fair') AS fair_count,
  COUNT(*) FILTER (WHERE dss.satisfaction_tier = 'poor') AS poor_count,
  AVG(dss.satisfaction_score) AS avg_satisfaction,
  MAX(dss.score_date) AS latest_score_date
FROM driver_satisfaction_scores dss
WHERE dss.score_date = (
  SELECT MAX(d2.score_date)
  FROM driver_satisfaction_scores d2
  WHERE d2.location_id = dss.location_id
)
GROUP BY dss.location_id;

-- VIEW: leaderboard with rank
CREATE OR REPLACE VIEW v_driver_satisfaction_leaderboard AS
SELECT
  dss.id,
  dss.location_id,
  dss.driver_id,
  dss.score_date,
  dss.satisfaction_score,
  dss.satisfaction_tier,
  dss.retention_component,
  dss.incentive_component,
  dss.rating_component,
  dss.ontime_component,
  dss.incentive_eur_7d,
  dss.avg_rating_30d,
  dss.ontime_rate_14d,
  dss.deliveries_7d,
  d.name AS driver_name,
  d.phone AS driver_phone,
  d.vehicle_type,
  RANK() OVER (PARTITION BY dss.location_id ORDER BY dss.satisfaction_score DESC) AS rank_position
FROM driver_satisfaction_scores dss
JOIN mise_drivers d ON d.id = dss.driver_id
WHERE dss.score_date = (
  SELECT MAX(d3.score_date)
  FROM driver_satisfaction_scores d3
  WHERE d3.location_id = dss.location_id
);

-- RPC: prune old scores
CREATE OR REPLACE FUNCTION prune_old_satisfaction_scores(days_to_keep INT DEFAULT 90)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE deleted INT;
BEGIN
  DELETE FROM driver_satisfaction_scores
  WHERE score_date < CURRENT_DATE - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
