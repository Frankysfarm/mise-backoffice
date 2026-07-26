\set ON_ERROR_STOP on

SELECT fn_dispatch_claim_writer_v2(
  '11000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-000000000001',120
);

CREATE OR REPLACE FUNCTION t02_seed_single_assignment()
RETURNS TABLE(order_id uuid,driver_id uuid,batch_id uuid,assignment_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
  v_result jsonb;
BEGIN
  order_id:=gen_random_uuid(); driver_id:=gen_random_uuid();
  INSERT INTO mise_drivers(id,name,active,state,last_position_at,max_capacity)
  VALUES(driver_id,'lifecycle fault driver',true,'idle',now(),4);
  INSERT INTO mise_driver_tenants(driver_id,tenant_id,status)
  VALUES(driver_id,'11000000-0000-0000-0000-000000000001','active');
  INSERT INTO customer_orders(
    id,location_id,tenant_id,bestellnummer,kunde_name,typ,status)
  VALUES(order_id,'12000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001','fault','fixture','lieferung','fertig');
  v_result:=fn_dispatch_assign_orders_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001',1,driver_id,0,
    gen_random_uuid(),'lifecycle-fault',
    jsonb_build_array(jsonb_build_object(
      'order_id',order_id,'expected_order_version',0,
      'pickup_lat',52,'pickup_lng',13,'dropoff_lat',52.1,'dropoff_lng',13.1,
      'pickup_deadline_at',now()+interval '20 minutes',
      'delivery_deadline_at',now()+interval '45 minutes'
    )),'fault','fault');
  IF NOT coalesce((v_result->>'ok')::boolean,false) THEN
    RAISE EXCEPTION 'fault seed assignment failed:%',v_result;
  END IF;
  batch_id:=(v_result->>'batch_id')::uuid;
  SELECT id INTO assignment_id FROM dispatch_offer_assignments
    WHERE dispatch_offer_assignments.order_id=t02_seed_single_assignment.order_id;
  RETURN NEXT;
END
$$;

CREATE OR REPLACE FUNCTION t02_projection_counts()
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'batches',(SELECT count(*) FROM mise_delivery_batches),
    'stops',(SELECT count(*) FROM mise_delivery_batch_stops),
    'assignments',(SELECT count(*) FROM dispatch_offer_assignments),
    'audit',(SELECT count(*) FROM dispatch_offer_audit),
    'outbox',(SELECT count(*) FROM mise_push_outbox),
    'requests',(SELECT count(*) FROM dispatch_assignment_requests_v2)
  )
$$;

DO $pickup_faults$
DECLARE
  v_step text;
  v_seed record;
  v_before jsonb;
BEGIN
  FOREACH v_step IN ARRAY ARRAY[
    'pickup.assignment','pickup.stops','pickup.batch','pickup.order',
    'pickup.driver','pickup.audit','pickup.request'
  ] LOOP
    SELECT * INTO v_seed FROM t02_seed_single_assignment();
    v_before:=t02_projection_counts();
    PERFORM set_config('t02.enable_failpoints','on',true);
    PERFORM set_config('t02.failpoint',v_step,true);
    BEGIN
      PERFORM fn_dispatch_pickup_assignment_v2(
        '11000000-0000-0000-0000-000000000001',v_seed.order_id,
        1,1,1,1,v_seed.driver_id,gen_random_uuid());
      RAISE EXCEPTION 'pickup failpoint did not fire:%',v_step;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'T02_INJECTED_FAILURE_AFTER_%' THEN RAISE; END IF;
    END;
    PERFORM set_config('t02.enable_failpoints','off',true);
    IF v_before<>t02_projection_counts()
       OR (SELECT status FROM customer_orders WHERE id=v_seed.order_id)<>'assigned'
       OR (SELECT dispatch_version FROM customer_orders WHERE id=v_seed.order_id)<>1
       OR (SELECT state FROM dispatch_offer_assignments WHERE id=v_seed.assignment_id)<>'assigned'
       OR (SELECT assignment_version FROM dispatch_offer_assignments WHERE id=v_seed.assignment_id)<>1
       OR (SELECT state FROM mise_delivery_batches WHERE id=v_seed.batch_id)<>'assigned'
       OR (SELECT state_version FROM mise_delivery_batches WHERE id=v_seed.batch_id)<>1
       OR (SELECT state FROM mise_drivers WHERE id=v_seed.driver_id)<>'assigned'
       OR (SELECT state_version FROM mise_drivers WHERE id=v_seed.driver_id)<>1
       OR (SELECT count(*) FROM mise_delivery_batch_stops
           WHERE batch_id=v_seed.batch_id AND state='pending')<>2 THEN
      RAISE EXCEPTION 'pickup partial state survived:%',v_step;
    END IF;
  END LOOP;
