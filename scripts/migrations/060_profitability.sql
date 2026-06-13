-- Migration 060: Delivery Profitability Analytics Engine
-- Aggregiert Liefergebühren (Revenue) und Fahrer-Kosten (Cost) zu P&L-Metriken
-- nach Zone, Fahrer, Tageszeit und Zeitraum.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabelle: delivery_profitability_snapshots
-- Tägliche Aggregation pro Location — wird vom Cron befüllt
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_profitability_snapshots (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  snapshot_date         DATE          NOT NULL,
  -- Revenue
  total_orders          INT           NOT NULL DEFAULT 0,
  revenue_eur           NUMERIC(10,2) NOT NULL DEFAULT 0,  -- Σ liefergebuehr
  avg_fee_eur           NUMERIC(8,2),
  -- Cost
  total_payouts         INT           NOT NULL DEFAULT 0,  -- Anzahl Auszahlungs-Records
  cost_eur              NUMERIC(10,2) NOT NULL DEFAULT 0,  -- Σ total_amount aus driver_payout_records
  avg_cost_eur          NUMERIC(8,2),
  -- Derived (gespeicherte berechnete Spalten)
  profit_eur            NUMERIC(10,2) GENERATED ALWAYS AS (revenue_eur - cost_eur) STORED,
  margin_pct            NUMERIC(5,2)  GENERATED ALWAYS AS (
    CASE WHEN revenue_eur > 0
    THEN ROUND(((revenue_eur - cost_eur) / revenue_eur) * 100, 2)
    ELSE NULL END
  ) STORED,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (location_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_profit_snap_location_date
  ON delivery_profitability_snapshots (location_id, snapshot_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- View: v_zone_profitability
-- P&L pro Lieferzone, letzte 30 Tage
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_zone_profitability AS
SELECT
  co.location_id,
  COALESCE(co.delivery_zone, 'unbekannt')                                     AS zone,
  COUNT(DISTINCT co.id)                                                        AS order_count,
  ROUND(SUM(COALESCE(co.liefergebuehr, 0)), 2)                                 AS revenue_eur,
  ROUND(AVG(COALESCE(co.liefergebuehr, 0)), 2)                                 AS avg_fee_eur,
  ROUND(SUM(COALESCE(pr.total_amount, 0)), 2)                                  AS cost_eur,
  ROUND(AVG(COALESCE(pr.total_amount, 0)), 2)                                  AS avg_cost_eur,
  ROUND(SUM(COALESCE(co.liefergebuehr, 0))
      - SUM(COALESCE(pr.total_amount, 0)), 2)                                  AS profit_eur,
  CASE
    WHEN SUM(COALESCE(co.liefergebuehr, 0)) > 0
    THEN ROUND(
      ((SUM(COALESCE(co.liefergebuehr, 0)) - SUM(COALESCE(pr.total_amount, 0)))
      / SUM(COALESCE(co.liefergebuehr, 0))) * 100, 2)
    ELSE NULL
  END                                                                          AS margin_pct
FROM customer_orders co
LEFT JOIN driver_payout_records pr ON pr.order_id = co.id
WHERE co.status = 'geliefert'
  AND co.created_at >= NOW() - INTERVAL '30 days'
  AND co.typ = 'lieferung'
GROUP BY co.location_id, COALESCE(co.delivery_zone, 'unbekannt');

-- ─────────────────────────────────────────────────────────────────────────────
-- View: v_driver_profitability
-- Umsatz (Gebühren zugeordnet) vs. Kosten pro Fahrer, letzte 30 Tage
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_driver_profitability AS
SELECT
  pr.location_id,
  pr.driver_id,
  COUNT(DISTINCT pr.id)                                                        AS delivery_count,
  ROUND(SUM(COALESCE(co.liefergebuehr, 0)), 2)                                 AS revenue_eur,
  ROUND(SUM(pr.total_amount), 2)                                               AS cost_eur,
  ROUND(SUM(COALESCE(co.liefergebuehr, 0)) - SUM(pr.total_amount), 2)          AS profit_contribution_eur,
  ROUND(AVG(pr.total_amount), 2)                                               AS avg_cost_per_delivery,
  ROUND(AVG(COALESCE(pr.distance_km, 0)), 2)                                   AS avg_distance_km
FROM driver_payout_records pr
LEFT JOIN customer_orders co ON co.id = pr.order_id
WHERE pr.completed_at >= NOW() - INTERVAL '30 days'
GROUP BY pr.location_id, pr.driver_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- View: v_hourly_profitability
-- P&L nach Tagesstunde (Berliner Lokalzeit), letzte 30 Tage
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_hourly_profitability AS
SELECT
  co.location_id,
  EXTRACT(HOUR FROM co.created_at AT TIME ZONE 'Europe/Berlin')::INT          AS hour_of_day,
  COUNT(DISTINCT co.id)                                                        AS order_count,
  ROUND(SUM(COALESCE(co.liefergebuehr, 0)), 2)                                 AS revenue_eur,
  ROUND(SUM(COALESCE(pr.total_amount, 0)), 2)                                  AS cost_eur,
  ROUND(SUM(COALESCE(co.liefergebuehr, 0))
      - SUM(COALESCE(pr.total_amount, 0)), 2)                                  AS profit_eur,
  CASE
    WHEN SUM(COALESCE(co.liefergebuehr, 0)) > 0
    THEN ROUND(
      ((SUM(COALESCE(co.liefergebuehr, 0)) - SUM(COALESCE(pr.total_amount, 0)))
      / SUM(COALESCE(co.liefergebuehr, 0))) * 100, 2)
    ELSE NULL
  END                                                                          AS margin_pct
FROM customer_orders co
LEFT JOIN driver_payout_records pr ON pr.order_id = co.id
WHERE co.status = 'geliefert'
  AND co.created_at >= NOW() - INTERVAL '30 days'
  AND co.typ = 'lieferung'
GROUP BY
  co.location_id,
  EXTRACT(HOUR FROM co.created_at AT TIME ZONE 'Europe/Berlin')::INT;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE delivery_profitability_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_profitability"
  ON delivery_profitability_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
