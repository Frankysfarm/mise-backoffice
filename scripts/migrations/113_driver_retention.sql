-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 113: Smart Driver Retention Score Engine — Phase 223
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Driver Retention Scores ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_retention_scores (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id    UUID        NOT NULL,
  driver_id      UUID        NOT NULL,
  score_date     DATE        NOT NULL DEFAULT CURRENT_DATE,

  -- composite score 0–100 (higher = more retained)
  retention_score      NUMERIC(5,2)  NOT NULL CHECK (retention_score BETWEEN 0 AND 100),
  retention_tier       TEXT          NOT NULL CHECK (retention_tier IN ('stable','monitor','at_risk','churning')),

  -- component scores (each 0–100 before weighting)
  shift_freq_score     NUMERIC(5,2)  NOT NULL DEFAULT 50,  -- 25 % weight
  tip_trend_score      NUMERIC(5,2)  NOT NULL DEFAULT 50,  -- 20 % weight
  incentive_score      NUMERIC(5,2)  NOT NULL DEFAULT 50,  -- 20 % weight
  ontime_trend_score   NUMERIC(5,2)  NOT NULL DEFAULT 50,  -- 20 % weight
  noshow_score         NUMERIC(5,2)  NOT NULL DEFAULT 50,  -- 15 % weight

  -- raw signals stored for debugging / trend
  shifts_last_30d      INT           NOT NULL DEFAULT 0,
  shifts_prev_30d      INT           NOT NULL DEFAULT 0,
  tip_eur_last_14d     NUMERIC(8,2)  NOT NULL DEFAULT 0,
  tip_eur_prev_14d     NUMERIC(8,2)  NOT NULL DEFAULT 0,
  incentive_eur_30d    NUMERIC(8,2)  NOT NULL DEFAULT 0,
  ontime_rate_last_14d NUMERIC(5,4)  NOT NULL DEFAULT 0,
  ontime_rate_prev_14d NUMERIC(5,4)  NOT NULL DEFAULT 0,
  review_flags_open    INT           NOT NULL DEFAULT 0,
  noshow_count_14d     INT           NOT NULL DEFAULT 0,

  -- action tracking
  action_taken         TEXT          CHECK (action_taken IN ('bonus_sent','message_sent','manual_check','none')),
  action_taken_at      TIMESTAMPTZ,
  action_taken_by      UUID,
  credit_id            UUID,
  credit_eur           NUMERIC(6,2),

  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (location_id, driver_id, score_date)
);

ALTER TABLE driver_retention_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON driver_retention_scores
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_drs_location_date
  ON driver_retention_scores (location_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_drs_driver_date
  ON driver_retention_scores (driver_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_drs_tier
  ON driver_retention_scores (location_id, retention_tier, score_date DESC);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION set_drs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trig_drs_updated_at ON driver_retention_scores;
CREATE TRIGGER trig_drs_updated_at
  BEFORE UPDATE ON driver_retention_scores
  FOR EACH ROW EXECUTE FUNCTION set_drs_updated_at();

-- ── 2. VIEW: at-risk drivers with latest score ───────────────────────────────
CREATE OR REPLACE VIEW v_drivers_retention_risk AS
SELECT
  drs.id,
  drs.location_id,
  drs.driver_id,
  drs.score_date,
  drs.retention_score,
  drs.retention_tier,
  drs.shift_freq_score,
  drs.tip_trend_score,
  drs.incentive_score,
  drs.ontime_trend_score,
  drs.noshow_score,
  drs.shifts_last_30d,
  drs.shifts_prev_30d,
  drs.tip_eur_last_14d,
  drs.tip_eur_prev_14d,
  drs.incentive_eur_30d,
  drs.ontime_rate_last_14d,
  drs.ontime_rate_prev_14d,
  drs.review_flags_open,
  drs.noshow_count_14d,
  drs.action_taken,
  drs.action_taken_at,
  drs.credit_eur,
  d.name          AS driver_name,
  d.phone         AS driver_phone,
  d.vehicle_type  AS vehicle_type,
  d.state         AS driver_state
FROM driver_retention_scores drs
JOIN (
  SELECT DISTINCT ON (driver_id) driver_id, score_date AS latest_date
  FROM driver_retention_scores
  ORDER BY driver_id, score_date DESC
) latest ON drs.driver_id = latest.driver_id AND drs.score_date = latest.latest_date
JOIN mise_drivers d ON d.id = drs.driver_id
WHERE drs.retention_tier IN ('at_risk', 'churning');

-- ── 3. VIEW: location-level retention overview ───────────────────────────────
CREATE OR REPLACE VIEW v_retention_overview AS
SELECT
  drs.location_id,
  drs.score_date,
  COUNT(*)                                                              AS drivers_scored,
  COUNT(*) FILTER (WHERE drs.retention_tier = 'stable')                AS count_stable,
  COUNT(*) FILTER (WHERE drs.retention_tier = 'monitor')               AS count_monitor,
  COUNT(*) FILTER (WHERE drs.retention_tier = 'at_risk')               AS count_at_risk,
  COUNT(*) FILTER (WHERE drs.retention_tier = 'churning')              AS count_churning,
  ROUND(AVG(drs.retention_score), 1)                                   AS avg_score,
  COUNT(*) FILTER (WHERE drs.action_taken IS NOT NULL
                     AND drs.action_taken <> 'none')                   AS actions_taken
FROM driver_retention_scores drs
JOIN (
  SELECT location_id, MAX(score_date) AS latest
  FROM driver_retention_scores
  GROUP BY location_id
) lat ON drs.location_id = lat.location_id AND drs.score_date = lat.latest
GROUP BY drs.location_id, drs.score_date;

-- ── 4. Cleanup RPC ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_retention_scores(days_to_keep INT DEFAULT 90)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted INT;
BEGIN
  DELETE FROM driver_retention_scores
  WHERE score_date < CURRENT_DATE - days_to_keep;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
