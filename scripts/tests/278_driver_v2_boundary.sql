\set ON_ERROR_STOP on

INSERT INTO tenants(id,name,slug) VALUES
 ('31000000-0000-0000-0000-000000000001','T03 tenant','t03');
INSERT INTO locations(id,tenant_id,name) VALUES
 ('32000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','T03 kitchen');
INSERT INTO mise_drivers(id,name,active,state,state_version,current_capacity,max_capacity) VALUES
 ('33000000-0000-0000-0000-000000000001','owner',true,'assigned',0,1,1),
 ('33000000-0000-0000-0000-000000000002','other',true,'assigned',0,1,1),
 ('33000000-0000-0000-0000-000000000003','session',false,'offline',0,0,1);
INSERT INTO mise_driver_tenants(driver_id,tenant_id,status) VALUES
 ('33000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','active'),
 ('33000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000001','active');
INSERT INTO mise_driver_tenants(driver_id,tenant_id,status) VALUES
 ('33000000-0000-0000-0000-000000000003','31000000-0000-0000-0000-000000000001','active');
INSERT INTO mise_delivery_batches(id,driver_id,state,location_id,state_version,route_version)
VALUES('35000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001','assigned',
  '32000000-0000-0000-0000-000000000001',0,0);
INSERT INTO customer_orders(id,location_id,tenant_id,typ,status,dispatch_version)
VALUES('36000000-0000-0000-0000-000000000001',
  '32000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001','lieferung','assigned',0);
INSERT INTO mise_delivery_batch_stops(id,batch_id,order_id,type,sequence,state,stop_version)
VALUES('37000000-0000-0000-0000-000000000001',
  '35000000-0000-0000-0000-000000000001',
  '36000000-0000-0000-0000-000000000001','pickup',1,'pending',0);
INSERT INTO mise_delivery_batch_stops(id,batch_id,order_id,type,sequence,state,stop_version)
VALUES('37000000-0000-0000-0000-000000000002',
  '35000000-0000-0000-0000-000000000001',
  '36000000-0000-0000-0000-000000000001','dropoff',2,'pending',0);
UPDATE customer_orders SET mise_batch_id='35000000-0000-0000-0000-000000000001',
  mise_driver_id='33000000-0000-0000-0000-000000000001'
WHERE id='36000000-0000-0000-0000-000000000001';
INSERT INTO order_items(id,order_id,name) VALUES
 ('38000000-0000-0000-0000-000000000001','36000000-0000-0000-0000-000000000001','A'),
 ('38000000-0000-0000-0000-000000000002','36000000-0000-0000-0000-000000000001','B');
INSERT INTO dispatch_offer_assignments(
 tenant_id,order_id,batch_id,driver_id,state,decision_id,idempotency_key,
 request_fingerprint,expected_order_version,assignment_version,algorithm_version)
VALUES('31000000-0000-0000-0000-000000000001',
 '36000000-0000-0000-0000-000000000001','35000000-0000-0000-0000-000000000001',
 '33000000-0000-0000-0000-000000000001','assigned',gen_random_uuid(),gen_random_uuid(),
 't03',0,1,'t03-test');

