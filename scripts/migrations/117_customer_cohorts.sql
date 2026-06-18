-- Migration 117: Smart Customer Cohort Revenue Analysis Engine
-- Tracks revenue/retention per acquisition-month cohort × calendar-month

-- ── Main table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_cohort_snapshots (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id          uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- cohort_month: the month the customers placed their FIRST ever order ('2024-01')
  cohort_month         text        NOT NULL,  -- YYYY-MM

  -- snapshot_month: which calendar month we are measuring ('2024-03')
  snapshot_month       text        NOT NULL,  -- YYYY-MM

  -- how many months after cohort_month this snapshot is (0 = acquisition month)
  months_since_cohort  int         NOT NULL CHECK (months_since_cohort >= 0),

  -- cohort size — all customers who first ordered in cohort_month
  cohort_size          int         NOT NULL DEFAULT 0,

  -- how many of those customers ordered in snapshot_month
  active_customers     int         NOT NULL DEFAULT 0,

  -- retention rate: active_customers / cohort_size  (0.0 – 1.0)
  retention_rate       numeric(6,4),

  -- revenue these customers generated in snapshot_month
  revenue_eur          numeric(12,2) NOT NULL DEFAULT 0,

  -- avg order value for active customers in snapshot_month
  avg_order_value_eur  numeric(10,2),

  -- number of orders from active customers in snapshot_month
  orders_count         int          NOT NULL DEFAULT 0,

  computed_at          timestamptz  DEFAULT now() NOT NULL,

  UNIQUE (location_id, cohort_month, snapshot_month)
);

ALTER TABLE customer_cohort_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_cohorts" ON customer_cohort_snapshots
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_cohort_snapshots_location
  ON customer_cohort_snapshots (location_id, cohort_month, months_since_cohort);

CREATE INDEX IF NOT EXISTS idx_cohort_snapshots_snapshot_month
  ON customer_cohort_snapshots (location_id, snapshot_month);

-- ── View: retention curve per cohort ──────────────────────────────────────
CREATE OR REPLACE VIEW v_cohort_retention_curve AS
SELECT
  location_id,
  cohort_month,
  months_since_cohort,
  cohort_size,
  active_customers,
  retention_rate,
  revenue_eur,
  avg_order_value_eur,
  orders_count
FROM customer_cohort_snapshots
ORDER BY location_id, cohort_month DESC, months_since_cohort ASC;

-- ── View: cohort summary (latest snapshot per cohort) ─────────────────────
CREATE OR REPLACE VIEW v_cohort_summary AS
SELECT
  location_id,
  cohort_month,
  cohort_size,
  -- M0 retention (should always be 1.0 — acquisition month)
  MAX(CASE WHEN months_since_cohort = 0 THEN retention_rate END) AS retention_m0,
  -- M1 (1 month later)
  MAX(CASE WHEN months_since_cohort = 1 THEN retention_rate END) AS retention_m1,
  -- M3
  MAX(CASE WHEN months_since_cohort = 3 THEN retention_rate END) AS retention_m3,
  -- M6
  MAX(CASE WHEN months_since_cohort = 6 THEN retention_rate END) AS retention_m6,
  -- cumulative revenue across all months
  SUM(revenue_eur) AS total_revenue_eur,
  -- average revenue per cohort customer (LTV proxy)
  CASE WHEN cohort_size > 0 THEN SUM(revenue_eur) / cohort_size END AS ltv_eur,
  MAX(snapshot_month) AS latest_snapshot_month,
  MAX(months_since_cohort) AS months_tracked
FROM customer_cohort_snapshots
GROUP BY location_id, cohort_month, cohort_size
ORDER BY location_id, cohort_month DESC;

-- ── Cleanup function ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_cohort_snapshots(days_to_keep int DEFAULT 730)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted int;
BEGIN
  DELETE FROM customer_cohort_snapshots
  WHERE computed_at < now() - (days_to_keep || ' days')::interval;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
