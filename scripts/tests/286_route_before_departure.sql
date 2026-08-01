\set ON_ERROR_STOP on
INSERT INTO tenants VALUES('61000000-0000-0000-0000-000000000001','T11','t11');
INSERT INTO locations VALUES('62000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','kitchen');
INSERT INTO mise_drivers(id,name,active,state,state_version,current_capacity,max_capacity) VALUES
 ('63000000-0000-0000-0000-000000000001','route-first',true,'at_pickup',4,1,3);
INSERT INTO mise_driver_tenants VALUES
 ('63000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','active');
INSERT INTO mise_delivery_batches(id,driver_id,state,location_id,state_version,route_version) VALUES
 ('65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','at_pickup','62000000-0000-0000-0000-000000000001',5,7);
INSERT INTO customer_orders(id,location_id,tenant_id,typ,status,dispatch_version,mise_batch_id,mise_driver_id) VALUES
 ('66000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','lieferung','assigned',8,'65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001');
INSERT INTO mise_delivery_batch_stops(id,batch_id,order_id,type,sequence,state,stop_version,lat,lng) VALUES
 ('67000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','66000000-0000-0000-0000-000000000001','pickup',0,'arrived',2,52.5,13.4),
 ('67000000-0000-0000-0000-000000000002','65000000-0000-0000-0000-000000000001','66000000-0000-0000-0000-000000000001','dropoff',1,'pending',0,52.51,13.41);
INSERT INTO order_items(id,order_id,name) VALUES
 ('68000000-0000-0000-0000-000000000001','66000000-0000-0000-0000-000000000001','A');
INSERT INTO dispatch_offer_assignments(id,tenant_id,order_id,batch_id,driver_id,state,decision_id,
 idempotency_key,request_fingerprint,expected_order_version,assignment_version,algorithm_version) VALUES
 ('69000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','66000000-0000-0000-0000-000000000001',
 '65000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','assigned',gen_random_uuid(),gen_random_uuid(),'t11',8,3,'t11');

