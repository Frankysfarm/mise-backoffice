\set ON_ERROR_STOP on

DO $backfill$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM dispatch_writer_gates
    WHERE tenant_id = '11000000-0000-0000-0000-000000000001'
      AND writer = 'atomic_v2' AND NOT enabled
      AND active_writer_id IS NULL AND lease_expires_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Atomic-v1 gate was not safely backfilled disabled';
  END IF;
END
$backfill$;

INSERT INTO locations (id, tenant_id, name)
VALUES (
  '12000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'T02 location'
);

INSERT INTO mise_drivers (id, name, active, state, last_position_at, max_capacity)
VALUES
  ('13000000-0000-0000-0000-000000000001', 'T02 driver 1', true, 'idle', now(), 4),
  ('13000000-0000-0000-0000-000000000002', 'T02 driver 2', true, 'idle', now(), 4),
  ('13000000-0000-0000-0000-000000000003', 'T02 driver 3', true, 'idle', now(), 4),
  ('13000000-0000-0000-0000-000000000004', 'T02 driver 4', true, 'idle', now(), 4),
  ('13000000-0000-0000-0000-000000000005', 'T02 driver 5', true, 'idle', now(), 4),
  ('13000000-0000-0000-0000-000000000006', 'T02 driver 6', true, 'idle', now(), 4);

INSERT INTO mise_driver_tenants (driver_id, tenant_id, status)
SELECT id, '11000000-0000-0000-0000-000000000001', 'active'
FROM mise_drivers;

INSERT INTO customer_orders (
  id, location_id, tenant_id, bestellnummer, kunde_name, typ, status,
  eta_latest
) VALUES
  ('14000000-0000-0000-0000-000000000001',
   '12000000-0000-0000-0000-000000000001',
   '11000000-0000-0000-0000-000000000001',
   'T02-1', 'fixture', 'lieferung', 'fertig', now() + interval '45 minutes'),
  ('14000000-0000-0000-0000-000000000002',
   '12000000-0000-0000-0000-000000000001',
   '11000000-0000-0000-0000-000000000001',
   'T02-2', 'fixture', 'lieferung', 'fertig', now() + interval '45 minutes'),
  ('14000000-0000-0000-0000-000000000003',
   '12000000-0000-0000-0000-000000000001',
   '11000000-0000-0000-0000-000000000001',
   'T02-3', 'fixture', 'lieferung', 'fertig', now() + interval '45 minutes'),
  ('14000000-0000-0000-0000-000000000004',
   '12000000-0000-0000-0000-000000000001',
   '11000000-0000-0000-0000-000000000001',
   'T02-4', 'fixture', 'lieferung', 'fertig', now() + interval '45 minutes'),
  ('14000000-0000-0000-0000-000000000005',
   '12000000-0000-0000-0000-000000000001',
   '11000000-0000-0000-0000-000000000001',
   'T02-5', 'fixture', 'lieferung', 'fertig', now() + interval '45 minutes');

DO $writer$
DECLARE
  v_set jsonb;
  v_first jsonb;
  v_competitor jsonb;
  v_renew jsonb;
BEGIN
  v_set := fn_dispatch_set_writer_v2(
    '11000000-0000-0000-0000-000000000001', 'atomic_v2', true
  );
  IF NOT coalesce((v_set->>'ok')::boolean, false) THEN
    RAISE EXCEPTION 'failed to enable isolated tenant gate: %', v_set;
  END IF;
  v_first := fn_dispatch_claim_writer_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001', 120
  );
  v_competitor := fn_dispatch_claim_writer_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000002', 120
  );
  v_renew := fn_dispatch_claim_writer_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001', 120
  );
  IF NOT coalesce((v_first->>'ok')::boolean, false)
     OR v_competitor->>'reason_code' <> 'TENANT_WRITER_ALREADY_ACTIVE'
     OR (v_renew->>'writer_epoch')::bigint <> (v_first->>'writer_epoch')::bigint THEN
    RAISE EXCEPTION 'tenant single-writer election failed: %, %, %',
      v_first, v_competitor, v_renew;
  END IF;
END
$writer$;

DO $assignment$
DECLARE
  v_first jsonb;
  v_replay jsonb;
  v_conflict jsonb;
  v_stale jsonb;
  v_ack jsonb;
  v_assignment_id uuid;
  v_orders jsonb;
