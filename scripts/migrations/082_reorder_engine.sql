-- 082_reorder_engine.sql
-- Smart Re-Order Engine — Kunden-Wiederbestellungs-Analyse (Phase 166)
--
-- Aggregiert Bestellhistorie je Kunde (kunde_telefon) pro Location
-- und generiert personalisierte Wiederbestellungs-Profile.

-- ── Kunden-Wiederbestellungs-Profile ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_reorder_profiles (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id              UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  customer_phone           TEXT        NOT NULL,
  customer_name            TEXT,
  total_orders             INT         NOT NULL DEFAULT 0,
  total_spent_eur          NUMERIC(10,2) NOT NULL DEFAULT 0,
  first_order_at           TIMESTAMPTZ,
  last_order_at            TIMESTAMPTZ,
  avg_days_between_orders  NUMERIC(6,1),
  top_items                JSONB       NOT NULL DEFAULT '[]',  -- [{name, count, revenue_eur}]
  preferred_hour           SMALLINT,   -- 0-23 UTC, bevorzugte Bestellstunde
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crp_location_phone_unique UNIQUE (location_id, customer_phone)
);

CREATE INDEX IF NOT EXISTS idx_crp_location    ON customer_reorder_profiles(location_id);
CREATE INDEX IF NOT EXISTS idx_crp_phone       ON customer_reorder_profiles(customer_phone);
CREATE INDEX IF NOT EXISTS idx_crp_last_order  ON customer_reorder_profiles(location_id, last_order_at DESC);
CREATE INDEX IF NOT EXISTS idx_crp_total_orders ON customer_reorder_profiles(location_id, total_orders DESC);

ALTER TABLE customer_reorder_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crp_rls" ON customer_reorder_profiles
  USING (location_id IN (
    SELECT location_id FROM employees WHERE user_id = auth.uid()
  ));

-- ── Agregiertes View: Wiederbestellungs-Statistik je Location ────────────────
CREATE OR REPLACE VIEW v_reorder_location_stats AS
SELECT
  location_id,
  COUNT(*)                                               AS total_profiled_customers,
  COUNT(*) FILTER (WHERE total_orders >= 2)              AS repeat_customers,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE total_orders >= 2)
    / NULLIF(COUNT(*), 0), 1
  )                                                      AS repeat_rate_pct,
  ROUND(AVG(total_orders) FILTER (WHERE total_orders >= 2), 1) AS avg_orders_per_repeat,
  SUM(total_spent_eur)                                   AS total_revenue_tracked,
  ROUND(AVG(total_spent_eur), 2)                         AS avg_lifetime_value,
  MAX(computed_at)                                       AS last_computed_at
FROM customer_reorder_profiles
GROUP BY location_id;

-- ── View: Top-Artikel die am häufigsten wiederbestellt werden ────────────────
-- Explodiert das top_items-JSONB-Array und aggregiert über alle Kunden
CREATE OR REPLACE VIEW v_reorder_top_items AS
SELECT
  p.location_id,
  item.value->>'name'                               AS item_name,
  SUM((item.value->>'count')::INT)                  AS total_reorder_count,
  SUM((item.value->>'revenue_eur')::NUMERIC)        AS total_reorder_revenue,
  COUNT(DISTINCT p.customer_phone)                  AS distinct_customers
FROM customer_reorder_profiles p
CROSS JOIN LATERAL jsonb_array_elements(p.top_items) AS item
WHERE p.total_orders >= 2
GROUP BY p.location_id, item.value->>'name'
ORDER BY total_reorder_count DESC;

-- ── View: Treueste Kunden (nach Bestellhäufigkeit) ───────────────────────────
CREATE OR REPLACE VIEW v_reorder_loyal_customers AS
SELECT
  id,
  location_id,
  customer_phone,
  customer_name,
  total_orders,
  total_spent_eur,
  avg_days_between_orders,
  last_order_at,
  preferred_hour,
  top_items
FROM customer_reorder_profiles
WHERE total_orders >= 2
ORDER BY total_orders DESC, total_spent_eur DESC;
