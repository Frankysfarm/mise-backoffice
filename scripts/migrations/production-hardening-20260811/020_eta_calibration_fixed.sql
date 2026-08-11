BEGIN;

-- Corrected production variant of migration 030: employees.auth_user_id,
-- security-invoker reporting, and explicit least-privilege grants.

CREATE TABLE IF NOT EXISTS public.eta_accuracy_log (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id            uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  order_id               uuid NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  batch_id               uuid REFERENCES public.mise_delivery_batches(id) ON DELETE SET NULL,
  driver_id              uuid REFERENCES public.mise_drivers(id) ON DELETE SET NULL,
  zone                   text NOT NULL,
  vehicle                text NOT NULL,
  hour_of_day            smallint NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  day_of_week            smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  predicted_earliest_min numeric(8,2) NOT NULL,
  predicted_latest_min   numeric(8,2) NOT NULL,
  predicted_at           timestamptz NOT NULL DEFAULT now(),
  actual_min             numeric(8,2),
  delivered_at           timestamptz,
  on_time                boolean GENERATED ALWAYS AS (
    actual_min IS NOT NULL AND actual_min <= predicted_latest_min
  ) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS eta_accuracy_log_order_uq
  ON public.eta_accuracy_log(order_id);
CREATE INDEX IF NOT EXISTS eta_accuracy_log_location_zone
  ON public.eta_accuracy_log(location_id, zone, vehicle, hour_of_day)
  WHERE actual_min IS NOT NULL;
CREATE INDEX IF NOT EXISTS eta_accuracy_log_pending
  ON public.eta_accuracy_log(location_id) WHERE actual_min IS NULL;

CREATE TABLE IF NOT EXISTS public.eta_calibration_factors (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id        uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  zone               text NOT NULL,
  vehicle            text NOT NULL,
  hour_bucket        smallint NOT NULL CHECK (hour_bucket BETWEEN 0 AND 3),
  calibration_factor numeric(6,4) NOT NULL DEFAULT 1.0,
  sample_count       integer NOT NULL DEFAULT 0,
  avg_error_min      numeric(8,2),
  on_time_rate       numeric(5,4),
  last_updated       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, zone, vehicle, hour_bucket)
);

CREATE INDEX IF NOT EXISTS eta_calibration_factors_location
  ON public.eta_calibration_factors(location_id);

ALTER TABLE public.eta_accuracy_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eta_calibration_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_eta_accuracy_log ON public.eta_accuracy_log;
DROP POLICY IF EXISTS authenticated_select_eta_accuracy_log ON public.eta_accuracy_log;
DROP POLICY IF EXISTS service_role_all_eta_calibration_factors ON public.eta_calibration_factors;
DROP POLICY IF EXISTS authenticated_select_eta_calibration_factors ON public.eta_calibration_factors;

CREATE POLICY service_role_all_eta_accuracy_log
  ON public.eta_accuracy_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY authenticated_select_eta_accuracy_log
  ON public.eta_accuracy_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid()
        AND e.location_id = eta_accuracy_log.location_id
    )
  );

CREATE POLICY service_role_all_eta_calibration_factors
  ON public.eta_calibration_factors FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY authenticated_select_eta_calibration_factors
  ON public.eta_calibration_factors FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid()
        AND e.location_id = eta_calibration_factors.location_id
    )
  );

REVOKE ALL PRIVILEGES ON TABLE public.eta_accuracy_log, public.eta_calibration_factors
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.eta_accuracy_log, public.eta_calibration_factors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.eta_accuracy_log, public.eta_calibration_factors TO service_role;

CREATE OR REPLACE VIEW public.v_eta_accuracy_summary
WITH (security_invoker = true) AS
SELECT
  location_id,
  zone,
  vehicle,
  COUNT(*) FILTER (WHERE actual_min IS NOT NULL) AS completed_deliveries,
  COUNT(*) FILTER (WHERE actual_min IS NULL) AS pending_deliveries,
  ROUND(AVG(actual_min - predicted_latest_min)
    FILTER (WHERE actual_min IS NOT NULL), 2) AS avg_error_min,
  ROUND(
    AVG(CASE WHEN predicted_latest_min > 0
      THEN (actual_min - predicted_latest_min) / predicted_latest_min END)
      FILTER (WHERE actual_min IS NOT NULL),
    4
  ) AS avg_relative_error,
  ROUND(
    COUNT(*) FILTER (WHERE on_time)::numeric
      / NULLIF(COUNT(*) FILTER (WHERE actual_min IS NOT NULL), 0),
    4
  ) AS on_time_rate,
  MIN(predicted_at) AS oldest_prediction,
  MAX(delivered_at) AS latest_delivery
FROM public.eta_accuracy_log
GROUP BY location_id, zone, vehicle;

REVOKE ALL PRIVILEGES ON TABLE public.v_eta_accuracy_summary
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_eta_accuracy_summary TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.recompute_calibration_factors(p_location_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  rows_upserted integer := 0;
BEGIN
  INSERT INTO public.eta_calibration_factors (
    location_id, zone, vehicle, hour_bucket,
    calibration_factor, sample_count, avg_error_min, on_time_rate, last_updated
  )
  SELECT
    p_location_id,
    zone,
    vehicle,
    (hour_of_day / 6)::smallint,
    GREATEST(0.7, LEAST(2.0,
      1.0 + COALESCE(
        AVG(actual_min - predicted_latest_min) / NULLIF(AVG(predicted_latest_min), 0),
        0
      )
    )),
    COUNT(*)::integer,
    ROUND(AVG(actual_min - predicted_latest_min), 2),
    ROUND(COUNT(*) FILTER (WHERE on_time)::numeric / NULLIF(COUNT(*), 0), 4),
    now()
  FROM public.eta_accuracy_log
  WHERE location_id = p_location_id
    AND actual_min IS NOT NULL
    AND predicted_at >= now() - interval '30 days'
  GROUP BY zone, vehicle, (hour_of_day / 6)::smallint
  HAVING COUNT(*) >= 5
  ON CONFLICT (location_id, zone, vehicle, hour_bucket) DO UPDATE SET
    calibration_factor = EXCLUDED.calibration_factor,
    sample_count = EXCLUDED.sample_count,
    avg_error_min = EXCLUDED.avg_error_min,
    on_time_rate = EXCLUDED.on_time_rate,
    last_updated = now();

  GET DIAGNOSTICS rows_upserted = ROW_COUNT;
  RETURN rows_upserted;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_calibration_factors(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_calibration_factors(uuid) TO service_role;

COMMIT;
