-- T12: order-scoped cancellation for multi-order trips and strict stop arrival.

CREATE OR REPLACE FUNCTION public.fn_dispatch_cancel_order_v3(
 p_tenant_id uuid,p_order_id uuid,p_expected_order_version bigint,
 p_expected_assignment_version bigint,p_expected_batch_version bigint,
 p_expected_route_version bigint,p_expected_driver_version bigint,
 p_actor_id uuid,p_action_id uuid,p_reason_code text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o public.customer_orders%ROWTYPE; a public.dispatch_offer_assignments%ROWTYPE;
 b public.mise_delivery_batches%ROWTYPE; d public.mise_drivers%ROWTYPE;
 old public.dispatch_assignment_requests_v2%ROWTYPE; fp text; result jsonb; remaining int;
BEGIN
 fp:=md5(concat_ws('|',p_tenant_id,p_order_id,p_expected_order_version,
  p_expected_assignment_version,p_expected_batch_version,p_expected_route_version,
  p_expected_driver_version,p_actor_id,p_reason_code));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,28701));
 SELECT * INTO old FROM public.dispatch_assignment_requests_v2 WHERE action_id=p_action_id;
 IF FOUND THEN
  IF old.request_fingerprint<>fp OR old.action<>'cancel_order_v3' THEN RETURN jsonb_build_object(
   'ok',false,'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
  RETURN old.result||jsonb_build_object('idempotent_replay',true);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,27601));
 SELECT * INTO o FROM public.customer_orders WHERE id=p_order_id FOR UPDATE;
 SELECT * INTO a FROM public.dispatch_offer_assignments WHERE order_id=p_order_id
  AND state IN ('assigned','picked_up','in_progress') FOR UPDATE;
 SELECT * INTO b FROM public.mise_delivery_batches WHERE id=a.batch_id FOR UPDATE;
 SELECT * INTO d FROM public.mise_drivers WHERE id=a.driver_id FOR UPDATE;
 PERFORM 1 FROM public.mise_delivery_batch_stops WHERE batch_id=a.batch_id ORDER BY id FOR UPDATE;
 IF o.id IS NULL OR a.id IS NULL OR b.id IS NULL OR d.id IS NULL OR a.tenant_id<>p_tenant_id
  THEN RETURN jsonb_build_object('ok',false,'reason_code','ORDER_ASSIGNMENT_NOT_FOUND'); END IF;
 IF o.dispatch_version<>p_expected_order_version OR a.assignment_version<>p_expected_assignment_version
  OR b.state_version<>p_expected_batch_version OR b.route_version<>p_expected_route_version
  OR d.state_version<>p_expected_driver_version THEN RETURN jsonb_build_object(
  'ok',false,'reason_code','EXPECTED_VERSION_CONFLICT'); END IF;
 UPDATE public.dispatch_offer_assignments SET state='cancelled',assignment_version=assignment_version+1,
  updated_at=now() WHERE id=a.id;
 UPDATE public.mise_delivery_batch_stops SET state='cancelled',stop_version=stop_version+1,
  completed_at=NULL WHERE batch_id=b.id AND order_id=p_order_id AND state NOT IN ('completed','cancelled');
 IF current_setting('mise.test_multi_order_failpoint',true)='after_cancel_stops' THEN
  RAISE EXCEPTION 'T12_FAILPOINT_AFTER_CANCEL_STOPS';
 END IF;
 UPDATE public.customer_orders SET status='cancelled',mise_batch_id=NULL,mise_driver_id=NULL,
  dispatch_version=dispatch_version+1,updated_at=now() WHERE id=p_order_id;
 SELECT count(*) INTO remaining FROM public.dispatch_offer_assignments
  WHERE batch_id=b.id AND state IN ('assigned','picked_up','in_progress');
 UPDATE public.mise_drivers SET current_capacity=greatest(0,current_capacity-1),
  state=CASE WHEN remaining=0 THEN 'returning' ELSE state END,
  state_version=state_version+1,updated_at=now() WHERE id=d.id;
 UPDATE public.mise_delivery_batches SET
  state=CASE WHEN remaining=0 THEN 'cancelled' ELSE state END,
  cancelled_at=CASE WHEN remaining=0 THEN now() ELSE cancelled_at END,
  state_version=state_version+1,route_version=route_version+1,polyline=NULL,
  total_distance_km=NULL,total_eta_min=NULL,updated_at=now() WHERE id=b.id;
 UPDATE public.driver_departure_workflows_v2 SET state='route_pending',
  workflow_version=workflow_version+1,route_version=route_version+1,route_action_id=NULL,
  depart_action_id=NULL,route_fingerprint=NULL,route_plan=NULL,updated_at=now()
  WHERE batch_id=b.id AND remaining>0 AND state IN ('route_pending','routed','departed');
 result:=jsonb_build_object('ok',true,'state',CASE WHEN remaining=0 THEN 'trip_cancelled' ELSE 'route_pending' END,
  'remaining_orders',remaining,'order_version',p_expected_order_version+1,
  'assignment_version',p_expected_assignment_version+1,'batch_version',p_expected_batch_version+1,
  'route_version',p_expected_route_version+1,'driver_version',p_expected_driver_version+1);
 INSERT INTO public.dispatch_assignment_requests_v2(action_id,tenant_id,request_fingerprint,action,
  correlation_id,result) VALUES(p_action_id,p_tenant_id,fp,'cancel_order_v3',gen_random_uuid(),result);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.fn_driver_arrive_v2(
  p_tenant_id uuid,p_stop_id uuid,p_expected_stop_version bigint,
  p_expected_batch_version bigint,p_expected_route_version bigint,p_expected_driver_version bigint,
  p_actor_driver_id uuid,p_action_id uuid,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s public.mise_delivery_batch_stops%ROWTYPE; b public.mise_delivery_batches%ROWTYPE;
 d public.mise_drivers%ROWTYPE; first_id uuid; old public.driver_action_requests_v2%ROWTYPE;
 fp text; result jsonb;
BEGIN
 fp:=md5(concat_ws('|',p_tenant_id,p_stop_id,p_expected_stop_version,p_expected_batch_version,
  p_expected_route_version,p_expected_driver_version,p_actor_driver_id));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,28702));
 SELECT * INTO old FROM public.driver_action_requests_v2 WHERE action_id=p_action_id;
 IF FOUND THEN
  IF old.tenant_id<>p_tenant_id OR old.driver_id<>p_actor_driver_id OR old.action<>'arrive'
   OR old.target_id IS DISTINCT FROM p_stop_id OR old.request_fingerprint<>fp THEN
   RETURN jsonb_build_object('ok',false,'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
  RETURN old.result||jsonb_build_object('idempotent_replay',true);
 END IF;
 SELECT * INTO s FROM public.mise_delivery_batch_stops WHERE id=p_stop_id FOR UPDATE;
 SELECT * INTO b FROM public.mise_delivery_batches WHERE id=s.batch_id FOR UPDATE;
 SELECT * INTO d FROM public.mise_drivers WHERE id=p_actor_driver_id FOR UPDATE;
 PERFORM 1 FROM public.mise_delivery_batch_stops WHERE batch_id=b.id ORDER BY sequence,id FOR UPDATE;
 IF s.id IS NULL OR b.driver_id IS DISTINCT FROM p_actor_driver_id OR NOT EXISTS(SELECT 1
  FROM public.mise_driver_tenants WHERE tenant_id=p_tenant_id AND driver_id=p_actor_driver_id AND status='active')
  THEN RETURN jsonb_build_object('ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH'); END IF;
 IF s.stop_version<>p_expected_stop_version OR b.state_version<>p_expected_batch_version
  OR b.route_version<>p_expected_route_version OR d.state_version<>p_expected_driver_version
  THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_VERSION_CONFLICT'); END IF;
 SELECT id INTO first_id FROM public.mise_delivery_batch_stops WHERE batch_id=b.id
  AND state NOT IN ('completed','cancelled') ORDER BY sequence,id LIMIT 1;
 IF s.state<>'pending' OR s.id IS DISTINCT FROM first_id THEN RETURN jsonb_build_object(
  'ok',false,'reason_code','STOP_NOT_NEXT_IN_ROUTE'); END IF;
 IF s.type='pickup' AND (b.state NOT IN ('assigned','at_pickup') OR d.state NOT IN ('assigned','at_pickup'))
  THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_STATE_CONFLICT'); END IF;
 IF s.type='dropoff' AND (b.state<>'in_progress' OR d.state<>'delivering' OR EXISTS(
  SELECT 1 FROM public.mise_delivery_batch_stops p WHERE p.batch_id=b.id AND p.order_id=s.order_id
   AND p.type='pickup' AND p.state<>'completed')) THEN RETURN jsonb_build_object(
  'ok',false,'reason_code','PICKUP_REQUIRED_BEFORE_DROPOFF'); END IF;
 UPDATE public.mise_delivery_batch_stops SET state='arrived',stop_version=stop_version+1,
  arrived_at=coalesce(arrived_at,now()) WHERE id=s.id AND state='pending' AND stop_version=p_expected_stop_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'ARRIVAL_STOP_CAS_CONFLICT'; END IF;
 result:=jsonb_build_object('ok',true,'stop_version',p_expected_stop_version+1,
  'batch_version',p_expected_batch_version,'route_version',p_expected_route_version,
  'driver_version',p_expected_driver_version,'correlation_id',p_correlation_id);
 INSERT INTO public.driver_action_requests_v2(action_id,tenant_id,driver_id,action,target_id,
  request_fingerprint,correlation_id,result) VALUES(p_action_id,p_tenant_id,p_actor_driver_id,
  'arrive',p_stop_id,fp,p_correlation_id,result);
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.fn_dispatch_cancel_order_v3(uuid,uuid,bigint,bigint,bigint,bigint,bigint,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_dispatch_cancel_order_v3(uuid,uuid,bigint,bigint,bigint,bigint,bigint,uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.fn_driver_arrive_v2(uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_driver_arrive_v2(uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,uuid) TO service_role;
