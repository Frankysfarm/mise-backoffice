-- Migration 075: Smart Menu Item Sales Analytics
-- Phase 121 — 2026-06-13
--
-- Verfolgt täglich die Verkaufsleistung jedes Menü-Artikels im Liefer-Kanal.
-- Ermöglicht Hero-Items, Slow-Mover-Warnungen und Umsatz-Breakdowns.

-- ─────────────────────────────────────────────
-- 1. Tabelle: delivery_menu_snapshots
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_menu_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  snapshot_date   date        NOT NULL,
  item_name       text        NOT NULL,
  order_count     int         NOT NULL DEFAULT 0,  -- Anzahl Bestellungen die diesen Artikel enthielten
  quantity_sold   int         NOT NULL DEFAULT 0,  -- Gesamte Stückzahl verkauft
  revenue_eur     numeric(10,2) NOT NULL DEFAULT 0, -- Gesamtumsatz dieses Artikels
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, snapshot_date, item_name)
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_menu_snapshots_location_date
  ON delivery_menu_snapshots (location_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_menu_snapshots_item
  ON delivery_menu_snapshots (location_id, item_name, snapshot_date DESC);

-- RLS
ALTER TABLE delivery_menu_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "tenant_isolation_menu_snapshots"
  ON delivery_menu_snapshots
  USING (
    location_id IN (
      SELECT id FROM locations WHERE tenant_id = (
        SELECT tenant_id FROM employees WHERE auth_id = auth.uid() LIMIT 1
      )
    )
  );

-- ─────────────────────────────────────────────
-- 2. View: v_menu_item_performance_30d
-- Aggregiert letzte 30 Tage pro Artikel und Location
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_menu_item_performance_30d AS
SELECT
  location_id,
  item_name,
  SUM(order_count)  AS total_orders,
  SUM(quantity_sold) AS total_quantity,
  SUM(revenue_eur)   AS total_revenue,
  ROUND(SUM(revenue_eur) / NULLIF(SUM(quantity_sold), 0), 2) AS avg_price,
  COUNT(DISTINCT snapshot_date) AS days_with_sales,
  MAX(snapshot_date) AS last_sale_date,
  ROUND(SUM(order_count)::numeric / NULLIF(COUNT(DISTINCT snapshot_date), 0), 1) AS avg_orders_per_day
FROM delivery_menu_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY location_id, item_name;

-- ─────────────────────────────────────────────
-- 3. View: v_hero_items
-- Top-10 Artikel nach Umsatz pro Location (letzte 30d)
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_hero_items AS
SELECT
  location_id,
  item_name,
  total_orders,
  total_quantity,
  total_revenue,
  avg_price,
  days_with_sales,
  last_sale_date,
  avg_orders_per_day,
  RANK() OVER (PARTITION BY location_id ORDER BY total_revenue DESC) AS revenue_rank
FROM v_menu_item_performance_30d;

-- ─────────────────────────────────────────────
-- 4. View: v_slow_movers
-- Artikel mit weniger als 5 Bestellungen in den letzten 30 Tagen
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_slow_movers AS
SELECT
  location_id,
  item_name,
  total_orders,
  total_quantity,
  total_revenue,
  last_sale_date,
  CURRENT_DATE - last_sale_date AS days_since_last_sale
FROM v_menu_item_performance_30d
WHERE total_orders < 5
ORDER BY location_id, total_orders ASC;

-- ─────────────────────────────────────────────
-- 5. View: v_menu_weekly_trend
-- 7-Tages-Rollup: Tages-Umsatz und Bestellmenge pro Location
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_menu_weekly_trend AS
SELECT
  location_id,
  snapshot_date,
  SUM(order_count)   AS daily_orders,
  SUM(quantity_sold) AS daily_quantity,
  SUM(revenue_eur)   AS daily_revenue,
  COUNT(DISTINCT item_name) AS distinct_items_sold
FROM delivery_menu_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY location_id, snapshot_date
ORDER BY location_id, snapshot_date DESC;

-- ─────────────────────────────────────────────
-- 6. SQL-Funktion: prune_old_menu_snapshots
-- Bereinigt Snapshots älter als X Tage
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_menu_snapshots(days_to_keep int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM delivery_menu_snapshots
  WHERE snapshot_date < CURRENT_DATE - (days_to_keep || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON TABLE delivery_menu_snapshots IS
  'Tägliche Verkaufs-Snapshots pro Menü-Artikel und Location (Liefer-Kanal). '
  'Basis für Hero-Item-Erkennung, Slow-Mover-Warnungen und Umsatz-Breakdown.';
