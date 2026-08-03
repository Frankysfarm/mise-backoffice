SELECT public.fn_dispatch_set_writer_v2(
  '80000000-0000-4000-8000-000000000001', 'atomic_v2', true
);
SELECT public.fn_dispatch_claim_writer_v2(
  '80000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001', 120
);

-- The production server uses Supabase's service_role for the canonical Driver
-- snapshot. A bare PostgreSQL lab does not inherit Supabase's default grants,
-- so model the exact read boundary explicitly while leaving browser roles out.
GRANT SELECT ON public.mise_drivers, public.mise_driver_tenants,
  public.dispatch_offer_assignments, public.mise_delivery_batches,
  public.mise_delivery_batch_stops, public.customer_orders, public.order_items,
  public.driver_item_outcomes_v2, public.driver_exceptions_v2
TO service_role;