BEGIN
  v_orders := jsonb_build_array(jsonb_build_object(
    'order_id', '14000000-0000-0000-0000-000000000001',
    'expected_order_version', 0,
    'pickup_lat', 52.0, 'pickup_lng', 13.0, 'pickup_address', 'pickup',
    'dropoff_lat', 52.01, 'dropoff_lng', 13.01, 'dropoff_address', 'dropoff',
    'pickup_deadline_at', now() + interval '20 minutes',
    'delivery_deadline_at', now() + interval '45 minutes'
  ));
  v_first := fn_dispatch_assign_orders_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001', 1,
    '13000000-0000-0000-0000-000000000001', 0,
    '16000000-0000-0000-0000-000000000001',
    'atomic-v2-test', v_orders, 'assigned', 'snapshot available'
  );
  v_replay := fn_dispatch_assign_orders_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001', 1,
    '13000000-0000-0000-0000-000000000001', 0,
    '16000000-0000-0000-0000-000000000001',
    'atomic-v2-test', v_orders, 'assigned', 'snapshot available'
  );
  v_conflict := fn_dispatch_assign_orders_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001', 1,
    '13000000-0000-0000-0000-000000000001', 0,
    '16000000-0000-0000-0000-000000000001',
    'atomic-v2-test', v_orders, 'changed-title', 'snapshot available'
  );
  IF NOT coalesce((v_first->>'ok')::boolean, false)
     OR v_first->>'state' <> 'assigned'
     OR NOT coalesce((v_replay->>'idempotent_replay')::boolean, false)
     OR v_replay->>'batch_id' <> v_first->>'batch_id'
     OR v_conflict->>'reason_code' <>
       'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' THEN
    RAISE EXCEPTION 'assignment idempotency contract failed: %, %, %',
      v_first, v_replay, v_conflict;
  END IF;

  v_stale := fn_dispatch_assign_orders_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001', 1,
    '13000000-0000-0000-0000-000000000002', 99,
    '16000000-0000-0000-0000-000000000002',
    'atomic-v2-test',
    jsonb_build_array(jsonb_build_object(
      'order_id', '14000000-0000-0000-0000-000000000002',
      'expected_order_version', 0,
      'pickup_lat', 52.0, 'pickup_lng', 13.0, 'pickup_address', 'pickup',
      'dropoff_lat', 52.02, 'dropoff_lng', 13.02, 'dropoff_address', 'dropoff',
      'pickup_deadline_at', now() + interval '20 minutes',
      'delivery_deadline_at', now() + interval '45 minutes'
    )), 'assigned', 'snapshot available'
  );
  IF v_stale->>'reason_code' <> 'DRIVER_VERSION_CONFLICT' THEN
    RAISE EXCEPTION 'stale driver version did not fail safely: %', v_stale;
  END IF;

  SELECT id INTO v_assignment_id FROM dispatch_offer_assignments
  WHERE order_id = '14000000-0000-0000-0000-000000000001';
  v_ack := fn_dispatch_ack_assignment_v2(
    '11000000-0000-0000-0000-000000000001', v_assignment_id,
    '13000000-0000-0000-0000-000000000001', 1,
    '16000000-0000-0000-0000-000000000003',
    '{"app_version":"fixture"}'::jsonb
  );
  IF NOT coalesce((v_ack->>'ok')::boolean, false)
     OR (v_ack->>'assignment_version')::bigint <> 1
     OR (SELECT assignment_version FROM dispatch_offer_assignments
         WHERE id = v_assignment_id) <> 1 THEN
    RAISE EXCEPTION 'technical ACK changed authority/version: %', v_ack;
  END IF;
END
$assignment$;

DO $atomic_counts$
DECLARE
  v_batch uuid;
  v_assignment dispatch_offer_assignments%ROWTYPE;
