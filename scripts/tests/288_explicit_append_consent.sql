\set ON_ERROR_STOP on
INSERT INTO tenants VALUES('81000000-0000-0000-0000-000000000001','T13','t13');
INSERT INTO locations VALUES('82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','kitchen');
INSERT INTO mise_drivers(id,name,active,state,state_version,current_capacity,max_capacity) VALUES
 ('83000000-0000-0000-0000-000000000001','consent',true,'delivering',8,1,4);
INSERT INTO mise_delivery_batches(id,driver_id,state,location_id,state_version,route_version) VALUES
 ('85000000-0000-0000-0000-000000000001','83000000-0000-0000-0000-000000000001','in_progress','82000000-0000-0000-0000-000000000001',6,9);
INSERT INTO customer_orders(id,location_id,tenant_id,typ,status,dispatch_version) VALUES
 ('86000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','lieferung','ready',4),
 ('86000000-0000-0000-0000-000000000002','82000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','lieferung','ready',4);
INSERT INTO dispatch_append_consent_config_v2(tenant_id,enabled,max_offer_seconds) VALUES
 ('81000000-0000-0000-0000-000000000001',true,300);

DO $test$
DECLARE r jsonb; payload jsonb:='{"writer_id":"88000000-0000-4000-8000-000000000001","writer_epoch":1,
 "pickup_stop_id":"87000000-0000-0000-0000-000000000001","dropoff_stop_id":"87000000-0000-0000-0000-000000000002",
 "pickup_lat":52.5,"pickup_lng":13.4,"dropoff_lat":52.51,"dropoff_lng":13.41,
 "pickup_address":"A","dropoff_address":"B","pickup_deadline_at":"2030-01-01T10:00:00Z",
 "delivery_deadline_at":"2030-01-01T11:00:00Z","route_stops":[],"arrivals":{},
 "explanation":{},"matrix_fallback_used":false}';
BEGIN
 r:=fn_create_append_proposal_v2('81000000-0000-0000-0000-000000000001','89000000-0000-0000-0000-000000000001',
  '83000000-0000-0000-0000-000000000001','85000000-0000-0000-0000-000000000001','86000000-0000-0000-0000-000000000001',
  8,6,9,4,payload,clock_timestamp()+interval '2 minutes','8a000000-0000-4000-8000-000000000001','8b000000-0000-4000-8000-000000000001');
 IF r->>'state'<>'proposed_append' THEN RAISE EXCEPTION 'proposal failed:%',r; END IF;
 r:=fn_execute_accepted_append_proposal_v2('89000000-0000-0000-0000-000000000001',1,
  '8a000000-0000-4000-8000-000000000002','8b000000-0000-4000-8000-000000000002');
 IF r->>'reason_code'<>'ACCEPTED_PROPOSAL_REQUIRED' THEN RAISE EXCEPTION 'append bypassed consent:%',r; END IF;
 r:=fn_transition_append_proposal_v2('89000000-0000-0000-0000-000000000001',1,'accept',
  '83000000-0000-0000-0000-000000000001','8a000000-0000-4000-8000-000000000003');
 IF r->>'state'<>'accepted' THEN RAISE EXCEPTION 'consent failed:%',r; END IF;
 PERFORM set_config('mise.test_append_consent_failpoint','after_append',true);
 BEGIN
  PERFORM fn_execute_accepted_append_proposal_v2('89000000-0000-0000-0000-000000000001',2,
   '8a000000-0000-4000-8000-000000000004','8b000000-0000-4000-8000-000000000004');
  RAISE EXCEPTION 'append failpoint missing';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'T13_FAILPOINT_AFTER_APPEND' THEN RAISE; END IF; END;
 PERFORM set_config('mise.test_append_consent_failpoint','',true);
 IF (SELECT state FROM dispatch_append_proposals_v2 WHERE id='89000000-0000-0000-0000-000000000001')<>'accepted'
  OR EXISTS(SELECT 1 FROM dispatch_append_proposal_requests_v2 WHERE action_id='8a000000-0000-4000-8000-000000000004')
 THEN RAISE EXCEPTION 'append crash consumed consent'; END IF;
 r:=fn_execute_accepted_append_proposal_v2('89000000-0000-0000-0000-000000000001',2,
  '8a000000-0000-4000-8000-000000000005','8b000000-0000-4000-8000-000000000005');
 IF r->>'proposal_state'<>'atomic_append' OR r->>'stub_atomic'<>'true' THEN RAISE EXCEPTION 'atomic handoff failed:%',r; END IF;
 r:=fn_execute_accepted_append_proposal_v2('89000000-0000-0000-0000-000000000001',2,
  '8a000000-0000-4000-8000-000000000005','8b000000-0000-4000-8000-000000000099');
 IF r->>'idempotent_replay'<>'true' THEN RAISE EXCEPTION 'append replay failed:%',r; END IF;
END $test$;
\echo 'T13 explicit append consent: PASS'
