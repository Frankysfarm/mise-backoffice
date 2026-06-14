-- 083_subscriptions.sql
-- Smart Delivery Subscription + Flatrate Engine (Phase 168)
-- Kunden können Liefer-Flatrates buchen; Admin verwaltet Pläne und Abonnements.

-- ── Plan-Vorlagen ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_subscription_plans (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id                 UUID          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name                        TEXT          NOT NULL,
  description                 TEXT,
  plan_type                   TEXT          NOT NULL
    CHECK (plan_type IN ('weekly', 'monthly', 'annual')),
  price_eur                   NUMERIC(8,2)  NOT NULL CHECK (price_eur >= 0),
  -- null = unbegrenzte Gratis-Lieferungen im Zeitraum
  free_deliveries_per_period  INT,
  -- Alternativ: prozentualer Rabatt auf Liefergebühr (0 = keine Reduktion außer Freimengen)
  discount_pct                INT           NOT NULL DEFAULT 0
    CHECK (discount_pct BETWEEN 0 AND 100),
  -- Mindestbestellwert für die Benefit-Anwendung
  min_order_value_eur         NUMERIC(8,2),
  is_active                   BOOLEAN       NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Aktive Kunden-Abonnements ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_subscriptions (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id                 UUID          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  plan_id                     UUID          NOT NULL
    REFERENCES delivery_subscription_plans(id) ON DELETE RESTRICT,
  customer_email              TEXT          NOT NULL,
  customer_phone              TEXT,
  customer_name               TEXT,
  status                      TEXT          NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  starts_at                   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  current_period_start        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  current_period_end          TIMESTAMPTZ   NOT NULL,
  deliveries_used_this_period INT           NOT NULL DEFAULT 0,
  total_deliveries_all_time   INT           NOT NULL DEFAULT 0,
  total_paid_eur              NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_savings_eur           NUMERIC(10,2) NOT NULL DEFAULT 0,
  cancelled_at                TIMESTAMPTZ,
  cancel_reason               TEXT,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, customer_email)
);

-- ── Nutzungs-Log (pro Lieferung) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_usage_log (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID          NOT NULL
    REFERENCES delivery_subscriptions(id) ON DELETE CASCADE,
  location_id      UUID          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id         TEXT          NOT NULL,
  fee_original_eur NUMERIC(8,2),
  fee_charged_eur  NUMERIC(8,2)  NOT NULL DEFAULT 0,
  savings_eur      NUMERIC(8,2)  NOT NULL DEFAULT 0,
  applied_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Indizes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sub_plans_location
  ON delivery_subscription_plans(location_id);

CREATE INDEX IF NOT EXISTS idx_subs_location
  ON delivery_subscriptions(location_id);

CREATE INDEX IF NOT EXISTS idx_subs_email
  ON delivery_subscriptions(customer_email);

CREATE INDEX IF NOT EXISTS idx_subs_status
  ON delivery_subscriptions(status);

-- Partial-Index für Renewal-Cron (nur aktive, mit Ablauf-Datum)
CREATE INDEX IF NOT EXISTS idx_subs_period_end_active
  ON delivery_subscriptions(current_period_end)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sub_usage_sub
  ON subscription_usage_log(subscription_id);

CREATE INDEX IF NOT EXISTS idx_sub_usage_location_date
  ON subscription_usage_log(location_id, applied_at DESC);

-- ── Overview-View ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_subscription_overview AS
SELECT
  s.location_id,
  COUNT(*)                                                         FILTER (WHERE s.status = 'active')    AS active_count,
  COUNT(*)                                                         FILTER (WHERE s.status = 'cancelled')  AS cancelled_count,
  COUNT(*)                                                         FILTER (WHERE s.status = 'paused')     AS paused_count,
  COUNT(*)                                                         FILTER (WHERE s.status = 'expired')    AS expired_count,
  COALESCE(SUM(sp.price_eur) FILTER (WHERE s.status = 'active'), 0)                                      AS mrr_eur,
  COALESCE(SUM(s.total_paid_eur), 0)                                                                      AS total_revenue_eur,
  COALESCE(SUM(s.total_savings_eur), 0)                                                                   AS total_savings_eur,
  COALESCE(SUM(s.total_deliveries_all_time), 0)                                                           AS total_deliveries,
  COUNT(DISTINCT sp.id)                                                                                    AS plan_count
FROM delivery_subscriptions s
JOIN delivery_subscription_plans sp ON s.plan_id = sp.id
GROUP BY s.location_id;

-- ── Bald-ablaufende Abos ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_subscriptions_expiring_soon AS
SELECT
  s.*,
  sp.name       AS plan_name,
  sp.plan_type,
  sp.price_eur
FROM delivery_subscriptions s
JOIN delivery_subscription_plans sp ON s.plan_id = sp.id
WHERE s.status = 'active'
  AND s.current_period_end <= NOW() + INTERVAL '3 days';

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE delivery_subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage_log      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_bypass_plans"  ON delivery_subscription_plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "employee_read_plans"        ON delivery_subscription_plans
  FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "service_role_bypass_subs"   ON delivery_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "employee_read_subs"         ON delivery_subscriptions
  FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "service_role_bypass_usage"  ON subscription_usage_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "employee_read_usage"        ON subscription_usage_log
  FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM employees WHERE user_id = auth.uid()
  ));
