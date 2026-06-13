-- Migration 061: Customer Churn Prevention & Re-Engagement Engine
-- Phase 101 — 2026-06-13
--
-- customer_churn_risk_scores: RFM-basierter Abwanderungsrisiko-Score pro Kunde
-- v_churn_at_risk:            Kunden mit Risiko ≥ 60, noch nicht kontaktiert (letzten 14 Tage)
-- v_churn_stats:              Aggregierte Statistiken pro Location

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabelle
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_churn_risk_scores (
  id                    UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id           TEXT    NOT NULL,
  customer_email        TEXT    NOT NULL,
  customer_name         TEXT,
  risk_score            INT     NOT NULL DEFAULT 0
                                CHECK (risk_score BETWEEN 0 AND 100),
  risk_tier             TEXT    NOT NULL DEFAULT 'safe'
                                CHECK (risk_tier IN ('safe', 'warning', 'at_risk', 'churned')),
  days_since_last_order INT,
  order_count_30d       INT     NOT NULL DEFAULT 0,
  order_count_prev30d   INT     NOT NULL DEFAULT 0,
  avg_order_value_eur   NUMERIC(8,2),
  last_order_at         TIMESTAMPTZ,
  campaign_sent_at      TIMESTAMPTZ,
  campaign_result       TEXT    CHECK (campaign_result IN ('pending', 'converted', 'no_response')),
  credit_id             UUID,
  credit_eur            NUMERIC(6,2),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (location_id, customer_email)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indizes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_churn_risk_location
  ON customer_churn_risk_scores (location_id, risk_score DESC);

CREATE INDEX IF NOT EXISTS idx_churn_risk_tier
  ON customer_churn_risk_scores (location_id, risk_tier);

CREATE INDEX IF NOT EXISTS idx_churn_campaign_sent
  ON customer_churn_risk_scores (location_id, campaign_sent_at)
  WHERE campaign_sent_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- View: Kunden mit Abwanderungsrisiko (noch nicht kontaktiert)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_churn_at_risk AS
SELECT *
FROM customer_churn_risk_scores
WHERE risk_score >= 60
  AND (
    campaign_sent_at IS NULL
    OR campaign_sent_at < NOW() - INTERVAL '14 days'
  )
ORDER BY risk_score DESC, last_order_at ASC NULLS LAST;

-- ─────────────────────────────────────────────────────────────────────────────
-- View: Aggregierte Stats pro Location
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_churn_stats AS
SELECT
  location_id,
  COUNT(*)                                                   AS total_customers,
  COUNT(*) FILTER (WHERE risk_tier = 'safe')                 AS count_safe,
  COUNT(*) FILTER (WHERE risk_tier = 'warning')              AS count_warning,
  COUNT(*) FILTER (WHERE risk_tier = 'at_risk')              AS count_at_risk,
  COUNT(*) FILTER (WHERE risk_tier = 'churned')              AS count_churned,
  COUNT(*) FILTER (WHERE campaign_sent_at IS NOT NULL)       AS campaigns_sent,
  COUNT(*) FILTER (WHERE campaign_result = 'converted')      AS win_backs,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE campaign_result = 'converted')
    / NULLIF(COUNT(*) FILTER (WHERE campaign_sent_at IS NOT NULL), 0),
    1
  )                                                          AS win_back_rate_pct,
  AVG(risk_score)::NUMERIC(5,1)                              AS avg_risk_score
FROM customer_churn_risk_scores
GROUP BY location_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE customer_churn_risk_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_churn ON customer_churn_risk_scores;
CREATE POLICY service_role_all_churn
  ON customer_churn_risk_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