END
$pickup_faults$;

DO $start_faults$
DECLARE
  v_step text; v_seed record; v_before jsonb; v_pick jsonb;
BEGIN
  FOREACH v_step IN ARRAY ARRAY[
    'start.assignment','start.batch','start.order','start.driver',
    'start.audit','start.request'
  ] LOOP
    SELECT * INTO v_seed FROM t02_seed_single_assignment();
    v_pick:=fn_dispatch_pickup_assignment_v2(
      '11000000-0000-0000-0000-000000000001',v_seed.order_id,
      1,1,1,1,v_seed.driver_id,gen_random_uuid());
    IF v_pick->>'state'<>'picked_up' THEN RAISE EXCEPTION 'start seed pickup failed'; END IF;
    v_before:=t02_projection_counts();
    PERFORM set_config('t02.enable_failpoints','on',true);
    PERFORM set_config('t02.failpoint',v_step,true);
    BEGIN
      PERFORM fn_dispatch_start_delivery_v2(
        '11000000-0000-0000-0000-000000000001',v_seed.order_id,
        2,2,2,2,v_seed.driver_id,gen_random_uuid());
      RAISE EXCEPTION 'start failpoint did not fire:%',v_step;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'T02_INJECTED_FAILURE_AFTER_%' THEN RAISE; END IF;
    END;
    PERFORM set_config('t02.enable_failpoints','off',true);
    IF v_before<>t02_projection_counts()
       OR (SELECT status FROM customer_orders WHERE id=v_seed.order_id)<>'picked_up'
       OR (SELECT dispatch_version FROM customer_orders WHERE id=v_seed.order_id)<>2
       OR (SELECT state FROM dispatch_offer_assignments WHERE id=v_seed.assignment_id)<>'picked_up'
       OR (SELECT assignment_version FROM dispatch_offer_assignments WHERE id=v_seed.assignment_id)<>2
       OR (SELECT state FROM mise_delivery_batches WHERE id=v_seed.batch_id)<>'at_pickup'
       OR (SELECT state FROM mise_drivers WHERE id=v_seed.driver_id)<>'at_pickup' THEN
      RAISE EXCEPTION 'start partial state survived:%',v_step;
    END IF;
  END LOOP;
END
$start_faults$;

DO $cancel_faults$
DECLARE
  v_step text; v_seed record; v_before jsonb;
BEGIN
  FOREACH v_step IN ARRAY ARRAY[
    'cancel.assignment','cancel.stops','cancel.batch','cancel.order',
    'cancel.driver','cancel.audit','cancel.outbox','cancel.request'
  ] LOOP
    SELECT * INTO v_seed FROM t02_seed_single_assignment();
    v_before:=t02_projection_counts();
    PERFORM set_config('t02.enable_failpoints','on',true);
    PERFORM set_config('t02.failpoint',v_step,true);
    BEGIN
      PERFORM fn_dispatch_cancel_order_v2(
        '11000000-0000-0000-0000-000000000001',v_seed.order_id,
        1,1,1,1,'15000000-0000-0000-0000-000000000001',1,
        gen_random_uuid(),'FAULT');
      RAISE EXCEPTION 'cancel failpoint did not fire:%',v_step;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'T02_INJECTED_FAILURE_AFTER_%' THEN RAISE; END IF;
    END;
    PERFORM set_config('t02.enable_failpoints','off',true);
    IF v_before<>t02_projection_counts()
       OR (SELECT status FROM customer_orders WHERE id=v_seed.order_id)<>'assigned'
       OR (SELECT state FROM dispatch_offer_assignments WHERE id=v_seed.assignment_id)<>'assigned'
       OR (SELECT state FROM mise_delivery_batches WHERE id=v_seed.batch_id)<>'assigned'
       OR (SELECT state FROM mise_drivers WHERE id=v_seed.driver_id)<>'assigned'
       OR (SELECT current_capacity FROM mise_drivers WHERE id=v_seed.driver_id)<>1 THEN
      RAISE EXCEPTION 'cancel partial state survived:%',v_step;
    END IF;
  END LOOP;
END
$cancel_faults$;

DO $complete_faults$
DECLARE
  v_step text; v_seed record; v_before jsonb; v_result jsonb;
