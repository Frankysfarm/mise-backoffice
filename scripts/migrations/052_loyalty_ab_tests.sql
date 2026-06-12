-- Migration 052: Loyalty A/B-Test Dashboard (Phase 82)
-- Tabellen für A/B-Tests auf Loyalty-Kampagnen

-- ── Haupt-Test-Tabelle ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_ab_tests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  description    text,
  status         text        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  start_at       timestamptz,
  end_at         timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Varianten-Tabelle ────────────────────────────────────────────────────────
-- Pro Test 2–4 Varianten. Summe aller allocation_pct muss 100 ergeben.
CREATE TABLE IF NOT EXISTS loyalty_ab_variants (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id           uuid        NOT NULL REFERENCES loyalty_ab_tests(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  description       text,
  points_multiplier numeric     NOT NULL DEFAULT 1.0
                                CHECK (points_multiplier > 0 AND points_multiplier <= 10),
  allocation_pct    integer     NOT NULL DEFAULT 50
                                CHECK (allocation_pct BETWEEN 1 AND 99),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Kundenzuweisungen ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_ab_assignments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id        uuid        NOT NULL REFERENCES loyalty_ab_tests(id) ON DELETE CASCADE,
  variant_id     uuid        NOT NULL REFERENCES loyalty_ab_variants(id) ON DELETE CASCADE,
  location_id    uuid        NOT NULL,
  customer_email text        NOT NULL,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, customer_email)
);

-- ── Ereignis-Tracking ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_ab_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  uuid        NOT NULL REFERENCES loyalty_ab_assignments(id) ON DELETE CASCADE,
  test_id        uuid        NOT NULL,
  variant_id     uuid        NOT NULL,
  location_id    uuid        NOT NULL,
  event_type     text        NOT NULL
                             CHECK (event_type IN ('order_placed', 'points_earned', 'points_redeemed')),
  order_id       uuid,
  amount_eur     numeric,
  points_delta   integer,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Metriken-View ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_ab_test_metrics AS
SELECT
  t.id                    AS test_id,
  t.location_id,
  t.name                  AS test_name,
  t.status,
  t.start_at,
  t.end_at,
  v.id                    AS variant_id,
  v.name                  AS variant_name,
  v.points_multiplier,
  v.allocation_pct,
  COUNT(DISTINCT a.id)    AS assigned_customers,
  COUNT(DISTINCT CASE WHEN e.event_type = 'order_placed' THEN e.id END)         AS total_orders,
  COALESCE(SUM(CASE WHEN e.event_type = 'order_placed'    THEN e.amount_eur END), 0) AS total_revenue,
  COALESCE(SUM(CASE WHEN e.event_type = 'points_earned'   THEN e.points_delta END), 0) AS total_points_earned,
  COALESCE(SUM(CASE WHEN e.event_type = 'points_redeemed' THEN ABS(e.points_delta) END), 0) AS total_points_redeemed,
  ROUND(
    COUNT(DISTINCT CASE WHEN e.event_type = 'order_placed' THEN e.assignment_id END)::numeric /
    NULLIF(COUNT(DISTINCT a.id), 0) * 100,
    1
  )                       AS order_conversion_pct,
  ROUND(
    COALESCE(
      SUM(CASE WHEN e.event_type = 'order_placed' THEN e.amount_eur END) /
      NULLIF(COUNT(DISTINCT CASE WHEN e.event_type = 'order_placed' THEN e.assignment_id END), 0),
      0
    ), 2
  )                       AS avg_order_value
FROM loyalty_ab_tests t
JOIN loyalty_ab_variants v ON v.test_id = t.id
LEFT JOIN loyalty_ab_assignments a ON a.variant_id = v.id
LEFT JOIN loyalty_ab_events e ON e.assignment_id = a.id
GROUP BY t.id, t.location_id, t.name, t.status, t.start_at, t.end_at,
         v.id, v.name, v.points_multiplier, v.allocation_pct;

-- ── Indizes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ab_tests_location   ON loyalty_ab_tests(location_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status     ON loyalty_ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ab_variants_test    ON loyalty_ab_variants(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_test ON loyalty_ab_assignments(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_email ON loyalty_ab_assignments(customer_email);
CREATE INDEX IF NOT EXISTS idx_ab_events_assignment ON loyalty_ab_events(assignment_id);
CREATE INDEX IF NOT EXISTS idx_ab_events_test      ON loyalty_ab_events(test_id);
