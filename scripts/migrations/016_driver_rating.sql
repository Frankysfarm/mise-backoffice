-- Migration 016: Driver Auto-Rating + SLA Tracking
--
-- Zweck:
--   1. delivery_performance — pro-Stop-Audit (actual vs. ETA)
--   2. recompute_driver_rating() — aktualisiert mise_drivers.rating + avg_delivery_min
--   3. trg_perf_on_stop_complete — Trigger: auto-record nach Stop-Abschluss
--   4. v_delivery_sla — Admin-VIEW für SLA-Berichte
--   5. Performance-Indizes

-- ============================================================
-- 1. delivery_performance Tabelle
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_performance (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         uuid NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  order_id          uuid REFERENCES customer_orders(id) ON DELETE SET NULL,
  batch_id          uuid REFERENCES mise_delivery_batches(id) ON DELETE SET NULL,
  batch_stop_id     uuid REFERENCES mise_delivery_batch_stops(id) ON DELETE SET NULL,
  location_id       uuid REFERENCES locations(id) ON DELETE SET NULL,
  zone              text,                    -- A/B/C/D
  eta_earliest_at   timestamptz,
  eta_latest_at     timestamptz,
  completed_at      timestamptz NOT NULL,
  eta_deviation_min int,                     -- positiv = zu spät, negativ = zu früh
  on_time           boolean,                 -- completed_at <= eta_latest_at
  delivery_min      int,                     -- tatsächliche Lieferzeit in Minuten (ab batch started_at)
  recorded_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE delivery_performance IS
  'Per-Stop SLA-Audit: tatsächliche vs. geschätzte Lieferzeit pro Fahrer und Bestellung.';

-- ============================================================
-- 2. Indizes auf delivery_performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_delivery_perf_driver
  ON delivery_performance (driver_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_perf_location
  ON delivery_performance (location_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_perf_order
  ON delivery_performance (order_id);

-- Partial-Index für SLA-Berechnungen (nur Dropoffs mit ETA)
CREATE INDEX IF NOT EXISTS idx_delivery_perf_sla
  ON delivery_performance (driver_id, on_time, recorded_at DESC)
  WHERE eta_latest_at IS NOT NULL;

-- ============================================================
-- 3. recompute_driver_rating() Funktion
--    Berechnet rating (1-5) + avg_delivery_min aus letzten 30 Lieferungen.
-- ============================================================
CREATE OR REPLACE FUNCTION recompute_driver_rating(p_driver_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_on_time_rate    numeric;
  v_avg_dev_min     numeric;
  v_avg_del_min     numeric;
  v_sample_count    int;
  v_new_rating      numeric;
BEGIN
  -- Letzte 30 abgeschlossene Lieferungen mit ETA
  SELECT
    COUNT(*)                                          AS cnt,
    COALESCE(AVG(CASE WHEN on_time THEN 1 ELSE 0 END), 0) AS on_time_rate,
    COALESCE(AVG(eta_deviation_min), 0)               AS avg_dev,
    COALESCE(AVG(delivery_min) FILTER (WHERE delivery_min IS NOT NULL AND delivery_min > 0), 25) AS avg_del
  INTO v_sample_count, v_on_time_rate, v_avg_dev_min, v_avg_del_min
  FROM (
    SELECT on_time, eta_deviation_min, delivery_min
    FROM delivery_performance
    WHERE driver_id = p_driver_id
      AND eta_latest_at IS NOT NULL
    ORDER BY recorded_at DESC
    LIMIT 30
  ) sub;

  -- Weniger als 3 Datenpunkte → kein Update (zu wenig Datenbasis)
  IF v_sample_count < 3 THEN
    RETURN;
  END IF;

  -- Rating 1–5 aus On-Time-Rate + Abweichung
  v_new_rating := CASE
    WHEN v_on_time_rate >= 0.95 AND v_avg_dev_min <= 5  THEN 5.0
    WHEN v_on_time_rate >= 0.85 AND v_avg_dev_min <= 10 THEN 4.5
    WHEN v_on_time_rate >= 0.75                          THEN 4.0
    WHEN v_on_time_rate >= 0.60                          THEN 3.0
    WHEN v_on_time_rate >= 0.45                          THEN 2.0
    ELSE 1.0
  END;

  -- mise_drivers aktualisieren
  UPDATE mise_drivers
  SET
    rating           = v_new_rating,
    avg_delivery_min = ROUND(v_avg_del_min)::int
  WHERE id = p_driver_id;
END;
$$;

COMMENT ON FUNCTION recompute_driver_rating IS
  'Berechnet mise_drivers.rating (1–5) und avg_delivery_min aus letzten 30 delivery_performance-Einträgen.';

-- ============================================================
-- 4. record_stop_performance() — Hilfsfunktion für den Trigger
-- ============================================================
CREATE OR REPLACE FUNCTION record_stop_performance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_id     uuid;
  v_location_id   uuid;
  v_zone          text;
  v_eta_earliest  timestamptz;
  v_eta_latest    timestamptz;
  v_started_at    timestamptz;
  v_dev_min       int;
  v_del_min       int;
  v_on_time       boolean;
BEGIN
  -- Nur Dropoff-Stops (Kundenlieferungen), nicht Pickups
  IF NEW.type IS DISTINCT FROM 'dropoff' THEN
    RETURN NEW;
  END IF;

  -- Batch-Daten laden (driver_id, started_at)
  SELECT b.driver_id, b.started_at
  INTO v_driver_id, v_started_at
  FROM mise_delivery_batches b
  WHERE b.id = NEW.batch_id;

  IF v_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Order-Daten laden (ETA, location, zone)
  SELECT
    o.eta_earliest, o.eta_latest, o.location_id, o.delivery_zone
  INTO v_eta_earliest, v_eta_latest, v_location_id, v_zone
  FROM customer_orders o
  WHERE o.id = NEW.order_id;

  -- ETA-Abweichung berechnen (nur wenn ETA gesetzt)
  IF v_eta_latest IS NOT NULL THEN
    v_dev_min := ROUND(EXTRACT(EPOCH FROM (NEW.completed_at - v_eta_latest)) / 60)::int;
    v_on_time  := NEW.completed_at <= v_eta_latest;
  END IF;

  -- Tatsächliche Lieferzeit (ab Tour-Start)
  IF v_started_at IS NOT NULL THEN
    v_del_min := GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NEW.completed_at - v_started_at)) / 60))::int;
  END IF;

  -- Eintrag in delivery_performance schreiben
  INSERT INTO delivery_performance (
    driver_id, order_id, batch_id, batch_stop_id, location_id,
    zone, eta_earliest_at, eta_latest_at,
    completed_at, eta_deviation_min, on_time, delivery_min
  ) VALUES (
    v_driver_id, NEW.order_id, NEW.batch_id, NEW.id, v_location_id,
    v_zone, v_eta_earliest, v_eta_latest,
    NEW.completed_at, v_dev_min, v_on_time, v_del_min
  )
  ON CONFLICT DO NOTHING;

  -- Driver-Rating asynchron neu berechnen (best-effort, kein Fehler-Throw)
  BEGIN
    PERFORM recompute_driver_rating(v_driver_id);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Rating-Update scheitert nie lautlos den Stop
  END;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. Trigger auf mise_delivery_batch_stops
