\set ON_ERROR_STOP on

INSERT INTO tenants(id,name,slug) VALUES
('82000000-0000-0000-0000-000000000001','T08','t08');
INSERT INTO locations(id,tenant_id,name) VALUES
('82000000-0000-0000-0000-000000000002','82000000-0000-0000-0000-000000000001','T08 Store');
INSERT INTO customer_orders(id,tenant_id,location_id,bestellnummer,kunde_name,typ,status)
VALUES
('82000000-0000-0000-0000-000000000011','82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000002','T08-1','fixture','lieferung','fertig'),
('82000000-0000-0000-0000-000000000012','82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000002','T08-2','fixture','lieferung','fertig'),
('82000000-0000-0000-0000-000000000013','82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000002','T08-3','fixture','lieferung','fertig'),
('82000000-0000-0000-0000-000000000014','82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000002','T08-4','fixture','lieferung','fertig');
INSERT INTO dispatch_routing_hold_config_v2(tenant_id,enabled,shadow_only)
VALUES('82000000-0000-0000-0000-000000000001',true,false);

INSERT INTO mise_drivers(id,name,active,state,current_capacity,max_capacity,state_version)
VALUES('82000000-0000-0000-0000-000000000020','T08 Driver',true,'assigned',1,4,0);
INSERT INTO mise_driver_tenants(driver_id,tenant_id,status)
VALUES('82000000-0000-0000-0000-000000000020',
  '82000000-0000-0000-0000-000000000001','active');
INSERT INTO mise_delivery_batches(id,driver_id,state,location_id,route_version,state_version,
  pickup_deadline_at,delivery_deadline_at)
VALUES('82000000-0000-0000-0000-000000000030',
  '82000000-0000-0000-0000-000000000020','assigned',
  '82000000-0000-0000-0000-000000000002',1,1,
  clock_timestamp()+interval '10 minutes',clock_timestamp()+interval '50 minutes');
UPDATE customer_orders SET mise_batch_id='82000000-0000-0000-0000-000000000030',
  mise_driver_id='82000000-0000-0000-0000-000000000020',status='assigned'
WHERE id='82000000-0000-0000-0000-000000000011';
INSERT INTO mise_delivery_batch_stops(id,batch_id,order_id,type,sequence,lat,lng,address,state)
VALUES
('82000000-0000-0000-0000-000000000031','82000000-0000-0000-0000-000000000030',
 '82000000-0000-0000-0000-000000000011','pickup',0,50,6,'store','pending'),
('82000000-0000-0000-0000-000000000032','82000000-0000-0000-0000-000000000030',
 '82000000-0000-0000-0000-000000000011','dropoff',1,50.01,6.01,'old','pending');
SELECT fn_dispatch_set_writer_v2('82000000-0000-0000-0000-000000000001','atomic_v2',true);
SELECT fn_dispatch_claim_writer_v2('82000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000040',120);

