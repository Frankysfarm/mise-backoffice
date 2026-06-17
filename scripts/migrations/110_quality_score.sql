-- Migration 110: Smart Delivery Quality Score Engine
-- Composite daily quality score (0-100) per location, based on 5 weighted dimensions.

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: delivery_quality_scores
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_quality_scores (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  score_date           date NOT NULL,

  -- Composite score (0–100)
  overall_score        numeric(5,2) NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),

  -- Component scores (each 0–100)
  score_ontime         numeric(5,2) NOT NULL DEFAULT 0,  -- On-time delivery rate (weight 30%)
  score_satisfaction   numeric(5,2) NOT NULL DEFAULT 0,  -- Customer ratings (weight 25%)
  score_accuracy       numeric(5,2) NOT NULL DEFAULT 0,  -- Order accuracy / no complaints (weight 20%)
  score_sla            numeric(5,2) NOT NULL DEFAULT 0,  -- SLA compliance (weight 15%)
  score_cancel         numeric(5,2) NOT NULL DEFAULT 0,  -- Low cancellation rate (weight 10%)

  -- Raw metrics used for computation
  total_orders         int NOT NULL DEFAULT 0,
  ontime_orders        int NOT NULL DEFAULT 0,
  avg_rating           numeric(3,2),
  complaint_rate_pct   numeric(5,2),
  sla_breach_rate_pct  numeric(5,2),
  cancel_rate_pct      numeric(5,2),

  -- Computed grade (A/B/C/D/F)
  grade                text GENERATED ALWAYS AS (
    CASE
      WHEN overall_score >= 90 THEN 'A'
      WHEN overall_score >= 75 THEN 'B'
      WHEN overall_score >= 60 THEN 'C'
      WHEN overall_score >= 45 THEN 'D'
      ELSE 'F'
    END
  ) STORED,

  -- Weakest dimension for recommendations
  weakest_dimension    text,

  snapshotted_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, score_date)
);

CREATE INDEX IF NOT EXISTS idx_quality_scores_location_date
  ON delivery_quality_scores (location_id, score_date DESC);

CREATE INDEX IF NOT EXISTS idx_quality_scores_date
  ON delivery_quality_scores (score_date DESC);

-- RLS: service_role bypasses, managers read own
ALTER TABLE delivery_quality_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_quality_scores"
  ON delivery_quality_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- VIEW: v_quality_score_trend (last 30 days per location)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_quality_score_trend AS
SELECT
  location_id,
  score_date,
  overall_score,
  grade,
  score_ontime,
  score_satisfaction,
  score_accuracy,
  score_sla,
  score_cancel,
  total_orders
FROM delivery_quality_scores
WHERE score_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY location_id, score_date DESC;

-- ──────────────────────────────────────────────────────────────────────────────
-- VIEW: v_quality_score_ranking (latest score per location)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_quality_score_ranking AS
SELECT
  qs.location_id,
  t.name AS location_name,
  qs.score_date,
  qs.overall_score,
  qs.grade,
  qs.weakest_dimension,
  RANK() OVER (ORDER BY qs.overall_score DESC) AS rank
FROM delivery_quality_scores qs
JOIN tenants t ON t.id = qs.location_id
WHERE qs.score_date = (
  SELECT MAX(score_date) FROM delivery_quality_scores q2
  WHERE q2.location_id = qs.location_id
);

-- ──────────────────────────────────────────────────────────────────────────────
-- FUNCTION: prune_old_quality_scores
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_quality_scores(keep_days int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted int;
BEGIN
  DELETE FROM delivery_quality_scores
  WHERE score_date < CURRENT_DATE - keep_days;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