DO $items$
DECLARE r jsonb; audit_count bigint;
BEGIN
  SELECT fn_driver_arrive_v2('31000000-0000-0000-0000-000000000001',
    '37000000-0000-0000-0000-000000000001',0,0,0,0,
    '33000000-0000-0000-0000-000000000001',
    '39000000-0000-4000-8000-000000000000','40000000-0000-4000-8000-000000000000') INTO r;
  IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'arrival failed: %',r; END IF;
  IF NOT EXISTS(SELECT 1 FROM mise_delivery_batch_stops WHERE id='37000000-0000-0000-0000-000000000001'
      AND state='arrived' AND stop_version=1)
    OR NOT EXISTS(SELECT 1 FROM dispatch_offer_audit WHERE event_type='stop.arrived')
  THEN RAISE EXCEPTION 'arrival projection/audit missing'; END IF;
  SELECT fn_driver_arrive_v2('31000000-0000-0000-0000-000000000001',
    '37000000-0000-0000-0000-000000000001',0,0,0,0,
    '33000000-0000-0000-0000-000000000001',
    '39000000-0000-4000-8000-000000000000','40000000-0000-4000-8000-000000000000') INTO r;
  IF r->>'idempotent_replay'<>'true' THEN RAISE EXCEPTION 'arrival replay failed: %',r; END IF;
  SELECT fn_driver_pickup_v2('31000000-0000-0000-0000-000000000001',
    '36000000-0000-0000-0000-000000000001',0,1,0,0,
    '33000000-0000-0000-0000-000000000001',
    '39000000-0000-4000-8000-000000000001',1,0,'40000000-0000-4000-8000-000000000001') INTO r;
  IF r->>'reason_code'<>'ITEM_RESOLUTION_INCOMPLETE' THEN RAISE EXCEPTION 'pickup not blocked: %',r; END IF;

  SELECT fn_driver_resolve_items_v2('31000000-0000-0000-0000-000000000001',
    '36000000-0000-0000-0000-000000000001',0,1,0,0,
    '33000000-0000-0000-0000-000000000001','39000000-0000-4000-8000-000000000002',
    '[{"id":"38000000-0000-0000-0000-000000000001","outcome":"picked"}]',1,0,'40000000-0000-4000-8000-000000000002') INTO r;
  IF r->>'reason_code'<>'ITEM_SET_INCOMPLETE_OR_FOREIGN' THEN RAISE EXCEPTION 'incomplete accepted: %',r; END IF;

  SELECT fn_driver_resolve_items_v2('31000000-0000-0000-0000-000000000001',
    '36000000-0000-0000-0000-000000000001',0,1,0,0,
    '33000000-0000-0000-0000-000000000001','39000000-0000-4000-8000-000000000003',
    '[{"id":"38000000-0000-0000-0000-000000000001","outcome":"picked"},{"id":"38000000-0000-0000-0000-000000000001","outcome":"missing"}]',1,0,'40000000-0000-4000-8000-000000000003') INTO r;
  IF r->>'reason_code'<>'DUPLICATE_ITEM_ID' THEN RAISE EXCEPTION 'duplicate accepted: %',r; END IF;

  SELECT fn_driver_resolve_items_v2('31000000-0000-0000-0000-000000000001',
    '36000000-0000-0000-0000-000000000001',0,1,0,0,
    '33000000-0000-0000-0000-000000000001','39000000-0000-4000-8000-000000000004',
    '[{"id":"38000000-0000-0000-0000-000000000001","outcome":"picked"},{"id":"38000000-0000-0000-0000-000000000099","outcome":"missing"}]',1,0,'40000000-0000-4000-8000-000000000004') INTO r;
  IF r->>'reason_code'<>'ITEM_SET_INCOMPLETE_OR_FOREIGN' THEN RAISE EXCEPTION 'fabricated accepted: %',r; END IF;

  SELECT fn_driver_resolve_items_v2('31000000-0000-0000-0000-000000000001',
    '36000000-0000-0000-0000-000000000001',0,1,0,0,
    '33000000-0000-0000-0000-000000000001','39000000-0000-4000-8000-000000000005',
    '[{"id":"38000000-0000-0000-0000-000000000001","outcome":"picked"},{"id":"38000000-0000-0000-0000-000000000002","outcome":"missing"}]',1,0,'40000000-0000-4000-8000-000000000005') INTO r;
  IF r->>'ok'<>'true' OR (SELECT count(*) FROM driver_item_outcomes_v2)<>2
  THEN RAISE EXCEPTION 'canonical resolution failed: %',r; END IF;

  SELECT fn_driver_accept_ack_compat_v2('31000000-0000-0000-0000-000000000001',
    (SELECT id FROM dispatch_offer_assignments WHERE order_id='36000000-0000-0000-0000-000000000001'),
    '33000000-0000-0000-0000-000000000001',1,
    '39000000-0000-4000-8000-000000000006','{}','driver-v1-test','40000000-0000-4000-8000-000000000006') INTO r;
  IF r->>'ok'<>'true' OR (SELECT count(*) FROM driver_api_compatibility_events_v2)<>1
  THEN RAISE EXCEPTION 'atomic ACK telemetry failed: %',r; END IF;

  SELECT fn_driver_pickup_v2('31000000-0000-0000-0000-000000000001',
    '36000000-0000-0000-0000-000000000001',0,1,0,0,
    '33000000-0000-0000-0000-000000000001',
    '39000000-0000-4000-8000-000000000007',2,0,'40000000-0000-4000-8000-000000000007') INTO r;
  IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'pickup failed: %',r; END IF;
  SELECT fn_driver_depart_v2('31000000-0000-0000-0000-000000000001',
    '36000000-0000-0000-0000-000000000001',1,2,1,1,
    '33000000-0000-0000-0000-000000000001',
    '39000000-0000-4000-8000-000000000008',
    '37000000-0000-0000-0000-000000000001',3,0,'40000000-0000-4000-8000-000000000008') INTO r;
  IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'depart failed: %',r; END IF;
  SELECT fn_driver_depart_v2('31000000-0000-0000-0000-000000000001',
    '36000000-0000-0000-0000-000000000001',1,2,1,1,
    '33000000-0000-0000-0000-000000000001',
    '39000000-0000-4000-8000-000000000008',
    '37000000-0000-0000-0000-000000000001',3,0,'40000000-0000-4000-8000-000000000099') INTO r;
  IF r->>'idempotent_replay'<>'true'
    OR r->>'correlation_id'<>'40000000-0000-4000-8000-000000000008'
  THEN RAISE EXCEPTION 'depart replay did not retain original result/correlation: %',r; END IF;
  SELECT fn_driver_depart_v2('31000000-0000-0000-0000-000000000001',
    '36000000-0000-0000-0000-000000000001',999,2,1,1,
    '33000000-0000-0000-0000-000000000001',
    '39000000-0000-4000-8000-000000000008',
    '37000000-0000-0000-0000-000000000001',3,0,'40000000-0000-4000-8000-000000000099') INTO r;
  IF r->>'reason_code'<>'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
  THEN RAISE EXCEPTION 'depart different fingerprint accepted: %',r; END IF;
  SELECT count(*) INTO audit_count FROM dispatch_offer_audit;
  SELECT fn_driver_arrive_v2('31000000-0000-0000-0000-000000000001',
    '37000000-0000-0000-0000-000000000002',0,2,0,2,
    '33000000-0000-0000-0000-000000000001',
    '39000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000099') INTO r;
  IF r->>'reason_code'<>'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
    OR (SELECT count(*) FROM dispatch_offer_audit)<>audit_count
  THEN RAISE EXCEPTION 'cross-family action id mutated or audited: %',r; END IF;
  SELECT fn_driver_arrive_v2('31000000-0000-0000-0000-000000000001',
    '37000000-0000-0000-0000-000000000002',0,2,0,2,
    '33000000-0000-0000-0000-000000000001',
    '39000000-0000-4000-8000-000000000012','40000000-0000-4000-8000-000000000012') INTO r;
  IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'dropoff arrival failed: %',r; END IF;
  SELECT fn_driver_complete_v2('31000000-0000-0000-0000-000000000001',
    '36000000-0000-0000-0000-000000000001',2,3,2,2,
    '33000000-0000-0000-0000-000000000001',
    '39000000-0000-4000-8000-000000000009',
    '37000000-0000-0000-0000-000000000002',1,0,'40000000-0000-4000-8000-000000000009') INTO r;
  IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'complete failed: %',r; END IF;
  SELECT fn_driver_complete_v2('31000000-0000-0000-0000-000000000001',
    '36000000-0000-0000-0000-000000000001',2,3,2,2,
    '33000000-0000-0000-0000-000000000001',
    '39000000-0000-4000-8000-000000000009',
    '37000000-0000-0000-0000-000000000002',1,0,'40000000-0000-4000-8000-000000000098') INTO r;
  IF r->>'idempotent_replay'<>'true'
    OR r->>'correlation_id'<>'40000000-0000-4000-8000-000000000009'
  THEN RAISE EXCEPTION 'complete replay did not retain original result/correlation: %',r; END IF;
  SELECT fn_driver_complete_v2('31000000-0000-0000-0000-000000000001',
    '36000000-0000-0000-0000-000000000001',999,3,2,2,
    '33000000-0000-0000-0000-000000000001',
    '39000000-0000-4000-8000-000000000009',
    '37000000-0000-0000-0000-000000000002',1,0,'40000000-0000-4000-8000-000000000098') INTO r;
  IF r->>'reason_code'<>'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
  THEN RAISE EXCEPTION 'complete different fingerprint accepted: %',r; END IF;
