-- Phase 186: Smart Upsell Engine
-- Analyzes order co-occurrence to surface frequently-bought-together items
-- and drives real-time upsell suggestions at checkout (Storefront + API).

-- ─── Pair Frequency Table ─────────────────────────────────────────────────────
-- Canonical pairs: item_a < item_b (alphabetically), rebuilt nightly.
CREATE TABLE IF NOT EXISTS upsell_item_pairs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  item_a          TEXT NOT NULL,  -- alphabetically first
  item_b          TEXT NOT NULL,  -- alphabetically second
  pair_count      INTEGER NOT NULL DEFAULT 0,  -- orders containing both
  order_count_a   INTEGER NOT NULL DEFAULT 0,  -- orders containing item_a
  order_count_b   INTEGER NOT NULL DEFAULT 0,  -- orders containing item_b
  total_orders    INTEGER NOT NULL DEFAULT 0,  -- total orders in window
  support_score   NUMERIC(8,6) NOT NULL DEFAULT 0,  -- pair_count / total_orders
  confidence_ab   NUMERIC(8,6) NOT NULL DEFAULT 0,  -- P(B|A) = pair/count_a
  confidence_ba   NUMERIC(8,6) NOT NULL DEFAULT 0,  -- P(A|B) = pair/count_b
  lift_score      NUMERIC(10,4) NOT NULL DEFAULT 0, -- confidence_ab / P(B)
  last_rebuilt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, item_a, item_b)
);

-- ─── Manual Upsell Rules ──────────────────────────────────────────────────────
-- Admins can define explicit trigger→suggestion pairs, overriding analytics.
CREATE TABLE IF NOT EXISTS upsell_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  trigger_item    TEXT NOT NULL,     -- when cart contains this → show upsell
  suggested_item  TEXT NOT NULL,     -- suggest this item
  headline        TEXT,              -- "Kunden mögen auch…"
  badge           TEXT,              -- "Bestseller" / "Empfehlung"
  extra_fee_eur   NUMERIC(8,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  priority        INTEGER NOT NULL DEFAULT 0, -- higher wins if multiple match
  max_per_day     INTEGER,                    -- daily cap (NULL = unlimited)
  impressions_today INTEGER NOT NULL DEFAULT 0,
  total_impressions  INTEGER NOT NULL DEFAULT 0,
  total_conversions  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Impressions Log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS upsell_impressions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      UUID NOT NULL,
  order_id         TEXT,           -- customer_orders.id once placed
  rule_id          UUID REFERENCES upsell_rules(id) ON DELETE SET NULL,
  suggested_item   TEXT NOT NULL,
  cart_items       TEXT[] NOT NULL DEFAULT '{}',
  converted        BOOLEAN NOT NULL DEFAULT false,
  revenue_lift_eur NUMERIC(8,2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_upsell_pairs_location
  ON upsell_item_pairs (location_id);
CREATE INDEX IF NOT EXISTS idx_upsell_pairs_item_a
  ON upsell_item_pairs (location_id, item_a);
CREATE INDEX IF NOT EXISTS idx_upsell_pairs_lift
  ON upsell_item_pairs (location_id, lift_score DESC);
CREATE INDEX IF NOT EXISTS idx_upsell_rules_location
  ON upsell_rules (location_id, is_active);
CREATE INDEX IF NOT EXISTS idx_upsell_rules_trigger
  ON upsell_rules (location_id, trigger_item, is_active);
CREATE INDEX IF NOT EXISTS idx_upsell_impressions_location
  ON upsell_impressions (location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upsell_impressions_order
  ON upsell_impressions (order_id) WHERE order_id IS NOT NULL;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE upsell_item_pairs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE upsell_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE upsell_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON upsell_item_pairs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON upsell_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON upsell_impressions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── Performance View ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_upsell_performance AS
SELECT
  r.id                    AS rule_id,
  r.location_id,
  r.name,
  r.trigger_item,
  r.suggested_item,
  r.is_active,
  r.priority,
  r.total_impressions,
  r.total_conversions,
  ROUND(
    r.total_conversions::NUMERIC
    / NULLIF(r.total_impressions, 0) * 100,
  2)                      AS conversion_rate_pct,
  COALESCE(
    (SELECT SUM(revenue_lift_eur)
     FROM upsell_impressions i
     WHERE i.rule_id = r.id AND i.converted),
  0)                      AS total_revenue_lift_eur,
  (SELECT MAX(created_at)
   FROM upsell_impressions i
   WHERE i.rule_id = r.id) AS last_impression_at
FROM upsell_rules r;

-- ─── Top Pairs View ───────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_upsell_top_pairs AS
SELECT
  p.*,
  l.name AS location_name
FROM upsell_item_pairs p
JOIN locations l ON l.id = p.location_id
WHERE p.pair_count >= 3
ORDER BY p.location_id, p.lift_score DESC;

-- ─── Daily Counter Reset ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reset_upsell_daily_counts()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE upsell_rules SET impressions_today = 0;
$$;
