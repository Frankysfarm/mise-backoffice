-- ============================================================
-- Migration 030: ETA Accuracy Calibration Engine
-- Phase 36 — 2026-06-05
--
-- Zeichnet Vorhersage vs. Realität jeder Lieferung auf.
-- Berechnet Kalibrierungsfaktoren pro Zone/Fahrzeug/Tageszeit.
-- Wird von lib/delivery/eta-calibration.ts verwendet.
-- ============================================================

-- ── 1. ETA Accuracy Log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eta_accuracy_log (
  id                      uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id             uuid          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id                uuid          NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  batch_id                uuid          REFERENCES mise_delivery_batches(id) ON DELETE SET NULL,
  driver_id               uuid          REFERENCES mise_drivers(id) ON DELETE SET NULL,
  zone                    text          NOT NULL,      -- A/B/C/D
  vehicle                 text          NOT NULL,      -- bike/car
  hour_of_day             smallint      NOT NULL,      -- 0–23 UTC
  day_of_week             smallint      NOT NULL,      -- 0=Mon, 6=Sun
  -- Vorhersage (zum Dispatch-Zeitpunkt)
  predicted_earliest_min  numeric(8,2)  NOT NULL,
  predicted_latest_min    numeric(8,2)  NOT NULL,
  predicted_at            timestamptz   NOT NULL DEFAULT now(),
  -- Realität (eingetragen nach Lieferung)
  actual_min              numeric(8,2),
  delivered_at            timestamptz,
  -- Computed: war Lieferung pünktlich? (actual <= predicted_latest)
  on_time                 boolean GENERATED ALWAYS AS (
    actual_min IS NOT NULL AND actual_min <= predicted_latest_min
  ) STORED
);

-- Genau ein Log-Eintrag pro Bestellung
CREATE UNIQUE INDEX IF NOT EXISTS eta_accuracy_log_order_uq
  ON eta_accuracy_log (order_id);

-- Aggregations-Index (nur abgeschlossene Lieferungen)
CREATE INDEX IF NOT EXISTS eta_accuracy_log_location_zone
  ON eta_accuracy_log (location_id, zone, vehicle, hour_of_day)
  WHERE actual_min IS NOT NULL;

-- Offene Einträge (noch nicht geliefert)
CREATE INDEX IF NOT EXISTS eta_accuracy_log_pending
  ON eta_accuracy_log (location_id)
  WHERE actual_min IS NULL;

-- ── 2. Calibration Factors ────────────────────────────────────────────────────
-- hour_bucket:
--   0 = 00:00–05:59  (Nacht)
--   1 = 06:00–11:59  (Morgen)
--   2 = 12:00–17:59  (Mittag/Nachmittag)
--   3 = 18:00–23:59  (Abend)
CREATE TABLE IF NOT EXISTS eta_calibration_factors (
  id                  uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id         uuid          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  zone                text          NOT NULL,
  vehicle             text          NOT NULL,
  hour_bucket         smallint      NOT NULL,   -- 0..3
  -- Kalibrierungsmultiplikator: 1.0 = neutral, >1 = zu optimistisch, <1 = zu pessimistisch
  calibration_factor  numeric(6,4)  NOT NULL DEFAULT 1.0,
  -- Statistische Grundlage
  sample_count        integer       NOT NULL DEFAULT 0,
  avg_error_min       numeric(8,2),
  on_time_rate        numeric(5,4),             -- 0.0–1.0
  last_updated        timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (location_id, zone, vehicle, hour_bucket)
);

CREATE INDEX IF NOT EXISTS eta_calibration_factors_location
  ON eta_calibration_factors (location_id);