END $items$;

DO $session$
DECLARE r jsonb;
BEGIN
 SELECT fn_driver_session_v2('31000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000003','39000000-0000-4000-8000-000000000010',0,true,'40000000-0000-4000-8000-000000000010') INTO r;
 IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'session start failed %',r; END IF;
 SELECT fn_driver_session_v2('31000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000003','39000000-0000-4000-8000-000000000011',1,false,'40000000-0000-4000-8000-000000000011') INTO r;
 IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'session end failed %',r; END IF;
END $session$;

DO $test$
DECLARE r jsonb; action uuid:='34000000-0000-4000-8000-000000000001';
BEGIN
  SELECT fn_driver_report_exception_v2(
    '31000000-0000-0000-0000-000000000001',
    '33000000-0000-0000-0000-000000000001',action,3,
    'medical_safety_emergency','isolated test','40000000-0000-4000-8000-000000000013') INTO r;
  IF r->>'ok'<>'true' THEN RAISE EXCEPTION 'safety exception failed: %',r; END IF;
  IF (SELECT count(*) FROM driver_exceptions_v2 WHERE action_id=action
      AND kind='medical_safety_emergency' AND state='reported')<>1
  THEN RAISE EXCEPTION 'safety exception audit missing'; END IF;

  SELECT fn_driver_report_exception_v2(
    '31000000-0000-0000-0000-000000000001',
    '33000000-0000-0000-0000-000000000001',action,3,
    'medical_safety_emergency','isolated test','40000000-0000-4000-8000-000000000013') INTO r;
  IF r->>'idempotent_replay'<>'true' OR
     (SELECT count(*) FROM driver_exceptions_v2 WHERE action_id=action)<>1
  THEN RAISE EXCEPTION 'duplicate action not replayed: %',r; END IF;
  SELECT fn_driver_report_exception_v2(
    '31000000-0000-0000-0000-000000000001',
    '33000000-0000-0000-0000-000000000001',action,3,
    'medical_safety_emergency','different payload','40000000-0000-4000-8000-000000000013') INTO r;
  IF r->>'reason_code'<>'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
  THEN RAISE EXCEPTION 'different fingerprint replayed: %',r; END IF;

  SELECT fn_driver_report_exception_v2(
    '31000000-0000-0000-0000-000000000001',
    '33000000-0000-0000-0000-000000000001',
    '34000000-0000-4000-8000-000000000002',3,
    'vehicle_failure','stale','40000000-0000-4000-8000-000000000014') INTO r;
  IF r->>'reason_code'<>'EXPECTED_VERSION_CONFLICT'
  THEN RAISE EXCEPTION 'stale version not rejected: %',r; END IF;

  SELECT fn_driver_arrive_v2(
    '31000000-0000-0000-0000-000000000001',
    '37000000-0000-0000-0000-000000000001',0,0,0,0,
    '33000000-0000-0000-0000-000000000002',
    '34000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000015') INTO r;
  IF r->>'reason_code'<>'TENANT_OR_ACTOR_AUTHORITY_MISMATCH'
  THEN RAISE EXCEPTION 'other driver mutation not rejected: %',r; END IF;
