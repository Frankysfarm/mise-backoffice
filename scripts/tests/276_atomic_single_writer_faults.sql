\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION t02_fail_selected_write() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('t02.fail_table', true) = TG_TABLE_NAME THEN
    RAISE EXCEPTION 'T02_INJECTED_FAILURE_AFTER_%', TG_TABLE_NAME;
  END IF;
  RETURN NULL;
END
$$;

CREATE TRIGGER t02_fail_batch AFTER INSERT ON mise_delivery_batches
  FOR EACH STATEMENT EXECUTE FUNCTION t02_fail_selected_write();
CREATE TRIGGER t02_fail_stops AFTER INSERT ON mise_delivery_batch_stops
  FOR EACH STATEMENT EXECUTE FUNCTION t02_fail_selected_write();
CREATE TRIGGER t02_fail_orders AFTER UPDATE ON customer_orders
  FOR EACH STATEMENT EXECUTE FUNCTION t02_fail_selected_write();
CREATE TRIGGER t02_fail_driver AFTER UPDATE ON mise_drivers
  FOR EACH STATEMENT EXECUTE FUNCTION t02_fail_selected_write();
CREATE TRIGGER t02_fail_assignment AFTER INSERT ON dispatch_offer_assignments
  FOR EACH STATEMENT EXECUTE FUNCTION t02_fail_selected_write();
CREATE TRIGGER t02_fail_audit AFTER INSERT ON dispatch_offer_audit
  FOR EACH STATEMENT EXECUTE FUNCTION t02_fail_selected_write();
CREATE TRIGGER t02_fail_outbox AFTER INSERT ON mise_push_outbox
  FOR EACH STATEMENT EXECUTE FUNCTION t02_fail_selected_write();
CREATE TRIGGER t02_fail_request AFTER INSERT ON dispatch_assignment_requests_v2
  FOR EACH STATEMENT EXECUTE FUNCTION t02_fail_selected_write();

DO $faults$
DECLARE
  v_tables text[] := ARRAY[
    'mise_delivery_batches',
    'mise_delivery_batch_stops',
    'customer_orders',
    'mise_drivers',
    'dispatch_offer_assignments',
    'dispatch_offer_audit',
    'mise_push_outbox',
    'dispatch_assignment_requests_v2'
  ];
  v_table text;
  v_order_id uuid;
  v_driver_id uuid;
  v_action_id uuid;
  v_before jsonb;
BEGIN
  FOREACH v_table IN ARRAY v_tables
  LOOP
    v_order_id := gen_random_uuid();
    v_driver_id := gen_random_uuid();
    v_action_id := gen_random_uuid();
    INSERT INTO mise_drivers (
      id, name, active, state, last_position_at, max_capacity
    ) VALUES (v_driver_id, 'fault driver', true, 'idle', now(), 4);
    INSERT INTO mise_driver_tenants (driver_id, tenant_id, status)
    VALUES (v_driver_id, '11000000-0000-0000-0000-000000000001', 'active');
    INSERT INTO customer_orders (
      id, location_id, tenant_id, bestellnummer, kunde_name, typ, status
    ) VALUES (
      v_order_id, '12000000-0000-0000-0000-000000000001',
      '11000000-0000-0000-0000-000000000001',
      'fault', 'fixture', 'lieferung', 'fertig'
    );
    SELECT jsonb_build_object(
      'batches', (SELECT count(*) FROM mise_delivery_batches),
      'stops', (SELECT count(*) FROM mise_delivery_batch_stops),
      'assignments', (SELECT count(*) FROM dispatch_offer_assignments),
      'audit', (SELECT count(*) FROM dispatch_offer_audit),
      'outbox', (SELECT count(*) FROM mise_push_outbox),
      'requests', (SELECT count(*) FROM dispatch_assignment_requests_v2)
    ) INTO v_before;
    PERFORM set_config('t02.fail_table', v_table, true);
    BEGIN
      PERFORM fn_dispatch_assign_orders_v2(
        '11000000-0000-0000-0000-000000000001',
        '15000000-0000-0000-0000-000000000001', 1,
        v_driver_id, 0, v_action_id, 'fault-test',
        jsonb_build_array(jsonb_build_object(
          'order_id', v_order_id, 'expected_order_version', 0,
          'pickup_lat', 52.0, 'pickup_lng', 13.0, 'pickup_address', 'pickup',
          'dropoff_lat', 52.1, 'dropoff_lng', 13.1, 'dropoff_address', 'dropoff',
          'pickup_deadline_at', now() + interval '20 minutes',
          'delivery_deadline_at', now() + interval '45 minutes'
        )), 'assigned', 'fault'
      );
      RAISE EXCEPTION 'failure injection did not fire for %', v_table;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'T02_INJECTED_FAILURE_AFTER_%' THEN
        RAISE;
      END IF;
    END;
    PERFORM set_config('t02.fail_table', '', true);
    IF (SELECT dispatch_version FROM customer_orders WHERE id = v_order_id) <> 0
       OR (SELECT mise_batch_id FROM customer_orders WHERE id = v_order_id) IS NOT NULL
       OR (SELECT state_version FROM mise_drivers WHERE id = v_driver_id) <> 0
       OR (SELECT current_capacity FROM mise_drivers WHERE id = v_driver_id) <> 0
       OR v_before <> jsonb_build_object(
         'batches', (SELECT count(*) FROM mise_delivery_batches),
         'stops', (SELECT count(*) FROM mise_delivery_batch_stops),
         'assignments', (SELECT count(*) FROM dispatch_offer_assignments),
         'audit', (SELECT count(*) FROM dispatch_offer_audit),
         'outbox', (SELECT count(*) FROM mise_push_outbox),
         'requests', (SELECT count(*) FROM dispatch_assignment_requests_v2)
       ) THEN
      RAISE EXCEPTION 'partial state survived injected failure after %', v_table;
    END IF;
  END LOOP;
