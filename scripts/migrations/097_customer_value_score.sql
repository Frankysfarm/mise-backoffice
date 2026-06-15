-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 097: Smart Customer Value Score (CVS) Engine — Phase 192
--
-- Berechnet pro Kunde einen aggregierten Wert-Score (0–100) aus:
--   rfm_score_norm   (0–100, 35% Gewicht) — Normalisierter RFM-Quintil-Score
--   frequency_score  (0–100, 20% Gewicht) — Bestellfrequenz-Perzentil
--   monetary_score   (0–100, 25% Gewicht) — Umsatz-Perzentil
--   recency_score    (0–100, 20% Gewicht) — Aktualitäts-Score (Exponentialabfall)
--
-- Tier-Grenzen: Platinum ≥ 75 · Gold ≥ 55 · Silver ≥ 35 · Bronze < 35
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Haupt-Tabelle ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_value_scores (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  customer_phone  TEXT        NOT NULL,
  customer_name   TEXT,

  -- Komponenten-Scores (je 0–100)
  rfm_score_norm  NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (rfm_score_norm BETWEEN 0 AND 100),
  frequency_score NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (frequency_score BETWEEN 0 AND 100),
  monetary_score  NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (monetary_score BETWEEN 0 AND 100),
  recency_score   NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (recency_score BETWEEN 0 AND 100),

  -- Composite CVS (0–100)
  cvs             NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (cvs BETWEEN 0 AND 100),
  cvs_tier        TEXT          NOT NULL DEFAULT 'bronze'
                                CHECK (cvs_tier IN ('bronze','silver','gold','platinum')),

  -- Rohdaten
  total_orders    INT           NOT NULL DEFAULT 0,
  total_spent_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  orders_last_30d INT           NOT NULL DEFAULT 0,
  first_order_at  TIMESTAMPTZ,
  last_order_at   TIMESTAMPTZ,
  recency_days    INT,
  rfm_segment     TEXT,

  computed_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (location_id, customer_phone)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE customer_value_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cvs_service_role_all" ON customer_value_scores
  FOR ALL TO service_role USING (TRUE);

-- ── Indizes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cvs_location_cvs
  ON customer_value_scores (location_id, cvs DESC);

CREATE INDEX IF NOT EXISTS idx_cvs_location_tier
  ON customer_value_scores (location_id, cvs_tier, cvs DESC);

CREATE INDEX IF NOT EXISTS idx_cvs_phone
  ON customer_value_scores (customer_phone);

CREATE INDEX IF NOT EXISTS idx_cvs_computed
  ON customer_value_scores (location_id, computed_at DESC);

-- ── View: Tier-Verteilung pro Location ───────────────────────────────────────
CREATE OR REPLACE VIEW v_cvs_distribution AS
SELECT
  location_id,
  COUNT(*)                                                    AS total_customers,
  COUNT(*) FILTER (WHERE cvs_tier = 'platinum')              AS platinum_count,
  COUNT(*) FILTER (WHERE cvs_tier = 'gold')                  AS gold_count,
  COUNT(*) FILTER (WHERE cvs_tier = 'silver')                AS silver_count,
  COUNT(*) FILTER (WHERE cvs_tier = 'bronze')                AS bronze_count,
  ROUND(AVG(cvs), 2)                                         AS avg_cvs,
  ROUND(MAX(cvs), 2)                                         AS max_cvs,
  ROUND(SUM(total_spent_eur), 2)                             AS total_revenue_eur,
  ROUND(AVG(total_spent_eur), 2)                             AS avg_revenue_per_customer,
  ROUND(AVG(orders_last_30d), 2)                             AS avg_orders_last_30d,
  MAX(computed_at)                                           AS last_computed_at
FROM customer_value_scores
GROUP BY location_id;

-- ── View: Top-Kunden (Gold + Platinum) ───────────────────────────────────────
CREATE OR REPLACE VIEW v_cvs_top_customers AS
SELECT
  cvs.*,
  l.name AS location_name
FROM customer_value_scores cvs
JOIN locations l ON l.id = cvs.location_id
WHERE cvs.cvs >= 55
ORDER BY cvs.cvs DESC;
