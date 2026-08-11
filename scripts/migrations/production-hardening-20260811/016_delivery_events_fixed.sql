BEGIN;

-- Corrected production variant of migration 006.
-- The original authenticated policy exposed events across every tenant and
-- installed a second delivery_zones update trigger. The existing compatibility
-- trigger already maintains delivery_zones.updated_at.

CREATE TABLE IF NOT EXISTS public.delivery_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  order_id    uuid REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  batch_id    uuid REFERENCES public.mise_delivery_batches(id) ON DELETE SET NULL,
  driver_id   uuid REFERENCES public.mise_drivers(id) ON DELETE SET NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.delivery_events IS
  'Tenant-scoped audit trail for smart-delivery lifecycle events.';

CREATE INDEX IF NOT EXISTS idx_delivery_events_location_at
  ON public.delivery_events (location_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_events_order
  ON public.delivery_events (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_events_batch
  ON public.delivery_events (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_events_type
  ON public.delivery_events (event_type, location_id, occurred_at DESC);

ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_events_service_all ON public.delivery_events;
DROP POLICY IF EXISTS delivery_events_auth_select ON public.delivery_events;

CREATE POLICY delivery_events_service_all
  ON public.delivery_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY delivery_events_auth_select
  ON public.delivery_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.auth_user_id = auth.uid()
        AND e.location_id = delivery_events.location_id
    )
  );

REVOKE ALL PRIVILEGES ON TABLE public.delivery_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.delivery_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_events TO service_role;

CREATE OR REPLACE VIEW public.v_delivery_today_stats
WITH (security_invoker = true) AS
SELECT
  co.location_id,
  COUNT(*) AS total_orders,
  COUNT(*) FILTER (WHERE co.status IN ('abgeschlossen', 'geliefert')) AS delivered_orders,
  COUNT(*) FILTER (WHERE co.status IN ('neu', 'bestätigt', 'in_zubereitung')) AS pending_orders,
  COUNT(*) FILTER (WHERE co.dispatch_score IS NOT NULL) AS dispatched_orders,
  ROUND(AVG(co.dispatch_score)::numeric, 1) AS avg_dispatch_score,
  COUNT(DISTINCT co.mise_batch_id)
    FILTER (WHERE co.mise_batch_id IS NOT NULL) AS active_batches,
  COUNT(*) FILTER (WHERE co.delivery_zone = 'A') AS zone_a,
  COUNT(*) FILTER (WHERE co.delivery_zone = 'B') AS zone_b,
  COUNT(*) FILTER (WHERE co.delivery_zone = 'C') AS zone_c,
  COUNT(*) FILTER (WHERE co.delivery_zone = 'D') AS zone_d
FROM public.customer_orders co
WHERE co.typ = 'lieferung'
  AND co.created_at >=
    date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
GROUP BY co.location_id;

COMMENT ON VIEW public.v_delivery_today_stats IS
  'Tenant-filtered daily delivery KPIs per location.';

REVOKE ALL PRIVILEGES ON TABLE public.v_delivery_today_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_delivery_today_stats TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_delivery_trends(p_location_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH today AS (
    SELECT
      COUNT(*) AS orders,
      COUNT(*) FILTER (WHERE status IN ('abgeschlossen', 'geliefert')) AS delivered,
      ROUND(AVG(dispatch_score)::numeric, 1) AS avg_score
    FROM public.customer_orders
    WHERE location_id = p_location_id
      AND typ = 'lieferung'
      AND created_at >=
        date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
  ),
  yesterday AS (
    SELECT
      COUNT(*) AS orders,
      COUNT(*) FILTER (WHERE status IN ('abgeschlossen', 'geliefert')) AS delivered,
      ROUND(AVG(dispatch_score)::numeric, 1) AS avg_score
    FROM public.customer_orders
    WHERE location_id = p_location_id
      AND typ = 'lieferung'
      AND created_at >=
        (date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') - interval '1 day') AT TIME ZONE 'Europe/Berlin'
      AND created_at <
        date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
  )
  SELECT jsonb_build_object(
    'today', jsonb_build_object(
      'orders', t.orders, 'delivered', t.delivered, 'avg_score', t.avg_score
    ),
    'yesterday', jsonb_build_object(
      'orders', y.orders, 'delivered', y.delivered, 'avg_score', y.avg_score
    ),
    'delta_orders', t.orders - y.orders,
    'delta_delivered', t.delivered - y.delivered
  )
  FROM today t, yesterday y;
$$;

REVOKE ALL ON FUNCTION public.get_delivery_trends(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_trends(uuid) TO authenticated, service_role;

COMMIT;
