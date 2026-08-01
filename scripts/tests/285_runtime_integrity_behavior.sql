\set ON_ERROR_STOP on

INSERT INTO mise_drivers(id,active,state,state_version,current_capacity,push_enabled) VALUES
 ('85000000-0000-0000-0000-000000000001',true,'delivering',5,2,true),
 ('85000000-0000-0000-0000-000000000002',false,'offline',1,0,true);
INSERT INTO customer_orders(id,status,dispatch_version) VALUES
 ('85000000-0000-0000-0000-000000000011','out_for_delivery',3),
 ('85000000-0000-0000-0000-000000000012','out_for_delivery',7);
INSERT INTO mise_delivery_batches(id,driver_id,state,state_version,route_version,created_at) VALUES
 ('85000000-0000-0000-0000-000000000021','85000000-0000-0000-0000-000000000001','in_progress',4,9,now()-interval '2 minutes');
INSERT INTO dispatch_offer_assignments(id,tenant_id,order_id,batch_id,driver_id,state,assignment_version) VALUES
 ('85000000-0000-0000-0000-000000000031','85000000-0000-0000-0000-000000000099','85000000-0000-0000-0000-000000000011','85000000-0000-0000-0000-000000000021','85000000-0000-0000-0000-000000000001','in_progress',2),
 ('85000000-0000-0000-0000-000000000032','85000000-0000-0000-0000-000000000099','85000000-0000-0000-0000-000000000012','85000000-0000-0000-0000-000000000021','85000000-0000-0000-0000-000000000001','in_progress',6);
INSERT INTO mise_delivery_batch_stops(id,batch_id,order_id,type,state,stop_version) VALUES
 ('85000000-0000-0000-0000-000000000041','85000000-0000-0000-0000-000000000021','85000000-0000-0000-0000-000000000011','dropoff','arrived',8),
 ('85000000-0000-0000-0000-000000000042','85000000-0000-0000-0000-000000000021','85000000-0000-0000-0000-000000000012','dropoff','pending',3);

DO $$
DECLARE r jsonb;
BEGIN
 r:=fn_driver_complete_v2(
  '85000000-0000-0000-0000-000000000099','85000000-0000-0000-0000-000000000011',3,2,4,5,
  '85000000-0000-0000-0000-000000000001','85000000-0000-0000-0000-000000000051',
  '85000000-0000-0000-0000-000000000041',8,9,'85000000-0000-0000-0000-000000000052');
 IF NOT (r->>'ok')::boolean OR r->>'state'<>'in_progress'
   OR (r->>'remaining_assignments')::integer<>1 OR NOT (r->>'route_replan_required')::boolean THEN
  RAISE EXCEPTION 'T285_FIRST_COMPLETION_RESULT_INVALID: %',r; END IF;
 IF (SELECT state FROM mise_delivery_batches WHERE id='85000000-0000-0000-0000-000000000021')<>'in_progress'
   OR (SELECT state FROM mise_drivers WHERE id='85000000-0000-0000-0000-000000000001')<>'delivering'
   OR (SELECT current_capacity FROM mise_drivers WHERE id='85000000-0000-0000-0000-000000000001')<>1
   OR (SELECT status FROM customer_orders WHERE id='85000000-0000-0000-0000-000000000012')<>'out_for_delivery' THEN
  RAISE EXCEPTION 'T285_FIRST_COMPLETION_CLOSED_MULTI_ORDER_TOUR'; END IF;
 UPDATE mise_delivery_batch_stops SET state='arrived' WHERE id='85000000-0000-0000-0000-000000000042';
 r:=fn_driver_complete_v2(
  '85000000-0000-0000-0000-000000000099','85000000-0000-0000-0000-000000000012',7,6,5,6,
  '85000000-0000-0000-0000-000000000001','85000000-0000-0000-0000-000000000053',
  '85000000-0000-0000-0000-000000000042',3,10,'85000000-0000-0000-0000-000000000054');
 IF NOT (r->>'ok')::boolean OR r->>'state'<>'completed' OR (r->>'remaining_assignments')::integer<>0 THEN
  RAISE EXCEPTION 'T285_FINAL_COMPLETION_RESULT_INVALID: %',r; END IF;
 IF (SELECT state FROM mise_delivery_batches WHERE id='85000000-0000-0000-0000-000000000021')<>'completed'
   OR (SELECT state FROM mise_drivers WHERE id='85000000-0000-0000-0000-000000000001')<>'returning'
   OR (SELECT current_capacity FROM mise_drivers WHERE id='85000000-0000-0000-0000-000000000001')<>0 THEN
  RAISE EXCEPTION 'T285_FINAL_COMPLETION_DID_NOT_CLOSE_TOUR'; END IF;
