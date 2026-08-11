BEGIN;

-- Corrected production variant of migration 029. Driver/location association
-- is carried by the trail/batch and mise_driver_tenants, not mise_drivers.

CREATE TABLE IF NOT EXISTS public.driver_gps_trail (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid NOT NULL REFERENCES public.mise_drivers(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  batch_id    uuid REFERENCES public.mise_delivery_batches(id) ON DELETE SET NULL,
  lat         double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng         double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy_m  real CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  speed_kmh   real,
  heading_deg smallint CHECK (heading_deg IS NULL OR heading_deg BETWEEN 0 AND 360),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_geofence_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      uuid NOT NULL REFERENCES public.mise_drivers(id) ON DELETE CASCADE,
  location_id    uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  batch_id       uuid REFERENCES public.mise_delivery_batches(id) ON DELETE SET NULL,
  event_type     text NOT NULL CHECK (
    event_type IN ('arrived_restaurant', 'arrived_customer', 'departed_restaurant')
  ),
  order_id       uuid REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  lat            double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng            double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  distance_m     real CHECK (distance_m IS NULL OR distance_m >= 0),
  triggered_at   timestamptz NOT NULL DEFAULT now(),
  auto_processed boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_gps_trail_driver_time
  ON public.driver_gps_trail(driver_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_gps_trail_location_time
  ON public.driver_gps_trail(location_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_gps_trail_batch
  ON public.driver_gps_trail(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_geofence_driver_time
  ON public.driver_geofence_events(driver_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_geofence_batch
  ON public.driver_geofence_events(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_geofence_location_time
  ON public.driver_geofence_events(location_id, triggered_at DESC);

ALTER TABLE public.driver_gps_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_geofence_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all_gps_trail ON public.driver_gps_trail;
DROP POLICY IF EXISTS authenticated_read_gps_trail ON public.driver_gps_trail;
DROP POLICY IF EXISTS service_role_all_geofence_events ON public.driver_geofence_events;
DROP POLICY IF EXISTS authenticated_read_geofence_events ON public.driver_geofence_events;

CREATE POLICY service_role_all_gps_trail
  ON public.driver_gps_trail FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY authenticated_read_gps_trail
  ON public.driver_gps_trail FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid()
        AND e.location_id = driver_gps_trail.location_id
    )
  );

CREATE POLICY service_role_all_geofence_events
  ON public.driver_geofence_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY authenticated_read_geofence_events
  ON public.driver_geofence_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid()
        AND e.location_id = driver_geofence_events.location_id
    )
  );

REVOKE ALL PRIVILEGES ON TABLE public.driver_gps_trail, public.driver_geofence_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.driver_gps_trail, public.driver_geofence_events
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.driver_gps_trail, public.driver_geofence_events TO service_role;

CREATE OR REPLACE VIEW public.v_driver_last_gps
WITH (security_invoker = true) AS
SELECT DISTINCT ON (t.driver_id)
  t.driver_id,
  t.location_id,
  t.batch_id,
  t.lat,
  t.lng,
  t.accuracy_m,
  t.speed_kmh,
  t.heading_deg,
  t.recorded_at,
  d.name AS driver_name,
  d.state AS driver_state,
  d.vehicle
FROM public.driver_gps_trail t
JOIN public.mise_drivers d ON d.id = t.driver_id
ORDER BY t.driver_id, t.recorded_at DESC;

CREATE OR REPLACE VIEW public.v_active_driver_trails
WITH (security_invoker = true) AS
SELECT
  d.id AS driver_id,
  d.name AS driver_name,
  d.state AS driver_state,
  d.vehicle,
  latest.location_id,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'lat', trail.lat,
          'lng', trail.lng,
          'speed_kmh', trail.speed_kmh,
          'recorded_at', trail.recorded_at
        ) ORDER BY trail.recorded_at
      )
      FROM (
        SELECT t.lat, t.lng, t.speed_kmh, t.recorded_at
        FROM public.driver_gps_trail t
        WHERE t.driver_id = d.id
          AND t.recorded_at > now() - interval '30 minutes'
        ORDER BY t.recorded_at DESC
        LIMIT 60
      ) trail
    ),
    '[]'::json
  ) AS trail_points
FROM public.mise_drivers d
LEFT JOIN LATERAL (
  SELECT t.location_id
  FROM public.driver_gps_trail t
  WHERE t.driver_id = d.id
  ORDER BY t.recorded_at DESC
  LIMIT 1
) latest ON true
WHERE d.state <> 'offline';

REVOKE ALL PRIVILEGES ON TABLE public.v_driver_last_gps, public.v_active_driver_trails
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_driver_last_gps, public.v_active_driver_trails
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cleanup_old_gps_trails()
RETURNS TABLE(deleted_trail_rows bigint, deleted_geofence_rows bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trail bigint;
  v_geofence bigint;
BEGIN
  DELETE FROM public.driver_gps_trail
  WHERE recorded_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_trail = ROW_COUNT;

  DELETE FROM public.driver_geofence_events
  WHERE triggered_at < now() - interval '7 days';
  GET DIAGNOSTICS v_geofence = ROW_COUNT;

  RETURN QUERY SELECT v_trail, v_geofence;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_gps_trails() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_gps_trails() TO service_role;

COMMIT;
