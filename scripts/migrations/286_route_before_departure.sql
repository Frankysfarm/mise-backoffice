-- T11: a driver may depart only after a Google route for the exact route
-- version has been persisted. Provider work happens between the transactions;
-- every database transition is CAS guarded and idempotent.

ALTER TABLE public.mise_delivery_batches
  ADD COLUMN IF NOT EXISTS polyline text,
  ADD COLUMN IF NOT EXISTS total_distance_km numeric,
  ADD COLUMN IF NOT EXISTS total_eta_min integer;

CREATE TABLE IF NOT EXISTS public.driver_departure_workflows_v2 (
  batch_id uuid PRIMARY KEY REFERENCES public.mise_delivery_batches(id),
  tenant_id uuid NOT NULL,
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id),
  state text NOT NULL CHECK (state IN ('pickup_ready','route_pending','routed','departed')),
  workflow_version bigint NOT NULL DEFAULT 1 CHECK (workflow_version > 0),
  route_version bigint NOT NULL,
  pickup_action_id uuid NOT NULL UNIQUE,
  route_action_id uuid UNIQUE,
  depart_action_id uuid UNIQUE,
  route_fingerprint text,
  route_plan jsonb,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((state IN ('routed','departed')) = (route_plan IS NOT NULL)),
  CHECK ((state IN ('routed','departed')) = (route_fingerprint IS NOT NULL)),
  CHECK ((state='departed') = (depart_action_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.driver_departure_requests_v2 (
  action_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('pickup_ready','persist_google_route','depart')),
  request_fingerprint text NOT NULL,
  result jsonb NOT NULL,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.driver_departure_workflows_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_departure_requests_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_departure_workflows_v2,public.driver_departure_requests_v2
  FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.driver_departure_workflows_v2,public.driver_departure_requests_v2 TO service_role;

CREATE OR REPLACE FUNCTION public.fn_driver_pickup_ready_v2(
  p_tenant_id uuid,p_batch_id uuid,p_expected_batch_version bigint,
  p_expected_route_version bigint,p_expected_driver_version bigint,
  p_actor_driver_id uuid,p_action_id uuid,p_manifest jsonb,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE b public.mise_delivery_batches%ROWTYPE; d public.mise_drivers%ROWTYPE;
 old public.driver_departure_requests_v2%ROWTYPE; fp text; result jsonb; active_count int;
BEGIN
 fp:=md5(concat_ws('|',p_tenant_id,p_batch_id,p_expected_batch_version,
  p_expected_route_version,p_expected_driver_version,p_actor_driver_id,p_manifest::text));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,28601));
 SELECT * INTO old FROM public.driver_departure_requests_v2 WHERE action_id=p_action_id;
 IF FOUND THEN
  IF old.request_fingerprint<>fp OR old.action<>'pickup_ready' THEN RETURN jsonb_build_object(
   'ok',false,'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
  RETURN old.result||jsonb_build_object('idempotent_replay',true);
 END IF;
 SELECT * INTO b FROM public.mise_delivery_batches WHERE id=p_batch_id FOR UPDATE;
 SELECT * INTO d FROM public.mise_drivers WHERE id=p_actor_driver_id FOR UPDATE;
 IF b.id IS NULL OR d.id IS NULL OR b.driver_id IS DISTINCT FROM p_actor_driver_id OR NOT EXISTS(
  SELECT 1 FROM public.mise_driver_tenants WHERE tenant_id=p_tenant_id
   AND driver_id=p_actor_driver_id AND status='active') THEN RETURN jsonb_build_object(
  'ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH'); END IF;
 IF b.state_version<>p_expected_batch_version OR b.route_version<>p_expected_route_version
  OR d.state_version<>p_expected_driver_version THEN RETURN jsonb_build_object(
  'ok',false,'reason_code','EXPECTED_VERSION_CONFLICT'); END IF;
 IF b.state NOT IN ('assigned','at_pickup') OR d.state NOT IN ('assigned','at_pickup')
  THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_STATE_CONFLICT'); END IF;
 IF jsonb_typeof(p_manifest)<>'array' THEN RETURN jsonb_build_object(
  'ok',false,'reason_code','INVALID_PICKUP_MANIFEST'); END IF;
 PERFORM 1 FROM public.dispatch_offer_assignments WHERE batch_id=p_batch_id ORDER BY order_id FOR UPDATE;
 PERFORM 1 FROM public.customer_orders o JOIN public.dispatch_offer_assignments a ON a.order_id=o.id
  WHERE a.batch_id=p_batch_id ORDER BY o.id FOR UPDATE OF o;
 PERFORM 1 FROM public.mise_delivery_batch_stops WHERE batch_id=p_batch_id ORDER BY order_id,id FOR UPDATE;
 SELECT count(*) INTO active_count FROM public.dispatch_offer_assignments a
  JOIN public.customer_orders o ON o.id=a.order_id WHERE a.batch_id=p_batch_id
   AND a.driver_id=p_actor_driver_id AND a.tenant_id=p_tenant_id
   AND a.state='assigned' AND o.status='assigned';
 IF active_count=0 OR jsonb_array_length(p_manifest)<>active_count
  OR (SELECT count(DISTINCT x->>'order_id') FROM jsonb_array_elements(p_manifest)x)<>active_count
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_manifest)x WHERE NOT EXISTS(
   SELECT 1 FROM public.dispatch_offer_assignments a JOIN public.customer_orders o ON o.id=a.order_id
    JOIN public.mise_delivery_batch_stops s ON s.batch_id=a.batch_id AND s.order_id=a.order_id AND s.type='pickup'
   WHERE a.batch_id=p_batch_id AND a.driver_id=p_actor_driver_id AND a.tenant_id=p_tenant_id
    AND a.id=(x->>'assignment_id')::uuid AND a.order_id=(x->>'order_id')::uuid
    AND a.state='assigned' AND o.status='assigned' AND s.id=(x->>'stop_id')::uuid AND s.state='arrived'
    AND a.assignment_version=(x->>'assignment_version')::bigint
    AND o.dispatch_version=(x->>'order_version')::bigint AND s.stop_version=(x->>'stop_version')::bigint))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_manifest)x WHERE jsonb_typeof(x->'items')<>'array'
   OR jsonb_array_length(x->'items')<>(SELECT count(*) FROM public.order_items WHERE order_id=(x->>'order_id')::uuid)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(x->'items')i WHERE i->>'outcome'<>'present_confirmed'
    OR NOT EXISTS(SELECT 1 FROM public.order_items oi WHERE oi.id=(i->>'id')::uuid AND oi.order_id=(x->>'order_id')::uuid)))
 THEN RETURN jsonb_build_object('ok',false,'reason_code','INCOMPLETE_PICKUP_MANIFEST'); END IF;
 UPDATE public.dispatch_offer_assignments SET state='picked_up',assignment_version=assignment_version+1,updated_at=now()
  WHERE batch_id=p_batch_id AND state='assigned';
 UPDATE public.customer_orders o SET status='picked_up',dispatch_version=dispatch_version+1,updated_at=now()
  FROM public.dispatch_offer_assignments a WHERE a.batch_id=p_batch_id AND a.order_id=o.id AND a.state='picked_up';
 UPDATE public.mise_delivery_batch_stops SET state='completed',stop_version=stop_version+1,completed_at=now()
  WHERE batch_id=p_batch_id AND type='pickup' AND state='arrived';
 UPDATE public.mise_delivery_batches SET state='picked_up',state_version=state_version+1,
  picked_up_at=coalesce(picked_up_at,now()),updated_at=now() WHERE id=p_batch_id;
 UPDATE public.mise_drivers SET state='at_pickup',state_version=state_version+1,updated_at=now()
  WHERE id=p_actor_driver_id;
 INSERT INTO public.driver_departure_workflows_v2(batch_id,tenant_id,driver_id,state,workflow_version,
  route_version,pickup_action_id,correlation_id) VALUES(p_batch_id,p_tenant_id,p_actor_driver_id,
  'route_pending',1,p_expected_route_version,p_action_id,p_correlation_id);
 result:=jsonb_build_object('ok',true,'state','route_pending','workflow_version',1,
  'batch_version',p_expected_batch_version+1,'driver_version',p_expected_driver_version+1,
  'route_version',p_expected_route_version,'correlation_id',p_correlation_id);
 INSERT INTO public.driver_departure_requests_v2 VALUES(p_action_id,p_tenant_id,p_actor_driver_id,
  p_batch_id,'pickup_ready',fp,result,p_correlation_id,now());
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.fn_persist_google_departure_route_v2(
 p_tenant_id uuid,p_batch_id uuid,p_driver_id uuid,p_expected_workflow_version bigint,
 p_expected_route_version bigint,p_plan jsonb,p_action_id uuid,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE w public.driver_departure_workflows_v2%ROWTYPE; b public.mise_delivery_batches%ROWTYPE;
 old public.driver_departure_requests_v2%ROWTYPE; fp text; result jsonb; stop_count int;
BEGIN
 fp:=md5(concat_ws('|',p_tenant_id,p_batch_id,p_driver_id,p_expected_workflow_version,
  p_expected_route_version,p_plan::text));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,28601));
 SELECT * INTO old FROM public.driver_departure_requests_v2 WHERE action_id=p_action_id;
 IF FOUND THEN
  IF old.request_fingerprint<>fp OR old.action<>'persist_google_route' THEN RETURN jsonb_build_object(
   'ok',false,'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
  RETURN old.result||jsonb_build_object('idempotent_replay',true);
 END IF;
 SELECT * INTO w FROM public.driver_departure_workflows_v2 WHERE batch_id=p_batch_id FOR UPDATE;
 SELECT * INTO b FROM public.mise_delivery_batches WHERE id=p_batch_id FOR UPDATE;
 IF w.tenant_id<>p_tenant_id OR w.driver_id<>p_driver_id OR b.driver_id<>p_driver_id
  THEN RETURN jsonb_build_object('ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH'); END IF;
 IF w.state<>'route_pending' OR w.workflow_version<>p_expected_workflow_version
  OR w.route_version<>p_expected_route_version OR b.route_version<>p_expected_route_version
  THEN RETURN jsonb_build_object('ok',false,'reason_code','ROUTE_WORKFLOW_VERSION_CONFLICT'); END IF;
 SELECT count(*) INTO stop_count FROM public.mise_delivery_batch_stops
  WHERE batch_id=p_batch_id AND type='dropoff' AND state NOT IN ('completed','cancelled');
 IF p_plan->>'provider'<>'google' OR coalesce((p_plan->>'fallback_used')::boolean,true)
  OR coalesce(p_plan->>'polyline','')='' OR coalesce((p_plan->>'distance_m')::bigint,0)<=0
  OR coalesce((p_plan->>'duration_s')::bigint,0)<=0 OR jsonb_typeof(p_plan->'stops')<>'array'
  OR jsonb_array_length(p_plan->'stops')<>stop_count
  OR (SELECT count(DISTINCT value#>>'{}') FROM jsonb_array_elements(p_plan->'stops'))<>stop_count
  OR EXISTS(SELECT 1 FROM public.mise_delivery_batch_stops s WHERE s.batch_id=p_batch_id
   AND s.type='dropoff' AND s.state NOT IN ('completed','cancelled') AND NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements_text(p_plan->'stops') x WHERE x.value=s.id::text))
 THEN RETURN jsonb_build_object('ok',false,'reason_code','GOOGLE_ROUTE_PLAN_REQUIRED'); END IF;
 UPDATE public.driver_departure_workflows_v2 SET state='routed',workflow_version=workflow_version+1,
  route_action_id=p_action_id,route_fingerprint=fp,route_plan=p_plan,correlation_id=p_correlation_id,
  updated_at=now() WHERE batch_id=p_batch_id;
 IF current_setting('mise.test_route_depart_failpoint',true)='after_route_persist' THEN
  RAISE EXCEPTION 'T11_FAILPOINT_AFTER_ROUTE_PERSIST';
 END IF;
 result:=jsonb_build_object('ok',true,'state','routed','workflow_version',p_expected_workflow_version+1,
  'route_version',p_expected_route_version,'correlation_id',p_correlation_id);
 INSERT INTO public.driver_departure_requests_v2 VALUES(p_action_id,p_tenant_id,p_driver_id,p_batch_id,
  'persist_google_route',fp,result,p_correlation_id,now());
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.fn_driver_depart_routed_v2(
 p_tenant_id uuid,p_batch_id uuid,p_expected_batch_version bigint,p_expected_driver_version bigint,
 p_expected_workflow_version bigint,p_expected_route_version bigint,p_actor_driver_id uuid,
 p_action_id uuid,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE w public.driver_departure_workflows_v2%ROWTYPE; b public.mise_delivery_batches%ROWTYPE;
 d public.mise_drivers%ROWTYPE; old public.driver_departure_requests_v2%ROWTYPE; fp text; result jsonb;
BEGIN
 fp:=md5(concat_ws('|',p_tenant_id,p_batch_id,p_expected_batch_version,p_expected_driver_version,
  p_expected_workflow_version,p_expected_route_version,p_actor_driver_id));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,28601));
 SELECT * INTO old FROM public.driver_departure_requests_v2 WHERE action_id=p_action_id;
 IF FOUND THEN
  IF old.request_fingerprint<>fp OR old.action<>'depart' THEN RETURN jsonb_build_object(
   'ok',false,'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
  RETURN old.result||jsonb_build_object('idempotent_replay',true);
 END IF;
 SELECT * INTO w FROM public.driver_departure_workflows_v2 WHERE batch_id=p_batch_id FOR UPDATE;
 SELECT * INTO b FROM public.mise_delivery_batches WHERE id=p_batch_id FOR UPDATE;
 SELECT * INTO d FROM public.mise_drivers WHERE id=p_actor_driver_id FOR UPDATE;
 IF w.tenant_id<>p_tenant_id OR w.driver_id<>p_actor_driver_id OR b.driver_id<>p_actor_driver_id
  THEN RETURN jsonb_build_object('ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH'); END IF;
 IF w.state<>'routed' OR w.workflow_version<>p_expected_workflow_version
  OR w.route_version<>p_expected_route_version OR b.route_version<>p_expected_route_version
  OR b.state_version<>p_expected_batch_version OR d.state_version<>p_expected_driver_version
  THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_VERSION_CONFLICT'); END IF;
 IF b.state<>'picked_up' OR d.state<>'at_pickup' OR w.route_plan->>'provider'<>'google'
  OR coalesce((w.route_plan->>'fallback_used')::boolean,true) THEN RETURN jsonb_build_object(
  'ok',false,'reason_code','ROUTED_DEPARTURE_REQUIRED'); END IF;
 UPDATE public.dispatch_offer_assignments SET state='in_progress',assignment_version=assignment_version+1,updated_at=now()
  WHERE batch_id=p_batch_id AND state='picked_up';
 UPDATE public.customer_orders o SET status='out_for_delivery',dispatch_version=dispatch_version+1,updated_at=now()
  FROM public.dispatch_offer_assignments a WHERE a.batch_id=p_batch_id AND a.order_id=o.id AND a.state='in_progress';
 UPDATE public.mise_delivery_batches SET state='in_progress',state_version=state_version+1,
  polyline=w.route_plan->>'polyline',total_distance_km=round(((w.route_plan->>'distance_m')::numeric/1000),1),
  total_eta_min=ceil((w.route_plan->>'duration_s')::numeric/60),updated_at=now() WHERE id=p_batch_id;
 UPDATE public.mise_drivers SET state='delivering',state_version=state_version+1,updated_at=now()
  WHERE id=p_actor_driver_id;
 IF current_setting('mise.test_route_depart_failpoint',true)='after_depart_writes' THEN
  RAISE EXCEPTION 'T11_FAILPOINT_AFTER_DEPART_WRITES';
 END IF;
 UPDATE public.driver_departure_workflows_v2 SET state='departed',workflow_version=workflow_version+1,
  depart_action_id=p_action_id,correlation_id=p_correlation_id,updated_at=now() WHERE batch_id=p_batch_id;
 result:=jsonb_build_object('ok',true,'state','departed','workflow_version',p_expected_workflow_version+1,
  'batch_version',p_expected_batch_version+1,'driver_version',p_expected_driver_version+1,
  'route_version',p_expected_route_version,'correlation_id',p_correlation_id);
 INSERT INTO public.driver_departure_requests_v2 VALUES(p_action_id,p_tenant_id,p_actor_driver_id,p_batch_id,
  'depart',fp,result,p_correlation_id,now());
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.fn_driver_pickup_ready_v2(uuid,uuid,bigint,bigint,bigint,uuid,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_persist_google_departure_route_v2(uuid,uuid,uuid,bigint,bigint,jsonb,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_driver_depart_routed_v2(uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_driver_pickup_ready_v2(uuid,uuid,bigint,bigint,bigint,uuid,uuid,jsonb,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_persist_google_departure_route_v2(uuid,uuid,uuid,bigint,bigint,jsonb,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_driver_depart_routed_v2(uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,uuid) TO service_role;