END $$;

-- Duplicate logical alarm is ignored, while a distinct reminder ordinal survives.
INSERT INTO mise_push_outbox(driver_id,type,title,body,data)
VALUES('85000000-0000-0000-0000-000000000001','order_assigned','A','A',
 '{"batch_id":"85000000-0000-0000-0000-000000000021"}');
INSERT INTO mise_push_outbox(driver_id,type,title,body,data)
VALUES('85000000-0000-0000-0000-000000000001','order_assigned','A2','A2',
 '{"batch_id":"85000000-0000-0000-0000-000000000021"}');
INSERT INTO mise_push_outbox(driver_id,type,title,body,data)
VALUES('85000000-0000-0000-0000-000000000001','order_assigned','R','R',
 '{"batch_id":"85000000-0000-0000-0000-000000000021","reminder":true,"reminder_ordinal":"1"}');
DO $$ BEGIN
 IF (SELECT count(*) FROM mise_push_outbox WHERE data->>'batch_id'='85000000-0000-0000-0000-000000000021')<>2
 THEN RAISE EXCEPTION 'T285_PUSH_DEDUPE_INVALID'; END IF;
END $$;

-- Offline/superseded assignment alarms become terminal before claim.
INSERT INTO mise_delivery_batches(id,driver_id,state,state_version,route_version) VALUES
 ('85000000-0000-0000-0000-000000000022','85000000-0000-0000-0000-000000000002','assigned',1,1);
INSERT INTO mise_push_outbox(driver_id,type,title,body,data,dedupe_key) VALUES
 ('85000000-0000-0000-0000-000000000002','order_assigned','off','off',
  '{"batch_id":"85000000-0000-0000-0000-000000000022"}','test:offline');
SELECT * FROM fn_claim_wake_notifications('85000000-0000-0000-0000-000000000061',50);
DO $$ BEGIN
 IF (SELECT notification_state FROM mise_push_outbox WHERE dedupe_key='test:offline')<>'expired'
   OR (SELECT last_error FROM mise_push_outbox WHERE dedupe_key='test:offline')<>'ASSIGNMENT_SUPERSEDED'
 THEN RAISE EXCEPTION 'T285_OFFLINE_WAKE_NOT_TERMINAL'; END IF;
END $$;

-- A non-retryable provider outcome is terminal after one attempt.
INSERT INTO mise_push_outbox(driver_id,type,title,body,data,dedupe_key)
VALUES('85000000-0000-0000-0000-000000000001','recovery_snapshot_required','x','x','{}','test:terminal');
SELECT * FROM fn_claim_wake_notifications('85000000-0000-0000-0000-000000000062',50);
DO $$
DECLARE nid uuid; r jsonb;
BEGIN
 SELECT id INTO nid FROM mise_push_outbox WHERE dedupe_key='test:terminal';
 r:=fn_finish_wake_notification(nid,'85000000-0000-0000-0000-000000000062',false,NULL,'PUSH_DISABLED',false);
 IF NOT (r->>'ok')::boolean OR (SELECT notification_state FROM mise_push_outbox WHERE id=nid)<>'expired'
   OR (SELECT attempts FROM mise_push_outbox WHERE id=nid)<>1 THEN
  RAISE EXCEPTION 'T285_NONRETRYABLE_NOT_TERMINAL: %',r; END IF;
END $$;

\echo '285 runtime integrity behavior: PASS'
