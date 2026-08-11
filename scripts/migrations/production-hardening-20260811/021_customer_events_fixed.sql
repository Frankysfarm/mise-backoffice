BEGIN;

-- Corrected production variant of migration 031. Anonymous direct table reads
-- would allow listing every tenant's event feed, so public tracking reads remain
-- mediated by the existing UUID-scoped server endpoint.

CREATE TABLE IF NOT EXISTS public.customer_delivery_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  event_type  text NOT NULL CHECK (
    event_type IN (
      'driver_assigned', 'driver_at_restaurant', 'driver_departing',
      'driver_nearby', 'delivered', 'cancelled', 'delayed'
    )
  ),
  message_de  text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cde_order_time
  ON public.customer_delivery_events(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cde_location_time
  ON public.customer_delivery_events(location_id, created_at DESC);

ALTER TABLE public.customer_delivery_events REPLICA IDENTITY FULL;
ALTER TABLE public.customer_delivery_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cde_service_all ON public.customer_delivery_events;
DROP POLICY IF EXISTS cde_anon_read ON public.customer_delivery_events;
DROP POLICY IF EXISTS cde_employee_read ON public.customer_delivery_events;

CREATE POLICY cde_service_all
  ON public.customer_delivery_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY cde_employee_read
  ON public.customer_delivery_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid()
        AND e.location_id = customer_delivery_events.location_id
    )
  );

REVOKE ALL PRIVILEGES ON TABLE public.customer_delivery_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.customer_delivery_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_delivery_events TO service_role;

COMMIT;
