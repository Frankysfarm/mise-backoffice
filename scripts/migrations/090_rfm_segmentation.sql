-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 090: RFM Customer Segmentation Engine (Phase 178)
--
-- Segmentiert Kunden nach Recency / Frequency / Monetary Value.
-- 10 Segmente: champion | loyal | potential_loyalist | new_customer |
--              promising | needs_attention | at_risk | cant_lose |
--              hibernating | lost
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Segment-Typ ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE rfm_segment AS ENUM (
    'champion',
    'loyal',
    'potential_loyalist',
    'new_customer',
    'promising',
    'needs_attention',
    'at_risk',
    'cant_lose',
    'hibernating',
    'lost'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Haupt-Tabelle ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_rfm_profiles (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  customer_phone        text        NOT NULL,
  customer_name         text,

  -- Raw RFM-Werte
  recency_days          integer     NOT NULL CHECK (recency_days >= 0),
  frequency             integer     NOT NULL CHECK (frequency >= 1),
  monetary_eur          numeric(10,2) NOT NULL CHECK (monetary_eur >= 0),
  first_order_at        timestamptz,
  last_order_at         timestamptz,

  -- Quintil-Scores 1–5 (5 = bestes)
  r_score               smallint    NOT NULL CHECK (r_score BETWEEN 1 AND 5),
  f_score               smallint    NOT NULL CHECK (f_score BETWEEN 1 AND 5),
  m_score               smallint    NOT NULL CHECK (m_score BETWEEN 1 AND 5),
  rfm_score             smallint    NOT NULL CHECK (rfm_score BETWEEN 3 AND 15),

  segment               rfm_segment NOT NULL,
  computed_at           timestamptz NOT NULL DEFAULT now(),

  UNIQUE (location_id, customer_phone)
);

CREATE INDEX IF NOT EXISTS idx_rfm_location_segment
  ON customer_rfm_profiles (location_id, segment);

CREATE INDEX IF NOT EXISTS idx_rfm_location_score
  ON customer_rfm_profiles (location_id, rfm_score DESC);

CREATE INDEX IF NOT EXISTS idx_rfm_location_computed
  ON customer_rfm_profiles (location_id, computed_at DESC);

-- ── Segment-Statistiken VIEW ──────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_rfm_segment_stats AS
SELECT
  location_id,
  segment,
  COUNT(*)                               AS customer_count,
  ROUND(AVG(monetary_eur)::numeric, 2)  AS avg_monetary_eur,
  ROUND(AVG(frequency)::numeric, 1)     AS avg_frequency,
  ROUND(AVG(recency_days)::numeric, 0)  AS avg_recency_days,
  ROUND(AVG(rfm_score)::numeric, 1)     AS avg_rfm_score,
  SUM(monetary_eur)                     AS total_monetary_eur
FROM customer_rfm_profiles
GROUP BY location_id, segment;

-- ── Top-Kunden VIEW ───────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_rfm_top_customers AS
SELECT
  r.*,
  ROW_NUMBER() OVER (
    PARTITION BY r.location_id
    ORDER BY r.rfm_score DESC, r.monetary_eur DESC
  ) AS rank
FROM customer_rfm_profiles r;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE customer_rfm_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rfm_profiles_service ON customer_rfm_profiles;
CREATE POLICY rfm_profiles_service ON customer_rfm_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