BEGIN
  SELECT * INTO v_assignment FROM dispatch_offer_assignments
  WHERE order_id = '14000000-0000-0000-0000-000000000001';
  v_batch:=v_assignment.batch_id;
  IF (SELECT count(*) FROM dispatch_offer_assignments
      WHERE order_id = '14000000-0000-0000-0000-000000000001'
        AND state = 'assigned') <> 1
     OR (SELECT count(*) FROM mise_delivery_batch_stops
         WHERE batch_id = v_batch) <> 2
     OR (SELECT current_capacity FROM mise_drivers
         WHERE id = '13000000-0000-0000-0000-000000000001') <> 1
     OR (SELECT dispatch_version FROM customer_orders
         WHERE id = '14000000-0000-0000-0000-000000000001') <> 1
     OR (SELECT status FROM customer_orders
         WHERE id = '14000000-0000-0000-0000-000000000001') <> 'assigned'
     OR (SELECT mise_batch_id FROM customer_orders
         WHERE id = '14000000-0000-0000-0000-000000000001')
        IS DISTINCT FROM v_assignment.batch_id
     OR (SELECT mise_driver_id FROM customer_orders
         WHERE id = '14000000-0000-0000-0000-000000000001')
        IS DISTINCT FROM v_assignment.driver_id
     OR (SELECT assignment_deadline_at FROM customer_orders
         WHERE id = '14000000-0000-0000-0000-000000000001') IS NULL
     OR (SELECT assignment_deadline_at FROM customer_orders
         WHERE id = '14000000-0000-0000-0000-000000000001')
        IS DISTINCT FROM v_assignment.delivery_deadline_at
     OR (SELECT delivery_deadline_at FROM mise_delivery_batches
         WHERE id=v_batch) IS DISTINCT FROM v_assignment.delivery_deadline_at
     OR v_assignment.pickup_deadline_at IS NULL
     OR v_assignment.delivery_deadline_at<=v_assignment.pickup_deadline_at
     OR v_assignment.assignment_version<>1
     OR (SELECT count(*) FROM dispatch_offer_audit
         WHERE order_id = '14000000-0000-0000-0000-000000000001'
           AND event_type = 'assignment.created') <> 1
     OR (SELECT count(*) FROM mise_push_outbox
         WHERE data->'order_ids' ? '14000000-0000-0000-0000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'atomic assignment projections diverged';
  END IF;
  IF v_assignment.correlation_id IS NULL
     OR NOT EXISTS(SELECT 1 FROM dispatch_offer_audit
       WHERE order_id=v_assignment.order_id
         AND correlation_id=v_assignment.correlation_id
         AND event_type='assignment.created')
     OR NOT EXISTS(SELECT 1 FROM mise_push_outbox
       WHERE data->>'correlation_id'=v_assignment.correlation_id::text)
     OR NOT EXISTS(SELECT 1 FROM dispatch_assignment_requests_v2
       WHERE action_id='16000000-0000-0000-0000-000000000001'
         AND correlation_id=v_assignment.correlation_id
         AND result->>'batch_id'=v_batch::text) THEN
    RAISE EXCEPTION 'assignment correlation/replay projections diverged';
  END IF;
END
$atomic_counts$;

-- The database invariant, not application code, rejects a second active row.
DO $constraint$
DECLARE
  v_original dispatch_offer_assignments%ROWTYPE;
BEGIN
  SELECT * INTO v_original FROM dispatch_offer_assignments
  WHERE order_id = '14000000-0000-0000-0000-000000000001';
  BEGIN
    INSERT INTO dispatch_offer_assignments (
      tenant_id, order_id, batch_id, driver_id, state, decision_id,
      idempotency_key, request_fingerprint, expected_order_version,
      assignment_version, algorithm_version
    ) VALUES (
      v_original.tenant_id, v_original.order_id, v_original.batch_id,
      v_original.driver_id, 'assigned', gen_random_uuid(), gen_random_uuid(),
      'duplicate', 1, 1, 'constraint-test'
    );
    RAISE EXCEPTION 'duplicate active assignment unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END
$constraint$;

-- Multi-order insertion is one trip and increments load by the order count.
DO $multi$
DECLARE
  v_result jsonb;
BEGIN
  v_result := fn_dispatch_assign_orders_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001', 1,
    '13000000-0000-0000-0000-000000000002', 0,
    '16000000-0000-0000-0000-000000000004', 'atomic-v2-test',
    jsonb_build_array(
      jsonb_build_object(
        'order_id', '14000000-0000-0000-0000-000000000002',
        'expected_order_version', 0,
        'pickup_lat', 52.0, 'pickup_lng', 13.0, 'pickup_address', 'pickup',
        'dropoff_lat', 52.02, 'dropoff_lng', 13.02, 'dropoff_address', 'd2',
        'pickup_deadline_at', now() + interval '20 minutes',
        'delivery_deadline_at', now() + interval '45 minutes'),
      jsonb_build_object(
        'order_id', '14000000-0000-0000-0000-000000000003',
        'expected_order_version', 0,
        'pickup_lat', 52.0, 'pickup_lng', 13.0, 'pickup_address', 'pickup',
        'dropoff_lat', 52.03, 'dropoff_lng', 13.03, 'dropoff_address', 'd3',
        'pickup_deadline_at', now() + interval '20 minutes',
        'delivery_deadline_at', now() + interval '50 minutes')
    ), 'assigned', 'two orders assigned'
  );
  IF NOT coalesce((v_result->>'ok')::boolean, false)
     OR jsonb_array_length(v_result->'assignment_ids') <> 2
     OR (SELECT count(*) FROM mise_delivery_batch_stops
         WHERE batch_id = (v_result->>'batch_id')::uuid) <> 4
     OR (SELECT current_capacity FROM mise_drivers
         WHERE id = '13000000-0000-0000-0000-000000000002') <> 2 THEN
    RAISE EXCEPTION 'multi-order trip did not commit atomically: %', v_result;
  END IF;
END
$multi$;

DO $multi_lifecycle_block$
DECLARE
  v_assignment dispatch_offer_assignments%ROWTYPE;
  v_pickup jsonb;
  v_cancel jsonb;
  v_reassign jsonb;
  v_before jsonb;