BEGIN
  FOREACH v_step IN ARRAY ARRAY[
    'complete.assignment','complete.stops','complete.batch','complete.order',
    'complete.driver','complete.audit','complete.request'
  ] LOOP
    SELECT * INTO v_seed FROM t02_seed_single_assignment();
    v_result:=fn_dispatch_pickup_assignment_v2(
      '11000000-0000-0000-0000-000000000001',v_seed.order_id,
      1,1,1,1,v_seed.driver_id,gen_random_uuid());
    v_result:=fn_dispatch_start_delivery_v2(
      '11000000-0000-0000-0000-000000000001',v_seed.order_id,
      2,2,2,2,v_seed.driver_id,gen_random_uuid());
    IF v_result->>'state'<>'in_progress' THEN RAISE EXCEPTION 'complete seed failed'; END IF;
    v_before:=t02_projection_counts();
    PERFORM set_config('t02.enable_failpoints','on',true);
    PERFORM set_config('t02.failpoint',v_step,true);
    BEGIN
      PERFORM fn_dispatch_complete_delivery_v2(
        '11000000-0000-0000-0000-000000000001',v_seed.order_id,
        3,3,3,3,v_seed.driver_id,gen_random_uuid());
      RAISE EXCEPTION 'complete failpoint did not fire:%',v_step;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'T02_INJECTED_FAILURE_AFTER_%' THEN RAISE; END IF;
    END;
    PERFORM set_config('t02.enable_failpoints','off',true);
    IF v_before<>t02_projection_counts()
       OR (SELECT status FROM customer_orders WHERE id=v_seed.order_id)<>'out_for_delivery'
       OR (SELECT state FROM dispatch_offer_assignments WHERE id=v_seed.assignment_id)<>'in_progress'
       OR (SELECT state FROM mise_delivery_batches WHERE id=v_seed.batch_id)<>'in_progress'
       OR (SELECT state FROM mise_drivers WHERE id=v_seed.driver_id)<>'delivering'
       OR (SELECT current_capacity FROM mise_drivers WHERE id=v_seed.driver_id)<>1 THEN
      RAISE EXCEPTION 'complete partial state survived:%',v_step;
    END IF;
  END LOOP;
END
$complete_faults$;

DO $reassign_faults$
DECLARE
  v_step text; v_seed record; v_before jsonb; v_new_driver uuid;
BEGIN
  UPDATE dispatch_writer_gates SET pre_pickup_reassignment_enabled=true
  WHERE tenant_id='11000000-0000-0000-0000-000000000001';
  FOREACH v_step IN ARRAY ARRAY[
    'reassign.new_batch','reassign.new_stops','reassign.old_assignment',
    'reassign.old_stops','reassign.old_batch','reassign.order',
    'reassign.old_driver','reassign.new_driver','reassign.new_assignment',
    'reassign.audit','reassign.outbox','reassign.request'
  ] LOOP
    SELECT * INTO v_seed FROM t02_seed_single_assignment();
    v_new_driver:=gen_random_uuid();
    INSERT INTO mise_drivers(id,name,active,state,last_position_at,max_capacity)
    VALUES(v_new_driver,'replacement fault driver',true,'idle',now(),4);
    INSERT INTO mise_driver_tenants(driver_id,tenant_id,status)
    VALUES(v_new_driver,'11000000-0000-0000-0000-000000000001','active');
    UPDATE mise_drivers SET state='exception',state_version=2
    WHERE id=v_seed.driver_id;
    v_before:=t02_projection_counts();
    PERFORM set_config('t02.enable_failpoints','on',true);
    PERFORM set_config('t02.failpoint',v_step,true);
    BEGIN
      PERFORM fn_dispatch_reassign_before_pickup_v2(
        '11000000-0000-0000-0000-000000000001',v_seed.order_id,
        1,1,1,2,v_new_driver,0,
        '15000000-0000-0000-0000-000000000001',1,
        gen_random_uuid(),gen_random_uuid(),
        'FAULT','fault injection');
      RAISE EXCEPTION 'reassign failpoint did not fire:%',v_step;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'T02_INJECTED_FAILURE_AFTER_%' THEN RAISE; END IF;
    END;
    PERFORM set_config('t02.enable_failpoints','off',true);
    IF v_before<>t02_projection_counts()
       OR (SELECT status FROM customer_orders WHERE id=v_seed.order_id)<>'assigned'
       OR (SELECT state FROM dispatch_offer_assignments WHERE id=v_seed.assignment_id)<>'assigned'
       OR (SELECT state FROM mise_delivery_batches WHERE id=v_seed.batch_id)<>'assigned'
       OR (SELECT state FROM mise_drivers WHERE id=v_seed.driver_id)<>'exception'
       OR (SELECT current_capacity FROM mise_drivers WHERE id=v_seed.driver_id)<>1
       OR (SELECT state FROM mise_drivers WHERE id=v_new_driver)<>'idle'
       OR (SELECT current_capacity FROM mise_drivers WHERE id=v_new_driver)<>0 THEN
      RAISE EXCEPTION 'reassign partial state survived:%',v_step;
    END IF;
  END LOOP;
END
$reassign_faults$;

DROP FUNCTION t02_projection_counts();
DROP FUNCTION t02_seed_single_assignment();