DO $test$
DECLARE r jsonb; manifest jsonb; plan jsonb;
BEGIN
 manifest:=jsonb_build_array(jsonb_build_object(
  'order_id','66000000-0000-0000-0000-000000000001','order_version',8,
  'assignment_id','69000000-0000-0000-0000-000000000001','assignment_version',3,
  'stop_id','67000000-0000-0000-0000-000000000001','stop_version',2,
  'items',jsonb_build_array(jsonb_build_object('id','68000000-0000-0000-0000-000000000001','outcome','present_confirmed'))));
 r:=fn_driver_pickup_ready_v2('61000000-0000-0000-0000-000000000001',
  '65000000-0000-0000-0000-000000000001',5,7,4,'63000000-0000-0000-0000-000000000001',
  '6a000000-0000-4000-8000-000000000001',manifest,'6b000000-0000-4000-8000-000000000001');
 IF r->>'state'<>'route_pending' OR (SELECT state FROM mise_delivery_batches WHERE id='65000000-0000-0000-0000-000000000001')<>'picked_up'
  OR (SELECT state FROM mise_drivers WHERE id='63000000-0000-0000-0000-000000000001')<>'at_pickup'
 THEN RAISE EXCEPTION 'pickup departed prematurely:%',r; END IF;
 r:=fn_driver_depart_routed_v2('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',
  6,5,1,7,'63000000-0000-0000-0000-000000000001','6a000000-0000-4000-8000-000000000002',
  '6b000000-0000-4000-8000-000000000002');
 IF r->>'reason_code'<>'EXPECTED_VERSION_CONFLICT' THEN RAISE EXCEPTION 'depart without route accepted:%',r; END IF;
 plan:=jsonb_build_object('provider','google','fallback_used',true,'polyline','bad','distance_m',1000,
  'duration_s',300,'stops',jsonb_build_array('67000000-0000-0000-0000-000000000002'));
 r:=fn_persist_google_departure_route_v2('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000001',1,7,plan,'6a000000-0000-4000-8000-000000000003','6b000000-0000-4000-8000-000000000003');
 IF r->>'reason_code'<>'GOOGLE_ROUTE_PLAN_REQUIRED' THEN RAISE EXCEPTION 'fallback route accepted:%',r; END IF;
 plan:=jsonb_set(plan,'{fallback_used}','false');
 PERFORM set_config('mise.test_route_depart_failpoint','after_route_persist',true);
 BEGIN
  PERFORM fn_persist_google_departure_route_v2('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',
   '63000000-0000-0000-0000-000000000001',1,7,plan,'6a000000-0000-4000-8000-000000000009','6b000000-0000-4000-8000-000000000009');
  RAISE EXCEPTION 'route failpoint did not fire';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'T11_FAILPOINT_AFTER_ROUTE_PERSIST' THEN RAISE; END IF; END;
 PERFORM set_config('mise.test_route_depart_failpoint','',true);
 IF (SELECT state FROM driver_departure_workflows_v2 WHERE batch_id='65000000-0000-0000-0000-000000000001')<>'route_pending'
  OR EXISTS(SELECT 1 FROM driver_departure_requests_v2 WHERE action_id='6a000000-0000-4000-8000-000000000009')
 THEN RAISE EXCEPTION 'route crash left partial state'; END IF;
 r:=fn_persist_google_departure_route_v2('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',
  '63000000-0000-0000-0000-000000000001',1,7,plan,'6a000000-0000-4000-8000-000000000004','6b000000-0000-4000-8000-000000000004');
 IF r->>'state'<>'routed' THEN RAISE EXCEPTION 'google route rejected:%',r; END IF;
 PERFORM set_config('mise.test_route_depart_failpoint','after_depart_writes',true);
 BEGIN
  PERFORM fn_driver_depart_routed_v2('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',
   6,5,2,7,'63000000-0000-0000-0000-000000000001','6a000000-0000-4000-8000-000000000008','6b000000-0000-4000-8000-000000000008');
  RAISE EXCEPTION 'depart failpoint did not fire';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'T11_FAILPOINT_AFTER_DEPART_WRITES' THEN RAISE; END IF; END;
 PERFORM set_config('mise.test_route_depart_failpoint','',true);
 IF (SELECT state FROM mise_delivery_batches WHERE id='65000000-0000-0000-0000-000000000001')<>'picked_up'
  OR (SELECT state FROM mise_drivers WHERE id='63000000-0000-0000-0000-000000000001')<>'at_pickup'
  OR (SELECT state FROM driver_departure_workflows_v2 WHERE batch_id='65000000-0000-0000-0000-000000000001')<>'routed'
 THEN RAISE EXCEPTION 'depart crash left partial state'; END IF;
 r:=fn_driver_depart_routed_v2('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',
  6,5,2,7,'63000000-0000-0000-0000-000000000001','6a000000-0000-4000-8000-000000000005',
  '6b000000-0000-4000-8000-000000000005');
 IF r->>'state'<>'departed' OR (SELECT state FROM mise_delivery_batches WHERE id='65000000-0000-0000-0000-000000000001')<>'in_progress'
  OR (SELECT state FROM mise_drivers WHERE id='63000000-0000-0000-0000-000000000001')<>'delivering'
 THEN RAISE EXCEPTION 'routed departure failed:%',r; END IF;
 r:=fn_driver_depart_routed_v2('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001',
  6,5,2,7,'63000000-0000-0000-0000-000000000001','6a000000-0000-4000-8000-000000000005',
  '6b000000-0000-4000-8000-000000000099');
 IF r->>'idempotent_replay'<>'true' THEN RAISE EXCEPTION 'depart replay failed:%',r; END IF;
END $test$;
\echo 'T11 route-before-depart behavior: PASS'