BEGIN
  SELECT * INTO v_assignment FROM dispatch_offer_assignments
  WHERE order_id='14000000-0000-0000-0000-000000000002';
  SELECT jsonb_build_object(
    'assignments',(SELECT jsonb_agg(jsonb_build_object('id',id,'state',state))
      FROM dispatch_offer_assignments WHERE batch_id=v_assignment.batch_id),
    'stops',(SELECT count(*) FROM mise_delivery_batch_stops
      WHERE batch_id=v_assignment.batch_id AND state='pending'),
    'driver_capacity',(SELECT current_capacity FROM mise_drivers
      WHERE id=v_assignment.driver_id)
  ) INTO v_before;
  v_pickup:=fn_dispatch_pickup_assignment_v2(
    '11000000-0000-0000-0000-000000000001',v_assignment.order_id,
    1,1,1,1,v_assignment.driver_id,gen_random_uuid());
  v_cancel:=fn_dispatch_cancel_order_v2(
    '11000000-0000-0000-0000-000000000001',v_assignment.order_id,
    1,1,1,1,'15000000-0000-0000-0000-000000000001',1,
    gen_random_uuid(),'MULTI_TEST');
  UPDATE dispatch_writer_gates SET pre_pickup_reassignment_enabled=true
  WHERE tenant_id='11000000-0000-0000-0000-000000000001';
  v_reassign:=fn_dispatch_reassign_before_pickup_v2(
    '11000000-0000-0000-0000-000000000001',v_assignment.order_id,
    1,1,1,1,'13000000-0000-0000-0000-000000000003',0,
    '15000000-0000-0000-0000-000000000001',1,
    gen_random_uuid(),'17000000-0000-0000-0000-000000000001',
    'MULTI_TEST','must remain blocked');
  IF v_pickup->>'reason_code'<>'MULTI_ORDER_LIFECYCLE_DEFAULT_OFF'
     OR v_cancel->>'reason_code'<>'MULTI_ORDER_LIFECYCLE_DEFAULT_OFF'
     OR v_reassign->>'reason_code'<>'MULTI_ORDER_LIFECYCLE_DEFAULT_OFF'
     OR v_before IS DISTINCT FROM jsonb_build_object(
       'assignments',(SELECT jsonb_agg(jsonb_build_object('id',id,'state',state))
         FROM dispatch_offer_assignments WHERE batch_id=v_assignment.batch_id),
       'stops',(SELECT count(*) FROM mise_delivery_batch_stops
         WHERE batch_id=v_assignment.batch_id AND state='pending'),
       'driver_capacity',(SELECT current_capacity FROM mise_drivers
         WHERE id=v_assignment.driver_id)
     ) THEN
    RAISE EXCEPTION 'multi-order lifecycle was not safely blocked: %, %, %',
      v_pickup,v_cancel,v_reassign;
  END IF;
END
$multi_lifecycle_block$;

-- Canonical CAS lifecycle uses only RPCs. Post-pickup reassignment cannot
-- invent a custody handoff.
DO $lifecycle$
DECLARE
  v_assignment dispatch_offer_assignments%ROWTYPE;
  v_pickup jsonb;
  v_stale jsonb;
  v_start jsonb;
  v_result jsonb;
  v_complete jsonb;
BEGIN
  SELECT * INTO v_assignment FROM dispatch_offer_assignments
  WHERE order_id = '14000000-0000-0000-0000-000000000001';
  v_stale := fn_dispatch_pickup_assignment_v2(
    '11000000-0000-0000-0000-000000000001', v_assignment.order_id,
    99, 1, 1, 1, v_assignment.driver_id,
    '16000000-0000-0000-0000-000000000006'
  );
  IF v_stale->>'reason_code' <> 'EXPECTED_VERSION_CONFLICT' THEN
    RAISE EXCEPTION 'stale pickup version did not fail safely: %', v_stale;
  END IF;
  v_pickup := fn_dispatch_pickup_assignment_v2(
    '11000000-0000-0000-0000-000000000001', v_assignment.order_id,
    1, 1, 1, 1, v_assignment.driver_id,
    '16000000-0000-0000-0000-000000000007'
  );
  v_start := fn_dispatch_start_delivery_v2(
    '11000000-0000-0000-0000-000000000001', v_assignment.order_id,
    2, 2, 2, 2, v_assignment.driver_id,
    '16000000-0000-0000-0000-000000000008'
  );
  v_result := fn_dispatch_reassign_before_pickup_v2(
    '11000000-0000-0000-0000-000000000001',
    v_assignment.order_id, 3, 3, 3, 3,
    '13000000-0000-0000-0000-000000000003', 0,
    '15000000-0000-0000-0000-000000000001',1,
    '16000000-0000-0000-0000-000000000009',
    '17000000-0000-0000-0000-000000000001',
    'SAFETY_EXCEPTION', 'fixture supervised attempt'
  );
  v_complete := fn_dispatch_complete_delivery_v2(
    '11000000-0000-0000-0000-000000000001', v_assignment.order_id,
    3, 3, 3, 3, v_assignment.driver_id,
    '16000000-0000-0000-0000-000000000010'
  );
  IF v_pickup->>'state' <> 'picked_up'
     OR v_start->>'state' <> 'in_progress'
     OR v_complete->>'state' <> 'completed' THEN
    RAISE EXCEPTION 'canonical lifecycle projections failed: %, %, %',
      v_pickup, v_start, v_complete;
  END IF;
  IF v_result->>'reason_code' <> 'POST_PICKUP_REASSIGNMENT_NOT_SUPPORTED'
     OR EXISTS (
       SELECT 1 FROM dispatch_offer_assignments
       WHERE order_id = v_assignment.order_id AND driver_id =
         '13000000-0000-0000-0000-000000000003'
  ) THEN
    RAISE EXCEPTION 'post-pickup reassignment was not safely rejected: %', v_result;
  END IF;
  IF (SELECT status FROM customer_orders WHERE id=v_assignment.order_id) <> 'delivered'
     OR (SELECT dispatch_version FROM customer_orders WHERE id=v_assignment.order_id) <> 4
     OR (SELECT state FROM dispatch_offer_assignments WHERE id=v_assignment.id) <> 'completed'
     OR (SELECT assignment_version FROM dispatch_offer_assignments WHERE id=v_assignment.id) <> 4
     OR (SELECT state FROM mise_delivery_batches WHERE id=v_assignment.batch_id) <> 'completed'
     OR (SELECT state_version FROM mise_delivery_batches WHERE id=v_assignment.batch_id) <> 4
     OR (SELECT state FROM mise_drivers WHERE id=v_assignment.driver_id) <> 'returning'
     OR (SELECT state_version FROM mise_drivers WHERE id=v_assignment.driver_id) <> 4
     OR (SELECT current_capacity FROM mise_drivers WHERE id=v_assignment.driver_id) <> 0
     OR (SELECT count(*) FROM mise_delivery_batch_stops
         WHERE batch_id=v_assignment.batch_id AND state='completed') <> 2
     OR (SELECT count(*) FROM dispatch_assignment_requests_v2
         WHERE correlation_id IN (
           SELECT correlation_id FROM dispatch_offer_audit
           WHERE order_id=v_assignment.order_id
             AND event_type IN ('assignment.picked_up','assignment.in_progress',
                                'assignment.completed')
         )) <> 3 THEN
    RAISE EXCEPTION 'completed lifecycle exact projections/correlation diverged';
  END IF;