DO $$
DECLARE r jsonb; v bigint;
BEGIN
  r:=fn_append_order_to_route_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000040',1,
    '82000000-0000-0000-0000-000000000020',0,
    '82000000-0000-0000-0000-000000000030',1,
    '82000000-0000-0000-0000-000000000012',0,
    '82000000-0000-0000-0000-000000000033','82000000-0000-0000-0000-000000000034',
    50,6,50.02,6.02,'store','new',
    '2099-01-01T10:10:00Z','2099-01-01T10:45:00Z',
    '[{"id":"82000000-0000-0000-0000-000000000031","kind":"pickup"},
      {"id":"82000000-0000-0000-0000-000000000033","kind":"pickup"},
      {"id":"82000000-0000-0000-0000-000000000032","kind":"dropoff"},
      {"id":"82000000-0000-0000-0000-000000000034","kind":"dropoff"}]',
    '{}','{"reason_code":"INSERTION_FEASIBLE"}',false,
    '82000000-0000-0000-0000-000000000041','82000000-0000-0000-0000-000000000042');
  IF r->>'ok'<>'true' OR r->>'route_version'<>'2' THEN
    RAISE EXCEPTION 'atomic route append failed %',r;
  END IF;
  IF (SELECT current_capacity FROM mise_drivers WHERE id='82000000-0000-0000-0000-000000000020')<>2
     OR (SELECT dispatch_version FROM customer_orders WHERE id='82000000-0000-0000-0000-000000000012')<>1
     OR (SELECT route_version FROM mise_delivery_batches WHERE id='82000000-0000-0000-0000-000000000030')<>2
     OR (SELECT count(*) FROM mise_push_outbox WHERE driver_id='82000000-0000-0000-0000-000000000020')<>1 THEN
    RAISE EXCEPTION 'atomic route append projection mismatch';
  END IF;
  r:=fn_append_order_to_route_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000040',1,
    '82000000-0000-0000-0000-000000000020',0,
    '82000000-0000-0000-0000-000000000030',1,
    '82000000-0000-0000-0000-000000000012',0,
    '82000000-0000-0000-0000-000000000033','82000000-0000-0000-0000-000000000034',
    50,6,50.02,6.02,'store','new',
    '2099-01-01T10:10:00Z','2099-01-01T10:45:00Z',
    '[{"id":"82000000-0000-0000-0000-000000000031","kind":"pickup"},
      {"id":"82000000-0000-0000-0000-000000000033","kind":"pickup"},
      {"id":"82000000-0000-0000-0000-000000000032","kind":"dropoff"},
      {"id":"82000000-0000-0000-0000-000000000034","kind":"dropoff"}]',
    '{}','{"reason_code":"INSERTION_FEASIBLE"}',false,
    '82000000-0000-0000-0000-000000000041','82000000-0000-0000-0000-000000000042');
  IF r->>'idempotent_replay'<>'true' THEN RAISE EXCEPTION 'append replay failed %',r; END IF;
  r:=fn_append_order_to_route_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000040',1,
    '82000000-0000-0000-0000-000000000020',0,
    '82000000-0000-0000-0000-000000000030',1,
    '82000000-0000-0000-0000-000000000012',0,
    '82000000-0000-0000-0000-000000000033','82000000-0000-0000-0000-000000000034',
    50,6,50.02,6.02,'store','new',
    '2099-01-01T10:10:00Z','2099-01-01T10:45:00Z',
    '[{"id":"82000000-0000-0000-0000-000000000031","kind":"pickup"},
      {"id":"82000000-0000-0000-0000-000000000033","kind":"pickup"},
      {"id":"82000000-0000-0000-0000-000000000032","kind":"dropoff"},
      {"id":"82000000-0000-0000-0000-000000000034","kind":"dropoff"}]',
    '{}','{"reason_code":"CHANGED_FINGERPRINT"}',false,
    '82000000-0000-0000-0000-000000000041','82000000-0000-0000-0000-000000000042');
  IF r->>'reason_code'<>'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
     OR (SELECT count(*) FROM mise_delivery_batch_stops WHERE order_id=
       '82000000-0000-0000-0000-000000000012')<>2
     OR (SELECT count(*) FROM dispatch_offer_assignments WHERE order_id=
       '82000000-0000-0000-0000-000000000012')<>1
     OR (SELECT count(*) FROM dispatch_assignment_requests_v2 WHERE action='route_append'
       AND tenant_id='82000000-0000-0000-0000-000000000001')<>1 THEN
    RAISE EXCEPTION 'append idempotency fingerprint reuse was not rejected atomically %',r;
  END IF;
  r:=fn_append_order_to_route_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000040',1,
    '82000000-0000-0000-0000-000000000020',1,
    '82000000-0000-0000-0000-000000000030',1,
    '82000000-0000-0000-0000-000000000013',0,
    '82000000-0000-0000-0000-000000000035','82000000-0000-0000-0000-000000000036',
    50,6,50.03,6.03,'store','stale',
    '2099-01-01T10:10:00Z','2099-01-01T10:45:00Z','[]','{}','{}',false,
    '82000000-0000-0000-0000-000000000043','82000000-0000-0000-0000-000000000044');
  IF r->>'reason_code'<>'BATCH_ROUTE_VERSION_CONFLICT'
     OR (SELECT count(*) FROM mise_delivery_batch_stops WHERE order_id=
       '82000000-0000-0000-0000-000000000013')<>0
     OR (SELECT current_capacity FROM mise_drivers WHERE id=
       '82000000-0000-0000-0000-000000000020')<>2 THEN
    RAISE EXCEPTION 'stale route append did not roll back %',r;
  END IF;

  r:=fn_persist_route_plan_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000301',0,1,
    '[{"id":"pickup"},{"id":"dropoff"}]','{"pickup":"2026-07-28T10:00:00Z"}',
    '{"reason_code":"INSERTION_FEASIBLE"}',false,
    '82000000-0000-0000-0000-000000000302','82000000-0000-0000-0000-000000000303');
  IF r->>'route_version'<>'1' THEN RAISE EXCEPTION 'route create failed %',r; END IF;
  r:=fn_persist_route_plan_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000301',0,1,
    '[{"id":"pickup"},{"id":"dropoff"}]','{"pickup":"2026-07-28T10:00:00Z"}',
    '{"reason_code":"INSERTION_FEASIBLE"}',false,
    '82000000-0000-0000-0000-000000000302','82000000-0000-0000-0000-000000000303');
  IF r->>'idempotent_replay'<>'true' THEN RAISE EXCEPTION 'route replay failed %',r; END IF;
  r:=fn_persist_route_plan_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000301',0,2,
    '[{"id":"pickup"},{"id":"dropoff"}]','{}','{}',true,
    '82000000-0000-0000-0000-000000000304','82000000-0000-0000-0000-000000000303');
  IF r->>'reason_code'<>'ROUTE_VERSION_CONFLICT' THEN RAISE EXCEPTION 'route CAS failed %',r; END IF;

  r:=fn_schedule_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000011',0,1,
    clock_timestamp()+interval '2 minutes',clock_timestamp()+interval '5 minutes',
    clock_timestamp()+interval '1 minute','WAIT_FOR_DRIVER_OR_MATCH','{"prep":15}',
    '82000000-0000-0000-0000-000000000101','82000000-0000-0000-0000-000000000201');
  IF r->>'ok'<>'true' OR r->>'state'<>'held' THEN RAISE EXCEPTION 'schedule failed %',r; END IF;
  r:=fn_schedule_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000011',0,1,
    clock_timestamp()+interval '2 minutes',clock_timestamp()+interval '5 minutes',
    clock_timestamp()+interval '1 minute','WAIT_FOR_DRIVER_OR_MATCH','{"prep":15}',
    '82000000-0000-0000-0000-000000000101','82000000-0000-0000-0000-000000000201');
  IF r->>'idempotent_replay'<>'true' THEN RAISE EXCEPTION 'schedule replay failed %',r; END IF;
  r:=fn_release_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000011',1,
    '82000000-0000-0000-0000-000000000102','82000000-0000-0000-0000-000000000201','DEADLINE_OVERRIDE');
  IF r->>'state'<>'released' THEN RAISE EXCEPTION 'release failed %',r; END IF;
  r:=fn_release_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000011',1,
    '82000000-0000-0000-0000-000000000102','82000000-0000-0000-0000-000000000201','DEADLINE_OVERRIDE');
  IF r->>'idempotent_replay'<>'true' THEN RAISE EXCEPTION 'release replay failed %',r; END IF;
  IF (SELECT count(*) FROM dispatch_kitchen_release_outbox_v2 WHERE order_id='82000000-0000-0000-0000-000000000011')<>1
    THEN RAISE EXCEPTION 'duplicate kitchen release'; END IF;
  IF (SELECT count(*) FROM dispatch_kitchen_hold_audit_v2 WHERE order_id=
      '82000000-0000-0000-0000-000000000011')<>2 THEN
    RAISE EXCEPTION 'kitchen hold audit incomplete';
  END IF;

  r:=fn_schedule_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000012',0,1,
    clock_timestamp()+interval '2 minutes',clock_timestamp()+interval '5 minutes',
    clock_timestamp()+interval '1 minute','WAIT','{}',
    '82000000-0000-0000-0000-000000000103','82000000-0000-0000-0000-000000000202');
  r:=fn_cancel_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000012',1,
    '82000000-0000-0000-0000-000000000104');
  IF r->>'state'<>'cancelled' THEN RAISE EXCEPTION 'cancel failed %',r; END IF;

  r:=fn_schedule_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000013',0,1,
    clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 minute',
    clock_timestamp()-interval '1 minute','WAIT','{}',
    '82000000-0000-0000-0000-000000000105','82000000-0000-0000-0000-000000000203');
  v:=fn_watchdog_release_kitchen_holds_v2(100);
  IF v<>1 OR (SELECT state FROM dispatch_kitchen_holds_v2 WHERE order_id='82000000-0000-0000-0000-000000000013')<>'released'
    THEN RAISE EXCEPTION 'watchdog failed %',v; END IF;
  v:=fn_watchdog_release_kitchen_holds_v2(100);
  IF v<>0 THEN RAISE EXCEPTION 'watchdog restart duplicate %',v; END IF;

  r:=fn_schedule_kitchen_hold_v2(
    '82000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000014',0,1,
    clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 minute',
    clock_timestamp()-interval '1 minute','WAIT','{}',
    '82000000-0000-0000-0000-000000000106','82000000-0000-0000-0000-000000000204');
  UPDATE customer_orders SET status='cancelled'
    WHERE id='82000000-0000-0000-0000-000000000014';
  v:=fn_watchdog_release_kitchen_holds_v2(100);
  IF v<>0 OR (SELECT state FROM dispatch_kitchen_holds_v2 WHERE order_id=
      '82000000-0000-0000-0000-000000000014')<>'cancelled'
      OR EXISTS(SELECT 1 FROM dispatch_kitchen_release_outbox_v2 WHERE order_id=
        '82000000-0000-0000-0000-000000000014') THEN
    RAISE EXCEPTION 'watchdog released cancelled order %',v;
  END IF;
END $$;
