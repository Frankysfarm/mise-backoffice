BEGIN;

-- Corrected production variant of migration 019.
-- locations.id is uuid (not text), and forecast data must be tenant-scoped.

CREATE TABLE IF NOT EXISTS public.delivery_demand_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  snapshot_hour    timestamptz NOT NULL,
  orders_count     integer NOT NULL DEFAULT 0,
  delivered_count  integer NOT NULL DEFAULT 0,
  avg_delivery_min double precision,
  peak_zone        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_demand_snapshot_uniq
  ON public.delivery_demand_snapshots (location_id, snapshot_hour);
CREATE INDEX IF NOT EXISTS idx_demand_snapshot_loc_hour
  ON public.delivery_demand_snapshots (location_id, snapshot_hour DESC);

ALTER TABLE public.delivery_demand_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_demand_snapshots_service_all
  ON public.delivery_demand_snapshots;
DROP POLICY IF EXISTS delivery_demand_snapshots_auth_select
  ON public.delivery_demand_snapshots;

CREATE POLICY delivery_demand_snapshots_service_all
  ON public.delivery_demand_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY delivery_demand_snapshots_auth_select
  ON public.delivery_demand_snapshots FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_user_id = auth.uid()
        AND e.location_id = delivery_demand_snapshots.location_id
    )
  );

REVOKE ALL PRIVILEGES ON TABLE public.delivery_demand_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.delivery_demand_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_demand_snapshots TO service_role;

CREATE OR REPLACE VIEW public.v_hourly_demand_pattern
WITH (security_invoker = true) AS
SELECT
  location_id,
  EXTRACT(DOW FROM snapshot_hour AT TIME ZONE 'Europe/Berlin') AS weekday,
  EXTRACT(HOUR FROM snapshot_hour AT TIME ZONE 'Europe/Berlin') AS hour_of_day,
  ROUND(AVG(orders_count)::numeric, 1) AS avg_orders,
  ROUND(STDDEV(orders_count)::numeric, 1) AS stddev_orders,
  MAX(orders_count) AS peak_orders,
  ROUND(AVG(avg_delivery_min)::numeric, 1) AS avg_delivery_min,
  COUNT(*) AS data_points
FROM public.delivery_demand_snapshots
WHERE snapshot_hour >= now() - interval '8 weeks'
GROUP BY location_id, weekday, hour_of_day;

CREATE OR REPLACE VIEW public.v_forecast_coverage_recs
WITH (security_invoker = true) AS
SELECT
  location_id,
  weekday,
  hour_of_day,
  avg_orders,
  peak_orders,
  data_points,
  GREATEST(
    CASE WHEN avg_orders > 0 THEN 1 ELSE 0 END,
    CEIL(avg_orders / 3.0)::integer
  ) AS recommended_min_drivers,
  GREATEST(
    CASE WHEN peak_orders > 0 THEN 1 ELSE 0 END,
    CEIL(peak_orders / 3.0)::integer
  ) AS recommended_target_drivers
FROM public.v_hourly_demand_pattern
WHERE data_points >= 2;

REVOKE ALL PRIVILEGES ON TABLE public.v_hourly_demand_pattern FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.v_forecast_coverage_recs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_hourly_demand_pattern TO authenticated, service_role;
GRANT SELECT ON TABLE public.v_forecast_coverage_recs TO authenticated, service_role;

COMMIT;