END
$lifecycle$;

DO $cancel_positive$
DECLARE
  v_assign jsonb;
  v_cancel jsonb;
  v_assignment dispatch_offer_assignments%ROWTYPE;
BEGIN
  v_assign:=fn_dispatch_assign_orders_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',1,
    '13000000-0000-0000-0000-000000000004',0,gen_random_uuid(),'behavior',
    jsonb_build_array(jsonb_build_object(
      'order_id','14000000-0000-0000-0000-000000000004',
      'expected_order_version',0,'pickup_lat',52.0,'pickup_lng',13.0,
      'dropoff_lat',52.04,'dropoff_lng',13.04,
      'pickup_deadline_at',now()+interval '20 minutes',
      'delivery_deadline_at',now()+interval '45 minutes'
    )),'assigned','cancel fixture');
  SELECT * INTO v_assignment FROM dispatch_offer_assignments
  WHERE order_id='14000000-0000-0000-0000-000000000004';
  v_cancel:=fn_dispatch_cancel_order_v2(
    '11000000-0000-0000-0000-000000000001',v_assignment.order_id,
    1,1,1,1,'15000000-0000-0000-0000-000000000001',1,
    gen_random_uuid(),'CUSTOMER_CANCELLED');
  IF NOT coalesce((v_assign->>'ok')::boolean,false)
     OR v_cancel->>'state'<>'cancelled'
     OR (SELECT status FROM customer_orders WHERE id=v_assignment.order_id)<>'cancelled'
     OR (SELECT dispatch_version FROM customer_orders WHERE id=v_assignment.order_id)<>2
     OR (SELECT mise_batch_id FROM customer_orders WHERE id=v_assignment.order_id) IS NOT NULL
     OR (SELECT state FROM dispatch_offer_assignments WHERE id=v_assignment.id)<>'cancelled'
     OR (SELECT assignment_version FROM dispatch_offer_assignments WHERE id=v_assignment.id)<>2
     OR (SELECT state FROM mise_delivery_batches WHERE id=v_assignment.batch_id)<>'cancelled'
     OR (SELECT count(*) FROM mise_delivery_batch_stops
         WHERE batch_id=v_assignment.batch_id AND state='cancelled')<>2
     OR (SELECT state FROM mise_drivers WHERE id=v_assignment.driver_id)<>'idle'
     OR (SELECT current_capacity FROM mise_drivers WHERE id=v_assignment.driver_id)<>0
     OR NOT EXISTS(SELECT 1 FROM dispatch_offer_audit a
       JOIN dispatch_assignment_requests_v2 r USING(correlation_id)
       WHERE a.order_id=v_assignment.order_id AND a.event_type='assignment.cancelled')
     OR NOT EXISTS(SELECT 1 FROM mise_push_outbox
       WHERE data->>'correlation_id'=v_cancel->>'correlation_id') THEN
    RAISE EXCEPTION 'cancel projections diverged: %, %',v_assign,v_cancel;
  END IF;
  IF (fn_dispatch_cancel_order_v2(
    '11000000-0000-0000-0000-000000000001',v_assignment.order_id,
    2,2,2,2,'15000000-0000-0000-0000-000000000001',1,
    gen_random_uuid(),'AGAIN')->>'reason_code')<>'ACTIVE_ASSIGNMENT_NOT_FOUND' THEN
    RAISE EXCEPTION 'completed cancellation was not rejected';
  END IF;
END
$cancel_positive$;

DO $reassign_positive$
DECLARE
  v_assign jsonb;
  v_non_owner jsonb;
  v_stale_epoch jsonb;
  v_expired jsonb;
  v_stale jsonb;
  v_result jsonb;
  v_old dispatch_offer_assignments%ROWTYPE;
  v_new_id uuid;
  v_lease timestamptz;
  v_before jsonb;
  v_non_owner_action uuid:=gen_random_uuid();
  v_stale_epoch_action uuid:=gen_random_uuid();
  v_expired_action uuid:=gen_random_uuid();
