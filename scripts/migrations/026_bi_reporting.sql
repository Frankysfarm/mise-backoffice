-- Migration 026: Business Intelligence Reporting
-- Phase 26: Tages-KPIs-View + Fahrer-Perioden-Stats-View + Report-Cache-Tabelle
-- Multi-Tenant: alle Views und Tabellen filtern nach location_id

-- ============================================================
-- 1. v_daily_location_kpis VIEW
-- ============================================================
-- Aggregiert Bestell-KPIs pro Location und Kalender-Tag (Berliner Zeit).
-- Optimiert für Admin-Perioden-Reports (letzte 30 Tage ≈ 30 Zeilen/Location).
CREATE OR REPLACE VIEW v_daily_location_kpis AS
SELECT
  location_id,
  (created_at AT TIME ZONE 'Europe/Berlin')::date              AS report_date,
  COUNT(*)                                                      AS total_orders,
  COUNT(*) FILTER (WHERE typ = 'lieferung')                    AS delivery_orders,
  COUNT(*) FILTER (WHERE typ != 'lieferung')                   AS pickup_orders,
  COUNT(*) FILTER (WHERE status IN ('geliefert','abgeschlossen')) AS completed_orders,
  COUNT(*) FILTER (WHERE status = 'storniert')                 AS cancelled_orders,
  ROUND(SUM(gesamtbetrag)::numeric, 2)                         AS total_revenue,
  ROUND(SUM(gesamtbetrag) FILTER (WHERE typ = 'lieferung')::numeric, 2)  AS delivery_revenue,
  ROUND(SUM(gesamtbetrag) FILTER (WHERE typ != 'lieferung')::numeric, 2) AS pickup_revenue,
  ROUND(SUM(gesamtbetrag) FILTER (WHERE LOWER(zahlungsart) IN ('bar','cash'))::numeric, 2)     AS cash_revenue,
  ROUND(SUM(gesamtbetrag) FILTER (WHERE zahlungsart IS NOT NULL AND LOWER(zahlungsart) NOT IN ('bar','cash'))::numeric, 2) AS card_revenue,
  COUNT(DISTINCT mise_driver_id) FILTER (WHERE mise_driver_id IS NOT NULL) AS active_drivers
FROM customer_orders
GROUP BY location_id, (created_at AT TIME ZONE 'Europe/Berlin')::date;

COMMENT ON VIEW v_daily_location_kpis IS
  'Tages-KPIs pro Location aus customer_orders (Berliner Kalender-Tag). Phase 26 — Reporting.';

-- ============================================================
-- 2. v_driver_period_stats VIEW
-- ============================================================
-- Fahrer-Performance pro Location und Kalender-Tag aus delivery_performance.
-- Basis für CSV-Export und Perioden-Reports.
CREATE OR REPLACE VIEW v_driver_period_stats AS
SELECT
  dp.location_id,
  dp.driver_id,
  md.name                                                        AS driver_name,
  md.vehicle                                                     AS driver_vehicle,
  (dp.completed_at AT TIME ZONE 'Europe/Berlin')::date          AS report_date,
  COUNT(*)                                                       AS deliveries,
  ROUND(AVG(dp.eta_deviation_min)::numeric, 1)                  AS avg_eta_deviation_min,
  COUNT(*) FILTER (WHERE dp.on_time = TRUE)                     AS on_time_count,
  COUNT(*) FILTER (WHERE dp.on_time = FALSE)                    AS late_count,
  CASE
    WHEN COUNT(*) FILTER (WHERE dp.on_time IS NOT NULL) > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE dp.on_time = TRUE)::numeric /
      NULLIF(COUNT(*) FILTER (WHERE dp.on_time IS NOT NULL), 0) * 100,
      1)
    ELSE NULL
  END                                                            AS on_time_pct
FROM delivery_performance dp
LEFT JOIN mise_drivers md ON md.id = dp.driver_id
WHERE dp.driver_id   IS NOT NULL
  AND dp.location_id IS NOT NULL
GROUP BY
  dp.location_id,
  dp.driver_id,
  md.name,
  md.vehicle,
  (dp.completed_at AT TIME ZONE 'Europe/Berlin')::date;

COMMENT ON VIEW v_driver_period_stats IS
  'Fahrer-Tages-Performance aus delivery_performance. Phase 26 — Reporting.';

-- ============================================================
-- 3. delivery_report_snapshots TABLE
-- ============================================================
-- Gecachte Perioden-Reports (täglich/wöchentlich/monatlich).
-- Wird durch Cron täglich um 02:00 UTC befüllt (fire-and-forget).
CREATE TABLE IF NOT EXISTS delivery_report_snapshots (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID         NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  report_type     TEXT         NOT NULL CHECK (report_type IN ('daily','weekly','monthly')),
  period_start    DATE         NOT NULL,
  payload         JSONB        NOT NULL DEFAULT '{}',
  orders_count    INT          NOT NULL DEFAULT 0,
  delivered_count INT          NOT NULL DEFAULT 0,
  revenue_eur     NUMERIC(12,2),
  on_time_pct     NUMERIC(5,1),
  generated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (location_id, report_type, period_start)
);

COMMENT ON TABLE delivery_report_snapshots IS
  'Gecachte Perioden-Reports (daily/weekly/monthly). Cron-täglich befüllt.';

CREATE INDEX IF NOT EXISTS idx_report_snapshots_location_type_period
  ON delivery_report_snapshots (location_id, report_type, period_start DESC);

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE delivery_report_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rpt_snap_service_all"  ON delivery_report_snapshots;
CREATE POLICY "rpt_snap_service_all"
  ON delivery_report_snapshots FOR ALL
  TO service_role USING (true);

DROP POLICY IF EXISTS "rpt_snap_auth_select" ON delivery_report_snapshots;
CREATE POLICY "rpt_snap_auth_select"
  ON delivery_report_snapshots FOR SELECT
  TO authenticated
  USING (
    location_id IN (
      SELECT l.id FROM locations l
      JOIN employees e ON e.tenant_id = l.tenant_id
      WHERE e.auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. Partial-Index auf customer_orders für schnelle Tages-Reports
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_customer_orders_location_created_reporting
  ON customer_orders (location_id, created_at DESC);