END
$faults$;

-- Explicit multi-order rollback: failure after the first order-claim statement
-- rolls back the shared trip, every stop, both claims and the driver load.
DO $multi_order_rollback$
DECLARE
  v_order_a uuid := gen_random_uuid();
  v_order_b uuid := gen_random_uuid();
  v_driver uuid := gen_random_uuid();
BEGIN
  INSERT INTO mise_drivers (id, name, active, state, last_position_at, max_capacity)
  VALUES (v_driver, 'multi rollback driver', true, 'idle', now(), 4);
  INSERT INTO mise_driver_tenants (driver_id, tenant_id, status)
  VALUES (v_driver, '11000000-0000-0000-0000-000000000001', 'active');
  INSERT INTO customer_orders (
    id, location_id, tenant_id, bestellnummer, kunde_name, typ, status
  ) VALUES
    (v_order_a, '12000000-0000-0000-0000-000000000001',
     '11000000-0000-0000-0000-000000000001',
     'multi-a', 'fixture', 'lieferung', 'fertig'),
    (v_order_b, '12000000-0000-0000-0000-000000000001',
     '11000000-0000-0000-0000-000000000001',
     'multi-b', 'fixture', 'lieferung', 'fertig');
  PERFORM set_config('t02.fail_table', 'customer_orders', true);
  BEGIN
    PERFORM fn_dispatch_assign_orders_v2(
      '11000000-0000-0000-0000-000000000001',
      '15000000-0000-0000-0000-000000000001', 1,
      v_driver, 0, gen_random_uuid(), 'multi-fault-test',
      jsonb_build_array(
        jsonb_build_object(
          'order_id', v_order_a, 'expected_order_version', 0,
          'pickup_lat', 52.0, 'pickup_lng', 13.0,
          'dropoff_lat', 52.1, 'dropoff_lng', 13.1,
          'pickup_deadline_at', now() + interval '20 minutes',
          'delivery_deadline_at', now() + interval '45 minutes'),
        jsonb_build_object(
          'order_id', v_order_b, 'expected_order_version', 0,
          'pickup_lat', 52.0, 'pickup_lng', 13.0,
          'dropoff_lat', 52.2, 'dropoff_lng', 13.2,
          'pickup_deadline_at', now() + interval '20 minutes',
          'delivery_deadline_at', now() + interval '50 minutes')
      ), 'assigned', 'multi-fault'
    );
    RAISE EXCEPTION 'multi-order failure injection did not fire';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'T02_INJECTED_FAILURE_AFTER_customer_orders%' THEN
      RAISE;
    END IF;
  END;
  PERFORM set_config('t02.fail_table', '', true);
  IF EXISTS (
    SELECT 1 FROM customer_orders
    WHERE id IN (v_order_a, v_order_b)
      AND (dispatch_version <> 0 OR mise_batch_id IS NOT NULL
           OR mise_driver_id IS NOT NULL OR status <> 'fertig')
  ) OR EXISTS (
    SELECT 1 FROM dispatch_offer_assignments
    WHERE order_id IN (v_order_a, v_order_b)
  ) OR EXISTS (
    SELECT 1 FROM mise_delivery_batch_stops
    WHERE order_id IN (v_order_a, v_order_b)
  ) OR (SELECT current_capacity FROM mise_drivers WHERE id = v_driver) <> 0 THEN
    RAISE EXCEPTION 'partial multi-order state survived rollback';
  END IF;
END
$multi_order_rollback$;

DROP TRIGGER t02_fail_batch ON mise_delivery_batches;
DROP TRIGGER t02_fail_stops ON mise_delivery_batch_stops;
DROP TRIGGER t02_fail_orders ON customer_orders;
DROP TRIGGER t02_fail_driver ON mise_drivers;
DROP TRIGGER t02_fail_assignment ON dispatch_offer_assignments;
DROP TRIGGER t02_fail_audit ON dispatch_offer_audit;
DROP TRIGGER t02_fail_outbox ON mise_push_outbox;
DROP TRIGGER t02_fail_request ON dispatch_assignment_requests_v2;
DROP FUNCTION t02_fail_selected_write();
