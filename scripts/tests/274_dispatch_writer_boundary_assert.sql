\set ON_ERROR_STOP on

DO $test$
DECLARE
  v_legacy_stops bigint := 0;
BEGIN
  IF public.fn_dispatch_writer_for_tenant_v1(
       '11000000-0000-0000-0000-000000000002'
     ) IS DISTINCT FROM 'atomic_v1' THEN
    RAISE EXCEPTION 'writer switch did not commit atomic_v1';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.customer_orders
    WHERE id = '30000000-0000-0000-0000-000000000003'
      AND (mise_batch_id IS NOT NULL OR mise_driver_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Mise DB writer crossed the atomic switch boundary';
  END IF;

  IF pg_catalog.to_regclass('public.delivery_batch_stops') IS NOT NULL THEN
    EXECUTE
      'SELECT count(*) FROM public.delivery_batch_stops WHERE order_id = $1'
      INTO v_legacy_stops
      USING '30000000-0000-0000-0000-000000000003'::uuid;
  END IF;
  IF v_legacy_stops <> 0 THEN
    RAISE EXCEPTION 'legacy DB writer crossed the atomic switch boundary';
  END IF;
END
$test$;