BEGIN
  v_assign:=fn_dispatch_assign_orders_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',1,
    '13000000-0000-0000-0000-000000000005',0,gen_random_uuid(),'behavior',
    jsonb_build_array(jsonb_build_object(
      'order_id','14000000-0000-0000-0000-000000000005',
      'expected_order_version',0,'pickup_lat',52.0,'pickup_lng',13.0,
      'dropoff_lat',52.05,'dropoff_lng',13.05,
      'pickup_deadline_at',now()+interval '20 minutes',
      'delivery_deadline_at',now()+interval '45 minutes'
    )),'assigned','reassign fixture');
  SELECT * INTO v_old FROM dispatch_offer_assignments
  WHERE order_id='14000000-0000-0000-0000-000000000005';
  UPDATE mise_drivers SET state='exception',state_version=state_version+1
  WHERE id=v_old.driver_id;
  SELECT lease_expires_at INTO v_lease FROM dispatch_writer_gates
  WHERE tenant_id='11000000-0000-0000-0000-000000000001';
  SELECT jsonb_build_object(
    'order_state',(SELECT jsonb_build_object(
      'status',status,'version',dispatch_version,'batch_id',mise_batch_id,
      'driver_id',mise_driver_id,'deadline',assignment_deadline_at)
      FROM customer_orders WHERE id=v_old.order_id),
    'order_version',(SELECT dispatch_version FROM customer_orders WHERE id=v_old.order_id),
    'old_state',(SELECT state FROM dispatch_offer_assignments WHERE id=v_old.id),
    'old_assignment_version',(SELECT assignment_version
      FROM dispatch_offer_assignments WHERE id=v_old.id),
    'assignment_count',(SELECT count(*) FROM dispatch_offer_assignments WHERE order_id=v_old.order_id),
    'batch_state',(SELECT jsonb_build_object(
      'state',state,'version',state_version,'driver_id',driver_id,
      'pickup_deadline',pickup_deadline_at,'delivery_deadline',delivery_deadline_at)
      FROM mise_delivery_batches WHERE id=v_old.batch_id),
    'batch_count',(SELECT count(*) FROM mise_delivery_batches
      WHERE id=v_old.batch_id OR driver_id='13000000-0000-0000-0000-000000000006'),
    'stops',(SELECT jsonb_agg(jsonb_build_object(
      'id',id,'state',state,'version',stop_version) ORDER BY id)
      FROM mise_delivery_batch_stops WHERE order_id=v_old.order_id),
    'stop_count',(SELECT count(*) FROM mise_delivery_batch_stops WHERE order_id=v_old.order_id),
    'old_driver',(SELECT jsonb_build_object(
      'state',state,'capacity',current_capacity,'version',state_version)
      FROM mise_drivers WHERE id=v_old.driver_id),
    'new_driver',(SELECT jsonb_build_object(
      'state',state,'capacity',current_capacity,'version',state_version)
      FROM mise_drivers WHERE id='13000000-0000-0000-0000-000000000006'),
    'old_capacity',(SELECT current_capacity FROM mise_drivers WHERE id=v_old.driver_id),
    'new_capacity',(SELECT current_capacity FROM mise_drivers
      WHERE id='13000000-0000-0000-0000-000000000006'),
    'audit_count',(SELECT count(*) FROM dispatch_offer_audit WHERE order_id=v_old.order_id),
    'outbox_count',(SELECT count(*) FROM mise_push_outbox
      WHERE data->>'order_id'=v_old.order_id::text
         OR data->'order_ids' ? v_old.order_id::text)
  ) INTO v_before;
  v_non_owner:=fn_dispatch_reassign_before_pickup_v2(
    '11000000-0000-0000-0000-000000000001',v_old.order_id,
    1,1,1,2,'13000000-0000-0000-0000-000000000006',0,
    '15000000-0000-0000-0000-000000000099',1,
    v_non_owner_action,'17000000-0000-0000-0000-000000000001',
    'VEHICLE_FAILURE','non-owner');
  v_stale_epoch:=fn_dispatch_reassign_before_pickup_v2(
    '11000000-0000-0000-0000-000000000001',v_old.order_id,
    1,1,1,2,'13000000-0000-0000-0000-000000000006',0,
    '15000000-0000-0000-0000-000000000001',99,
    v_stale_epoch_action,'17000000-0000-0000-0000-000000000001',
    'VEHICLE_FAILURE','stale epoch');
  UPDATE dispatch_writer_gates SET lease_expires_at=now()-interval '1 second'
  WHERE tenant_id='11000000-0000-0000-0000-000000000001';
  v_expired:=fn_dispatch_reassign_before_pickup_v2(
    '11000000-0000-0000-0000-000000000001',v_old.order_id,
    1,1,1,2,'13000000-0000-0000-0000-000000000006',0,
    '15000000-0000-0000-0000-000000000001',1,
    v_expired_action,'17000000-0000-0000-0000-000000000001',
    'VEHICLE_FAILURE','expired lease');
  UPDATE dispatch_writer_gates SET lease_expires_at=v_lease
  WHERE tenant_id='11000000-0000-0000-0000-000000000001';
  IF v_non_owner->>'reason_code'<>'WRITER_LEASE_STALE_OR_NOT_OWNER'
     OR v_stale_epoch->>'reason_code'<>'WRITER_LEASE_STALE_OR_NOT_OWNER'
     OR v_expired->>'reason_code'<>'WRITER_LEASE_STALE_OR_NOT_OWNER'
     OR EXISTS(SELECT 1 FROM dispatch_assignment_requests_v2
       WHERE action_id IN(
         v_non_owner_action,v_stale_epoch_action,v_expired_action))
     OR v_before IS DISTINCT FROM jsonb_build_object(
       'order_state',(SELECT jsonb_build_object(
         'status',status,'version',dispatch_version,'batch_id',mise_batch_id,
         'driver_id',mise_driver_id,'deadline',assignment_deadline_at)
         FROM customer_orders WHERE id=v_old.order_id),
       'order_version',(SELECT dispatch_version FROM customer_orders WHERE id=v_old.order_id),
       'old_state',(SELECT state FROM dispatch_offer_assignments WHERE id=v_old.id),
       'old_assignment_version',(SELECT assignment_version
         FROM dispatch_offer_assignments WHERE id=v_old.id),
       'assignment_count',(SELECT count(*) FROM dispatch_offer_assignments WHERE order_id=v_old.order_id),
       'batch_state',(SELECT jsonb_build_object(
         'state',state,'version',state_version,'driver_id',driver_id,
         'pickup_deadline',pickup_deadline_at,'delivery_deadline',delivery_deadline_at)
         FROM mise_delivery_batches WHERE id=v_old.batch_id),
       'batch_count',(SELECT count(*) FROM mise_delivery_batches
         WHERE id=v_old.batch_id OR driver_id='13000000-0000-0000-0000-000000000006'),
       'stops',(SELECT jsonb_agg(jsonb_build_object(
         'id',id,'state',state,'version',stop_version) ORDER BY id)
         FROM mise_delivery_batch_stops WHERE order_id=v_old.order_id),
       'stop_count',(SELECT count(*) FROM mise_delivery_batch_stops WHERE order_id=v_old.order_id),
       'old_driver',(SELECT jsonb_build_object(
         'state',state,'capacity',current_capacity,'version',state_version)
         FROM mise_drivers WHERE id=v_old.driver_id),
       'new_driver',(SELECT jsonb_build_object(
         'state',state,'capacity',current_capacity,'version',state_version)
         FROM mise_drivers WHERE id='13000000-0000-0000-0000-000000000006'),
       'old_capacity',(SELECT current_capacity FROM mise_drivers WHERE id=v_old.driver_id),
       'new_capacity',(SELECT current_capacity FROM mise_drivers
         WHERE id='13000000-0000-0000-0000-000000000006'),
       'audit_count',(SELECT count(*) FROM dispatch_offer_audit WHERE order_id=v_old.order_id),
       'outbox_count',(SELECT count(*) FROM mise_push_outbox
         WHERE data->>'order_id'=v_old.order_id::text
            OR data->'order_ids' ? v_old.order_id::text)
     ) THEN
    RAISE EXCEPTION 'reassign writer authority negative mutated state: %, %, %',
      v_non_owner,v_stale_epoch,v_expired;
  END IF;
  v_stale:=fn_dispatch_reassign_before_pickup_v2(
    '11000000-0000-0000-0000-000000000001',v_old.order_id,
    99,1,1,2,'13000000-0000-0000-0000-000000000006',0,
    '15000000-0000-0000-0000-000000000001',1,
    gen_random_uuid(),'17000000-0000-0000-0000-000000000001',
    'VEHICLE_FAILURE','supervised replacement');
  v_result:=fn_dispatch_reassign_before_pickup_v2(
    '11000000-0000-0000-0000-000000000001',v_old.order_id,
    1,1,1,2,'13000000-0000-0000-0000-000000000006',0,
    '15000000-0000-0000-0000-000000000001',1,
    gen_random_uuid(),'17000000-0000-0000-0000-000000000001',
    'VEHICLE_FAILURE','supervised replacement');
  v_new_id:=(v_result->>'assignment_id')::uuid;
  IF v_stale->>'reason_code'<>'EXPECTED_VERSION_CONFLICT'
     OR v_result->>'state'<>'assigned'
     OR (SELECT state FROM dispatch_offer_assignments WHERE id=v_old.id)<>'reassigned'
     OR (SELECT assignment_version FROM dispatch_offer_assignments WHERE id=v_old.id)<>2
     OR (SELECT state FROM dispatch_offer_assignments WHERE id=v_new_id)<>'assigned'
     OR (SELECT tenant_id FROM dispatch_offer_assignments WHERE id=v_new_id)
        <>'11000000-0000-0000-0000-000000000001'
     OR (SELECT dispatch_version FROM customer_orders WHERE id=v_old.order_id)<>2
     OR (SELECT mise_batch_id FROM customer_orders WHERE id=v_old.order_id)
        IS DISTINCT FROM (v_result->>'batch_id')::uuid
     OR (SELECT mise_driver_id FROM customer_orders WHERE id=v_old.order_id)
        <>'13000000-0000-0000-0000-000000000006'
     OR (SELECT state FROM mise_delivery_batches WHERE id=v_old.batch_id)<>'cancelled'
     OR (SELECT count(*) FROM mise_delivery_batch_stops
         WHERE batch_id=v_old.batch_id AND state='cancelled')<>2
     OR (SELECT count(*) FROM mise_delivery_batch_stops
         WHERE batch_id=(v_result->>'batch_id')::uuid AND state='pending')<>2
     OR (SELECT state FROM mise_drivers WHERE id=v_old.driver_id)<>'exception'
     OR (SELECT current_capacity FROM mise_drivers WHERE id=v_old.driver_id)<>0
     OR (SELECT state FROM mise_drivers
         WHERE id='13000000-0000-0000-0000-000000000006')<>'assigned'
     OR (SELECT current_capacity FROM mise_drivers
         WHERE id='13000000-0000-0000-0000-000000000006')<>1
     OR (SELECT count(*) FROM dispatch_offer_audit
         WHERE correlation_id=(v_result->>'correlation_id')::uuid)<>2
     OR (SELECT count(*) FROM mise_push_outbox
         WHERE data->>'correlation_id'=v_result->>'correlation_id')<>2 THEN
    RAISE EXCEPTION 'positive reassignment projections diverged: %, %, %',
      v_assign,v_stale,v_result;
  END IF;
