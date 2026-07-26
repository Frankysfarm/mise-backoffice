\set ON_ERROR_STOP on

DO $disable$
DECLARE
  v_before bigint;
  v_disable jsonb;
  v_result jsonb;
BEGIN
  SELECT count(*) INTO v_before FROM dispatch_offer_assignments;
  v_disable := fn_dispatch_set_writer_v2(
    '11000000-0000-0000-0000-000000000001', 'atomic_v2', false
  );
  v_result := fn_dispatch_assign_orders_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001', 1,
    '13000000-0000-0000-0000-000000000003', 0,
    '16000000-0000-0000-0000-000000000099', 'atomic-v2-test',
    jsonb_build_array(jsonb_build_object(
      'order_id', gen_random_uuid(), 'expected_order_version', 0,
      'pickup_lat', 52.0, 'pickup_lng', 13.0,
      'dropoff_lat', 52.1, 'dropoff_lng', 13.1,
      'pickup_deadline_at', now() + interval '20 minutes',
      'delivery_deadline_at', now() + interval '45 minutes'
    )), 'disabled', 'disabled'
  );
  IF NOT coalesce((v_disable->>'ok')::boolean, false)
     OR v_result->>'reason_code' <> 'WRITER_LEASE_STALE_OR_NOT_OWNER'
     OR (SELECT count(*) FROM dispatch_offer_assignments) <> v_before
     OR EXISTS (
       SELECT 1 FROM dispatch_writer_gates
       WHERE tenant_id = '11000000-0000-0000-0000-000000000001'
         AND (enabled OR active_writer_id IS NOT NULL OR lease_expires_at IS NOT NULL)
     ) THEN
    RAISE EXCEPTION 'disable rollback path failed: %, %', v_disable, v_result;
  END IF;
END
$disable$;