-- ============================================================
DROP TRIGGER IF EXISTS trg_perf_on_stop_complete ON mise_delivery_batch_stops;

CREATE TRIGGER trg_perf_on_stop_complete
  AFTER UPDATE OF completed_at ON mise_delivery_batch_stops
  FOR EACH ROW
  WHEN (NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL)
  EXECUTE FUNCTION record_stop_performance();

-- ============================================================
-- 6. v_delivery_sla VIEW — Aggregierter SLA-Bericht
-- ============================================================
CREATE OR REPLACE VIEW v_delivery_sla AS
SELECT
  dp.location_id,
  dp.driver_id,
  dp.zone,
  DATE(dp.recorded_at)                                                  AS delivery_date,
  COUNT(*)                                                               AS total_stops,
  COUNT(*) FILTER (WHERE dp.on_time = true)                             AS on_time_count,
  COUNT(*) FILTER (WHERE dp.on_time = false)                            AS late_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE dp.on_time = true) / NULLIF(COUNT(*), 0),
    1
  )                                                                      AS on_time_pct,
  ROUND(AVG(dp.eta_deviation_min) FILTER (WHERE dp.eta_deviation_min IS NOT NULL), 1)
                                                                         AS avg_deviation_min,
  ROUND(AVG(dp.delivery_min) FILTER (WHERE dp.delivery_min IS NOT NULL), 1)
                                                                         AS avg_delivery_min,
  MAX(dp.eta_deviation_min)                                              AS max_deviation_min,
  MIN(dp.eta_deviation_min)                                              AS min_deviation_min
FROM delivery_performance dp
WHERE dp.eta_latest_at IS NOT NULL
GROUP BY dp.location_id, dp.driver_id, dp.zone, DATE(dp.recorded_at);

COMMENT ON VIEW v_delivery_sla IS
  'SLA-Bericht: On-Time-Rate, Abweichung und Lieferzeit pro Fahrer/Zone/Tag.';

-- ============================================================
-- 7. Sicherheits-Defaults (falls Spalten noch NULL-Werte haben)
-- ============================================================
-- mise_drivers.rating Default sicherstellen (verwendet in scoreHistory)
ALTER TABLE mise_drivers
  ALTER COLUMN rating SET DEFAULT 4.5;

-- mise_drivers.avg_delivery_min Default sicherstellen
ALTER TABLE mise_drivers
  ALTER COLUMN avg_delivery_min SET DEFAULT 25;