END
$reassign_positive$;

DO $input_validation$
DECLARE
  v_bad_coord_order uuid:=gen_random_uuid();
  v_bad_deadline_order uuid:=gen_random_uuid();
  v_other_location uuid:=gen_random_uuid();
  v_other_order uuid:=gen_random_uuid();
  v_result jsonb;
BEGIN
  INSERT INTO locations(id,tenant_id,name) VALUES(
    v_other_location,'11000000-0000-0000-0000-000000000001','other location');
  INSERT INTO customer_orders(
    id,location_id,tenant_id,bestellnummer,kunde_name,typ,status)
  VALUES
    (v_bad_coord_order,'12000000-0000-0000-0000-000000000001',
     '11000000-0000-0000-0000-000000000001','bad-coord','fixture','lieferung','fertig'),
    (v_bad_deadline_order,'12000000-0000-0000-0000-000000000001',
     '11000000-0000-0000-0000-000000000001','bad-deadline','fixture','lieferung','fertig'),
    (v_other_order,v_other_location,'11000000-0000-0000-0000-000000000001',
     'other-location','fixture','lieferung','fertig');
  v_result:=fn_dispatch_assign_orders_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',1,
    '13000000-0000-0000-0000-000000000003',0,gen_random_uuid(),'validation',
    jsonb_build_array(jsonb_build_object(
      'order_id',v_bad_coord_order,'expected_order_version',0,
      'pickup_lat','NaN','pickup_lng',13,'dropoff_lat',91,'dropoff_lng',13,
      'pickup_deadline_at',now()+interval '10 minutes',
      'delivery_deadline_at',now()+interval '20 minutes'
    )),'bad','bad');
  IF v_result->>'reason_code'<>'INVALID_ROUTE_COORDINATES' THEN
    RAISE EXCEPTION 'invalid coordinates accepted: %',v_result;
  END IF;
  v_result:=fn_dispatch_assign_orders_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',1,
    '13000000-0000-0000-0000-000000000003',0,gen_random_uuid(),'validation',
    jsonb_build_array(jsonb_build_object(
      'order_id',v_bad_deadline_order,'expected_order_version',0,
      'pickup_lat',52,'pickup_lng',13,'dropoff_lat',52.1,'dropoff_lng',13.1,
      'pickup_deadline_at',now()-interval '1 minute',
      'delivery_deadline_at',now()-interval '2 minutes'
    )),'bad','bad');
  IF v_result->>'reason_code'<>'INVALID_DEADLINE_ORDER' THEN
    RAISE EXCEPTION 'invalid deadlines accepted: %',v_result;
  END IF;
  v_result:=fn_dispatch_assign_orders_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',1,
    '13000000-0000-0000-0000-000000000003',0,gen_random_uuid(),'validation',
    jsonb_build_array(
      jsonb_build_object(
        'order_id',v_bad_coord_order,'expected_order_version',0,
        'pickup_lat',52,'pickup_lng',13,'dropoff_lat',52.1,'dropoff_lng',13.1,
        'pickup_deadline_at',now()+interval '10 minutes',
        'delivery_deadline_at',now()+interval '20 minutes'),
      jsonb_build_object(
        'order_id',v_other_order,'expected_order_version',0,
        'pickup_lat',52,'pickup_lng',13,'dropoff_lat',52.2,'dropoff_lng',13.2,
        'pickup_deadline_at',now()+interval '10 minutes',
        'delivery_deadline_at',now()+interval '20 minutes')
    ),'bad','bad');
  IF v_result->>'reason_code'<>'MULTI_LOCATION_TRIP_NOT_SUPPORTED'
     OR EXISTS(SELECT 1 FROM dispatch_offer_assignments
       WHERE order_id IN(v_bad_coord_order,v_bad_deadline_order,v_other_order)) THEN
    RAISE EXCEPTION 'multi-location validation failed: %',v_result;
  END IF;
END
$input_validation$;