-- ── 3. Accuracy Summary VIEW ──────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_eta_accuracy_summary AS
SELECT
  location_id,
  zone,
  vehicle,
  COUNT(*)             FILTER (WHERE actual_min IS NOT NULL)  AS completed_deliveries,
  COUNT(*)             FILTER (WHERE actual_min IS NULL)      AS pending_deliveries,
  ROUND(AVG(actual_min - predicted_latest_min)
        FILTER (WHERE actual_min IS NOT NULL), 2)             AS avg_error_min,
  ROUND(
    AVG(CASE
      WHEN predicted_latest_min > 0
      THEN (actual_min - predicted_latest_min) / predicted_latest_min
    END) FILTER (WHERE actual_min IS NOT NULL),
    4
  )                                                           AS avg_relative_error,
  ROUND(
    COUNT(*) FILTER (WHERE on_time = TRUE)::numeric
    / NULLIF(COUNT(*) FILTER (WHERE actual_min IS NOT NULL), 0),
    4
  )                                                           AS on_time_rate,
  MIN(predicted_at)                                           AS oldest_prediction,
  MAX(delivered_at)                                           AS latest_delivery
FROM eta_accuracy_log
GROUP BY location_id, zone, vehicle;

-- ── 4. Recompute PL/pgSQL Function ───────────────────────────────────────────
-- Berechnet Kalibrierungsfaktoren aus den letzten 30 Tagen (min 5 Samples).
-- Faktor = 1 + (avg_error / avg_predicted_latest)
-- Klemmt auf [0.7, 2.0] für Stabilität.
CREATE OR REPLACE FUNCTION recompute_calibration_factors(p_location_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  rows_upserted integer := 0;
BEGIN
  INSERT INTO eta_calibration_factors (
    location_id, zone, vehicle, hour_bucket,
    calibration_factor, sample_count, avg_error_min, on_time_rate, last_updated
  )
  SELECT
    p_location_id                         AS location_id,
    zone,
    vehicle,
    (hour_of_day / 6)::smallint           AS hour_bucket,
    GREATEST(0.7, LEAST(2.0,
      1.0 + COALESCE(
        AVG(actual_min - predicted_latest_min)
        / NULLIF(AVG(predicted_latest_min), 0),
        0
      )
    ))                                    AS calibration_factor,
    COUNT(*)::integer                     AS sample_count,
    ROUND(AVG(actual_min - predicted_latest_min), 2)
                                          AS avg_error_min,
    ROUND(
      COUNT(*) FILTER (WHERE on_time = TRUE)::numeric
      / NULLIF(COUNT(*), 0),
      4
    )                                     AS on_time_rate,
    now()                                 AS last_updated
  FROM  eta_accuracy_log
  WHERE location_id  = p_location_id
    AND actual_min   IS NOT NULL
    AND predicted_at >= now() - interval '30 days'
  GROUP BY zone, vehicle, (hour_of_day / 6)::smallint
  HAVING COUNT(*) >= 5
  ON CONFLICT (location_id, zone, vehicle, hour_bucket) DO UPDATE SET
    calibration_factor = EXCLUDED.calibration_factor,
    sample_count       = EXCLUDED.sample_count,
    avg_error_min      = EXCLUDED.avg_error_min,
    on_time_rate       = EXCLUDED.on_time_rate,
    last_updated       = now();

  GET DIAGNOSTICS rows_upserted = ROW_COUNT;
  RETURN rows_upserted;
END;
$$;

-- ── 5. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE eta_accuracy_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE eta_calibration_factors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- service_role: voller Zugriff
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'eta_accuracy_log' AND policyname = 'service_role_all_eta_accuracy_log'
  ) THEN
    CREATE POLICY "service_role_all_eta_accuracy_log"
      ON eta_accuracy_log FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'eta_calibration_factors' AND policyname = 'service_role_all_eta_calibration_factors'
  ) THEN
    CREATE POLICY "service_role_all_eta_calibration_factors"
      ON eta_calibration_factors FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  -- authenticated: nur eigene Location
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'eta_accuracy_log' AND policyname = 'authenticated_select_eta_accuracy_log'
  ) THEN
    CREATE POLICY "authenticated_select_eta_accuracy_log"
      ON eta_accuracy_log FOR SELECT TO authenticated
      USING (
        location_id IN (
          SELECT location_id FROM employees WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'eta_calibration_factors' AND policyname = 'authenticated_select_eta_calibration_factors'
  ) THEN
    CREATE POLICY "authenticated_select_eta_calibration_factors"
      ON eta_calibration_factors FOR SELECT TO authenticated
      USING (
        location_id IN (
          SELECT location_id FROM employees WHERE user_id = auth.uid()
        )
      );
  END IF;
END;
$$;