END $test$;

DO $correlation$
BEGIN
 IF EXISTS(SELECT 1 FROM driver_action_requests_v2
   WHERE correlation_id::text<>result->>'correlation_id')
 THEN RAISE EXCEPTION 'request/result correlation split'; END IF;
 IF EXISTS(SELECT 1 FROM dispatch_offer_audit a JOIN driver_action_requests_v2 r
   ON r.action_id=a.idempotency_key WHERE a.correlation_id<>r.correlation_id)
 THEN RAISE EXCEPTION 'audit/request correlation split'; END IF;
 IF EXISTS(SELECT 1 FROM driver_api_compatibility_events_v2 c
   JOIN driver_action_requests_v2 r ON r.correlation_id=c.correlation_id
   WHERE c.correlation_id<>r.correlation_id)
 THEN RAISE EXCEPTION 'compatibility correlation split'; END IF;
END $correlation$;

-- Authenticated browser role cannot mutate canonical lifecycle fields.
DO $rls$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customer_orders','mise_drivers','mise_delivery_batches',
    'mise_delivery_batch_stops','dispatch_offer_assignments','driver_action_requests_v2',
    'driver_item_outcomes_v2','driver_exceptions_v2']
  LOOP
    IF has_table_privilege('authenticated','public.'||t,'INSERT')
      OR has_table_privilege('authenticated','public.'||t,'UPDATE')
      OR has_table_privilege('authenticated','public.'||t,'DELETE')
    THEN RAISE EXCEPTION 'dangerous authenticated grant survived on %',t; END IF;
    IF has_table_privilege('anon','public.'||t,'INSERT')
      OR has_table_privilege('anon','public.'||t,'UPDATE')
      OR has_table_privilege('anon','public.'||t,'DELETE')
    THEN RAISE EXCEPTION 'dangerous anon grant survived on %',t; END IF;
  END LOOP;
  IF has_column_privilege('authenticated','public.order_items','pick_confirmed_at','UPDATE')
    OR has_column_privilege('authenticated','public.order_items','pick_missing','UPDATE')
  THEN RAISE EXCEPTION 'item resolution columns remain writable'; END IF;
  IF has_table_privilege('authenticated','public.driver_status','INSERT')
    OR has_table_privilege('authenticated','public.driver_status','UPDATE')
    OR has_table_privilege('authenticated','public.driver_status','DELETE')
    OR has_table_privilege('anon','public.driver_status','INSERT')
    OR has_table_privilege('anon','public.driver_status','UPDATE')
    OR has_table_privilege('anon','public.driver_status','DELETE')
  THEN RAISE EXCEPTION 'driver_status browser mutation grant survived'; END IF;
  IF NOT has_table_privilege('authenticated','public.driver_status','SELECT')
    OR NOT has_table_privilege('anon','public.driver_status','SELECT')
  THEN RAISE EXCEPTION 'driver_status read privilege was not preserved'; END IF;
END $rls$;

DO $gps$
BEGIN
  IF to_regprocedure('public.fn_driver_upload_gps_v2(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'T03 invented GPS persistence owned by T06';
  END IF;
END $gps$;

\echo 'T03 driver-v2 migration/RLS/idempotency/exception tests: PASS'
