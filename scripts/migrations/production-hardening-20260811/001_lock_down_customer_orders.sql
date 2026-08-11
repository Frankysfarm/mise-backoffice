BEGIN;

DROP POLICY IF EXISTS orders_public_read_by_bon ON public.customer_orders;
DROP POLICY IF EXISTS order_items_public ON public.order_items;
DROP POLICY IF EXISTS orders_authenticated_tenant_select ON public.customer_orders;
DROP POLICY IF EXISTS order_items_authenticated_tenant_select ON public.order_items;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.customer_orders FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.order_items FROM anon;

CREATE POLICY orders_authenticated_tenant_select
  ON public.customer_orders
  FOR SELECT
  TO authenticated
  USING (
    location_id IN (
      SELECT l.id
      FROM public.locations AS l
      WHERE l.tenant_id = public.current_tenant_id()
    )
  );

CREATE POLICY order_items_authenticated_tenant_select
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customer_orders AS o
      JOIN public.locations AS l ON l.id = o.location_id
      WHERE o.id = order_items.order_id
        AND l.tenant_id = public.current_tenant_id()
    )
  );

COMMIT;
