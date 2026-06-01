-- ============================================================
-- Migration 019: Demand Forecasting Engine
-- ============================================================
-- Tabellen:
--   delivery_demand_snapshots — stündlicher Bedarfs-Snapshot pro Location
-- Views:
--   v_hourly_demand_pattern   — Ø-Bestellmenge pro Wochentag+Stunde (8 Wochen)
--   v_forecast_coverage_recs  — Fahrer-Empfehlungen aus Forecast-Daten
-- ============================================================

-- ----------------------------------------------------------------
-- Tabelle: delivery_demand_snapshots
-- Pro Location wird jede volle Stunde ein Snapshot gespeichert.
-- Enthält Bestellmenge, Lieferquote und Ø-Lieferzeit der Stunde.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_demand_snapshots (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id      text        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  -- Stunden-Bucket in UTC (immer :00:00)
  snapshot_hour    timestamptz NOT NULL,
  orders_count     int         NOT NULL DEFAULT 0,
  delivered_count  int         NOT NULL DEFAULT 0,
  avg_delivery_min float,
  peak_zone        text,       -- Zone mit meisten Orders in dieser Stunde
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- UPSERT-Sicherheit: nur ein Snapshot pro Location+Stunde
CREATE UNIQUE INDEX IF NOT EXISTS idx_demand_snapshot_uniq
  ON delivery_demand_snapshots (location_id, snapshot_hour);

-- Zeitreihen-Abfragen
CREATE INDEX IF NOT EXISTS idx_demand_snapshot_loc_hour
  ON delivery_demand_snapshots (location_id, snapshot_hour DESC);

-- ----------------------------------------------------------------
-- View: v_hourly_demand_pattern
-- Aggregiert Schnappschüsse der letzten 8 Wochen zu einem
-- Wochentag+Stunden-Muster. Grundlage für den Forecast.
-- Wochentag: 0=Sonntag … 6=Samstag (PostgreSQL EXTRACT DOW)
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_hourly_demand_pattern AS
SELECT
  location_id,
  EXTRACT(DOW  FROM snapshot_hour AT TIME ZONE 'Europe/Berlin')  AS weekday,
  EXTRACT(HOUR FROM snapshot_hour AT TIME ZONE 'Europe/Berlin')  AS hour_of_day,
  ROUND(AVG(orders_count)::numeric, 1)     AS avg_orders,
  ROUND(STDDEV(orders_count)::numeric, 1)  AS stddev_orders,
  MAX(orders_count)                         AS peak_orders,
  ROUND(AVG(avg_delivery_min)::numeric, 1) AS avg_delivery_min,
  COUNT(*)                                  AS data_points
FROM delivery_demand_snapshots
WHERE snapshot_hour >= now() - interval '8 weeks'
GROUP BY location_id, weekday, hour_of_day;

-- ----------------------------------------------------------------
-- View: v_forecast_coverage_recs
-- Leitet aus dem Stundenmuster eine Mindest-Fahrerempfehlung ab.
-- Annahme: 1 Fahrer schafft ~3 Lieferungen/Stunde (Zone-Mix).
-- Ab 4+ avg_orders → mind. 2 Fahrer empfohlen.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_forecast_coverage_recs AS
SELECT
  location_id,
  weekday,
  hour_of_day,
  avg_orders,
  peak_orders,
  data_points,
  -- Mindest-Fahrer: ceil(avg / 3), min 1 wenn Nachfrage > 0
  GREATEST(
    CASE WHEN avg_orders > 0 THEN 1 ELSE 0 END,
    CEIL(avg_orders / 3.0)::int
  ) AS recommended_min_drivers,
  -- Ziel-Fahrer: für Peak-Abdeckung (ceil(peak / 3))
  GREATEST(
    CASE WHEN peak_orders > 0 THEN 1 ELSE 0 END,
    CEIL(peak_orders / 3.0)::int
  ) AS recommended_target_drivers
FROM v_hourly_demand_pattern
WHERE data_points >= 2;  -- Mindestens 2 Datenpunkte für Verlässlichkeit
