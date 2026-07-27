-- T03: authenticated driver-v2 server boundary. Additive and default-off.
-- Service-role API calls are the only intended writer. GPS persistence remains T06.

ALTER TABLE public.mise_delivery_batch_stops
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz;

CREATE TABLE IF NOT EXISTS public.driver_action_requests_v2 (
  action_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id),
  action text NOT NULL,
  target_id uuid,
  request_fingerprint text NOT NULL,
  correlation_id uuid NOT NULL,
  result jsonb NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_action_requests_v2
  ADD COLUMN IF NOT EXISTS completed_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.driver_item_outcomes_v2 (
  order_id uuid NOT NULL REFERENCES public.customer_orders(id),
  item_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id),
  outcome text NOT NULL CHECK (outcome IN ('picked','missing')),
  action_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(order_id,item_id)
);

CREATE TABLE IF NOT EXISTS public.driver_exceptions_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id),
  kind text NOT NULL CHECK (kind IN (
    'medical_safety_emergency','vehicle_failure','accident_road_closure',
    'location_permission_gps_failure','network_device_failure','shift_invalid',
    'dispatcher_authorized_break'
  )),
  state text NOT NULL DEFAULT 'reported' CHECK (state IN (
    'reported','triaged','mitigating','reassignment_required','resolved','closed'
  )),
  exception_version bigint NOT NULL DEFAULT 1 CHECK (exception_version > 0),
  note text,
  action_id uuid NOT NULL UNIQUE,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_item_resolutions_v2 (
  action_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id),
  order_id uuid NOT NULL REFERENCES public.customer_orders(id),
  stop_id uuid NOT NULL REFERENCES public.mise_delivery_batch_stops(id),
  request_fingerprint text NOT NULL,
  result jsonb NOT NULL,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_api_compatibility_events_v2 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  driver_id uuid REFERENCES public.mise_drivers(id),
  api_version text NOT NULL,
  action text NOT NULL,
  outcome text NOT NULL,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The global action registry is authoritative. Specialized projections may retain
-- action-specific columns, but can never exist without the corresponding action.
ALTER TABLE public.driver_item_resolutions_v2
  DROP CONSTRAINT IF EXISTS driver_item_resolutions_v2_action_registry_fkey,
  ADD CONSTRAINT driver_item_resolutions_v2_action_registry_fkey
    FOREIGN KEY(action_id) REFERENCES public.driver_action_requests_v2(action_id)
    DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.driver_item_outcomes_v2
  DROP CONSTRAINT IF EXISTS driver_item_outcomes_v2_action_registry_fkey,
  ADD CONSTRAINT driver_item_outcomes_v2_action_registry_fkey
    FOREIGN KEY(action_id) REFERENCES public.driver_action_requests_v2(action_id)
    DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.driver_exceptions_v2
  DROP CONSTRAINT IF EXISTS driver_exceptions_v2_action_registry_fkey,
  ADD CONSTRAINT driver_exceptions_v2_action_registry_fkey
    FOREIGN KEY(action_id) REFERENCES public.driver_action_requests_v2(action_id)
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.driver_exceptions_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_item_resolutions_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_api_compatibility_events_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_action_requests_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_item_outcomes_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_exceptions_v2, public.driver_item_resolutions_v2,
  public.driver_api_compatibility_events_v2, public.driver_action_requests_v2,
  public.driver_item_outcomes_v2 FROM PUBLIC, anon, authenticated;

-- Defense in depth for browser/PostgREST roles. Server service_role is unaffected.
REVOKE UPDATE (status, dispatch_version, mise_batch_id, mise_driver_id, geliefert_am)
  ON public.customer_orders FROM anon, authenticated;
REVOKE UPDATE (state, state_version, current_capacity)
  ON public.mise_drivers FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.dispatch_offer_assignments
  FROM anon, authenticated;
REVOKE UPDATE (state, state_version, route_version)
  ON public.mise_delivery_batches FROM anon, authenticated;
REVOKE UPDATE (state, stop_version, completed_at)
  ON public.mise_delivery_batch_stops FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.customer_orders, public.mise_drivers,
  public.mise_delivery_batches, public.mise_delivery_batch_stops,
  public.dispatch_offer_assignments, public.dispatch_assignment_requests_v2,
  public.dispatch_offer_audit FROM anon, authenticated;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mise_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mise_delivery_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mise_delivery_batch_stops ENABLE ROW LEVEL SECURITY;
DO $policies$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customer_orders','mise_drivers','mise_delivery_batches','mise_delivery_batch_stops']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS driver_v2_service_only ON public.%I',t);
    EXECUTE format('CREATE POLICY driver_v2_service_only ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',t);
  END LOOP;
END $policies$;
DO $direct_write_denial$
BEGIN
  IF to_regclass('public.order_items') IS NOT NULL THEN
    EXECUTE 'REVOKE UPDATE ON public.order_items FROM anon, authenticated';
  END IF;
  IF to_regclass('public.driver_status') IS NOT NULL THEN
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.driver_status FROM anon, authenticated';
  END IF;
END $direct_write_denial$;

CREATE OR REPLACE FUNCTION public.fn_driver_session_v2(
  p_tenant_id uuid, p_actor_driver_id uuid, p_action_id uuid,
  p_expected_driver_version bigint, p_online boolean,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE v public.mise_drivers%ROWTYPE; corr uuid:=p_correlation_id; target text;
  fp text:=md5(pg_catalog.concat_ws('|',p_tenant_id,p_actor_driver_id,p_expected_driver_version,p_online));
  old public.driver_action_requests_v2%ROWTYPE; result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,27801));
  SELECT * INTO old FROM public.driver_action_requests_v2 WHERE action_id=p_action_id;
  IF FOUND THEN
    IF old.tenant_id<>p_tenant_id OR old.driver_id<>p_actor_driver_id
      OR old.action<>'session' OR old.target_id IS DISTINCT FROM p_actor_driver_id
      OR old.request_fingerprint<>fp THEN RETURN jsonb_build_object('ok',false,
      'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
    RETURN old.result||jsonb_build_object('idempotent_replay',true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.mise_driver_tenants
    WHERE tenant_id=p_tenant_id AND driver_id=p_actor_driver_id AND status='active')
  THEN RETURN jsonb_build_object('ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH'); END IF;
  SELECT * INTO v FROM public.mise_drivers WHERE id=p_actor_driver_id FOR UPDATE;
  IF v.state_version<>p_expected_driver_version THEN RETURN jsonb_build_object(
    'ok',false,'reason_code','EXPECTED_VERSION_CONFLICT'); END IF;
  IF NOT p_online AND v.state NOT IN ('offline','available','returning') THEN RETURN jsonb_build_object(
    'ok',false,'reason_code','ACTIVE_WORK_PREVENTS_SHIFT_END'); END IF;
  target:=CASE WHEN p_online THEN 'available' ELSE 'offline' END;
  IF v.state=target THEN
    result:=jsonb_build_object('ok',true,'state',target,'driver_version',v.state_version,'correlation_id',corr);
    INSERT INTO public.driver_action_requests_v2 VALUES(
      p_action_id,p_tenant_id,p_actor_driver_id,'session',p_actor_driver_id,fp,corr,result,now());
    RETURN result;
  END IF;
  UPDATE public.mise_drivers SET state=target,state_version=state_version+1,
    active=p_online,updated_at=now() WHERE id=p_actor_driver_id AND state_version=p_expected_driver_version;
  INSERT INTO public.driver_api_compatibility_events_v2(driver_id,api_version,action,outcome,correlation_id)
    VALUES(p_actor_driver_id,'driver-v2',CASE WHEN p_online THEN 'start_shift' ELSE 'end_shift' END,'ok',corr);
  result:=jsonb_build_object('ok',true,'state',target,'driver_version',
    p_expected_driver_version+1,'correlation_id',corr);
  INSERT INTO public.driver_action_requests_v2 VALUES(
    p_action_id,p_tenant_id,p_actor_driver_id,'session',p_actor_driver_id,fp,corr,result,now());
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.fn_driver_arrive_v2(
  p_tenant_id uuid,p_stop_id uuid,p_expected_stop_version bigint,
  p_expected_batch_version bigint,p_expected_route_version bigint,p_expected_driver_version bigint,
  p_actor_driver_id uuid,p_action_id uuid,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE s public.mise_delivery_batch_stops%ROWTYPE; b public.mise_delivery_batches%ROWTYPE;
  d public.mise_drivers%ROWTYPE; corr uuid:=p_correlation_id; result jsonb;
  fp text:=md5(pg_catalog.concat_ws('|',p_tenant_id,p_stop_id,p_expected_stop_version,
    p_expected_batch_version,p_expected_route_version,p_expected_driver_version,p_actor_driver_id));
  old public.driver_action_requests_v2%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,27801));
  SELECT * INTO old FROM public.driver_action_requests_v2 WHERE action_id=p_action_id;
  IF FOUND THEN
    IF old.tenant_id<>p_tenant_id OR old.driver_id<>p_actor_driver_id
      OR old.action<>'arrive' OR old.target_id IS DISTINCT FROM p_stop_id
      OR old.request_fingerprint<>fp THEN RETURN jsonb_build_object('ok',false,
      'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
    RETURN old.result||jsonb_build_object('idempotent_replay',true);
  END IF;
  SELECT * INTO s FROM public.mise_delivery_batch_stops WHERE id=p_stop_id FOR UPDATE;
  SELECT * INTO b FROM public.mise_delivery_batches WHERE id=s.batch_id FOR UPDATE;
  SELECT * INTO d FROM public.mise_drivers WHERE id=p_actor_driver_id FOR UPDATE;
  IF b.driver_id IS DISTINCT FROM p_actor_driver_id OR NOT EXISTS(SELECT 1
    FROM public.mise_driver_tenants WHERE tenant_id=p_tenant_id AND driver_id=p_actor_driver_id AND status='active')
    OR NOT EXISTS(SELECT 1 FROM public.customer_orders o
      JOIN public.locations l ON l.id=o.location_id
      WHERE o.id=s.order_id AND l.tenant_id=p_tenant_id)
  THEN RETURN jsonb_build_object('ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH'); END IF;
  IF s.stop_version<>p_expected_stop_version OR b.state_version<>p_expected_batch_version
    OR b.route_version<>p_expected_route_version
    OR d.state_version<>p_expected_driver_version THEN RETURN jsonb_build_object(
      'ok',false,'reason_code','EXPECTED_VERSION_CONFLICT'); END IF;
  IF s.state<>'pending' THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_STATE_CONFLICT'); END IF;
  UPDATE public.mise_delivery_batch_stops SET state='arrived',
    stop_version=stop_version+1,arrived_at=coalesce(arrived_at,now())
    WHERE id=s.id AND state='pending' AND stop_version=p_expected_stop_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'ARRIVAL_STOP_CAS_CONFLICT'; END IF;
  INSERT INTO public.dispatch_offer_audit(decision_id,idempotency_key,order_id,batch_id,driver_id,
    outcome,reason_code,expected_order_version,algorithm_version,details,correlation_id,event_type)
    VALUES(gen_random_uuid(),p_action_id,s.order_id,b.id,d.id,'assigned','STOP_ARRIVED',0,
      'driver-v2','{}',corr,'stop.arrived');
  result:=jsonb_build_object('ok',true,'stop_version',p_expected_stop_version+1,
    'batch_version',p_expected_batch_version,'driver_version',p_expected_driver_version,
    'correlation_id',corr);
  INSERT INTO public.driver_action_requests_v2 VALUES(
    p_action_id,p_tenant_id,p_actor_driver_id,'arrive',p_stop_id,fp,corr,result,now());
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.fn_driver_resolve_items_v2(
  p_tenant_id uuid,p_order_id uuid,p_expected_order_version bigint,
  p_expected_assignment_version bigint,p_expected_batch_version bigint,
  p_expected_driver_version bigint,p_actor_driver_id uuid,p_action_id uuid,
  p_items jsonb,p_expected_stop_version bigint,p_expected_route_version bigint,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE fp text:=md5(pg_catalog.concat_ws('|',p_tenant_id,p_actor_driver_id,p_order_id,
  p_expected_order_version,p_expected_assignment_version,p_expected_batch_version,
  p_expected_driver_version,p_expected_stop_version,p_expected_route_version,p_items::text));
  old public.driver_action_requests_v2%ROWTYPE;
  st public.mise_delivery_batch_stops%ROWTYPE; corr uuid:=p_correlation_id; result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,27801));
  SELECT * INTO old FROM public.driver_action_requests_v2 WHERE action_id=p_action_id;
  IF FOUND THEN
    IF old.tenant_id<>p_tenant_id OR old.driver_id<>p_actor_driver_id
      OR old.action<>'resolve_items' OR old.target_id IS DISTINCT FROM p_order_id
      OR old.request_fingerprint<>fp THEN RETURN jsonb_build_object('ok',false,
      'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
    RETURN old.result||jsonb_build_object('idempotent_replay',true);
  END IF;
  SELECT * INTO st FROM public.mise_delivery_batch_stops WHERE order_id=p_order_id
    AND type='pickup' FOR UPDATE;
  IF st.stop_version<>p_expected_stop_version OR NOT EXISTS(SELECT 1
    FROM public.dispatch_offer_assignments a JOIN public.mise_delivery_batches b ON b.id=a.batch_id
    WHERE a.order_id=p_order_id AND a.driver_id=p_actor_driver_id AND a.tenant_id=p_tenant_id
      AND a.assignment_version=p_expected_assignment_version AND b.state_version=p_expected_batch_version
      AND b.route_version=p_expected_route_version)
    OR NOT EXISTS(SELECT 1 FROM public.customer_orders WHERE id=p_order_id AND dispatch_version=p_expected_order_version)
  THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_VERSION_OR_AUTHORITY_CONFLICT'); END IF;
  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 THEN RETURN jsonb_build_object(
    'ok',false,'reason_code','ITEM_RESOLUTION_REQUIRED'); END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x
    WHERE x->>'outcome' NOT IN ('picked','missing') OR
      coalesce(x->>'id','') !~ '^[0-9a-fA-F-]{36}$') THEN RETURN jsonb_build_object(
      'ok',false,'reason_code','INVALID_ITEM_OUTCOME'); END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_items)) <>
     (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_items) x)
  THEN RETURN jsonb_build_object('ok',false,'reason_code','DUPLICATE_ITEM_ID'); END IF;
  IF (SELECT count(*) FROM public.order_items WHERE order_id=p_order_id) <>
     jsonb_array_length(p_items)
     OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x
       WHERE NOT EXISTS(SELECT 1 FROM public.order_items oi
         WHERE oi.id=(x->>'id')::uuid AND oi.order_id=p_order_id))
  THEN RETURN jsonb_build_object('ok',false,'reason_code','ITEM_SET_INCOMPLETE_OR_FOREIGN'); END IF;
  IF EXISTS(SELECT 1 FROM public.driver_item_outcomes_v2 r
    WHERE r.order_id=p_order_id AND r.action_id<>p_action_id)
  THEN RETURN jsonb_build_object('ok',false,'reason_code','ITEMS_ALREADY_RESOLVED'); END IF;
  UPDATE public.mise_delivery_batch_stops SET stop_version=stop_version+1
    WHERE id=st.id AND stop_version=p_expected_stop_version;
  result:=jsonb_build_object('ok',true,'stop_version',p_expected_stop_version+1,'correlation_id',corr);
  INSERT INTO public.driver_action_requests_v2 VALUES(
    p_action_id,p_tenant_id,p_actor_driver_id,'resolve_items',p_order_id,fp,corr,result,now());
  INSERT INTO public.driver_item_resolutions_v2 VALUES(
    p_action_id,p_tenant_id,p_actor_driver_id,p_order_id,st.id,fp,result,corr,now());
  INSERT INTO public.driver_item_outcomes_v2(
    order_id,item_id,tenant_id,driver_id,outcome,action_id,correlation_id)
  SELECT p_order_id,(x->>'id')::uuid,p_tenant_id,p_actor_driver_id,x->>'outcome',
    p_action_id,corr FROM jsonb_array_elements(p_items) x;
  INSERT INTO public.dispatch_offer_audit(decision_id,idempotency_key,order_id,batch_id,driver_id,
    outcome,reason_code,expected_order_version,algorithm_version,details,correlation_id,event_type)
    VALUES(gen_random_uuid(),p_action_id,p_order_id,st.batch_id,p_actor_driver_id,'assigned',
      'ITEMS_RESOLVED',p_expected_order_version,'driver-v2',jsonb_build_object('items',p_items),
      corr,'pickup.items_resolved');
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.fn_driver_report_exception_v2(
  p_tenant_id uuid,p_actor_driver_id uuid,p_action_id uuid,
  p_expected_driver_version bigint,p_kind text,p_note text,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE corr uuid:=p_correlation_id; eid uuid:=gen_random_uuid(); result jsonb;
  fp text:=md5(pg_catalog.concat_ws('|',p_tenant_id,p_actor_driver_id,
    p_expected_driver_version,p_kind,coalesce(p_note,'')));
  old public.driver_action_requests_v2%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,27801));
  SELECT * INTO old FROM public.driver_action_requests_v2 WHERE action_id=p_action_id;
  IF FOUND THEN
    IF old.tenant_id<>p_tenant_id OR old.driver_id<>p_actor_driver_id
      OR old.action<>'report_exception' OR old.target_id IS NOT NULL
      OR old.request_fingerprint<>fp THEN RETURN jsonb_build_object('ok',false,
      'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
    RETURN old.result||jsonb_build_object('idempotent_replay',true);
  END IF;
  IF p_kind NOT IN ('medical_safety_emergency','vehicle_failure','accident_road_closure',
    'location_permission_gps_failure','network_device_failure','shift_invalid','dispatcher_authorized_break')
  THEN RETURN jsonb_build_object('ok',false,'reason_code','INVALID_EXCEPTION_KIND'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.mise_driver_tenants WHERE tenant_id=p_tenant_id
    AND driver_id=p_actor_driver_id AND status='active') THEN RETURN jsonb_build_object(
      'ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH'); END IF;
  UPDATE public.mise_drivers SET state='exception',state_version=state_version+1,updated_at=now()
    WHERE id=p_actor_driver_id AND state_version=p_expected_driver_version;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_VERSION_CONFLICT'); END IF;
  INSERT INTO public.driver_exceptions_v2(id,tenant_id,driver_id,kind,note,action_id,correlation_id)
    VALUES(eid,p_tenant_id,p_actor_driver_id,p_kind,nullif(p_note,''),p_action_id,corr);
  result:=jsonb_build_object('ok',true,'exception_id',eid,'state','exception',
    'driver_version',p_expected_driver_version+1,'correlation_id',corr);
  INSERT INTO public.driver_action_requests_v2 VALUES(
    p_action_id,p_tenant_id,p_actor_driver_id,'report_exception',NULL,fp,corr,result,now());
  RETURN result;
EXCEPTION WHEN unique_violation THEN
  RETURN (SELECT jsonb_build_object('ok',true,'exception_id',id,'state','exception',
    'driver_version',p_expected_driver_version+1,'correlation_id',correlation_id,'idempotent_replay',true)
    FROM public.driver_exceptions_v2 WHERE action_id=p_action_id);
END $$;

CREATE OR REPLACE FUNCTION public.fn_driver_pickup_v2(
  p_tenant_id uuid,p_order_id uuid,p_expected_order_version bigint,
  p_expected_assignment_version bigint,p_expected_batch_version bigint,
  p_expected_driver_version bigint,p_actor_driver_id uuid,p_action_id uuid,
  p_expected_stop_version bigint,p_expected_route_version bigint,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE o public.customer_orders%ROWTYPE; a public.dispatch_offer_assignments%ROWTYPE;
  b public.mise_delivery_batches%ROWTYPE; d public.mise_drivers%ROWTYPE;
  s public.mise_delivery_batch_stops%ROWTYPE; result jsonb; corr uuid:=p_correlation_id;
  fp text:=md5(pg_catalog.concat_ws('|',p_tenant_id,p_order_id,p_expected_order_version,
    p_expected_assignment_version,p_expected_batch_version,p_expected_driver_version,
    p_actor_driver_id,p_expected_stop_version,p_expected_route_version));
  old public.driver_action_requests_v2%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,27801));
  SELECT * INTO old FROM public.driver_action_requests_v2 WHERE action_id=p_action_id;
  IF FOUND THEN
    IF old.tenant_id<>p_tenant_id OR old.driver_id<>p_actor_driver_id
      OR old.action<>'confirm_pickup' OR old.target_id IS DISTINCT FROM p_order_id
      OR old.request_fingerprint<>fp THEN RETURN jsonb_build_object('ok',false,'reason_code',
      'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
    RETURN old.result||jsonb_build_object('idempotent_replay',true);
  END IF;
  SELECT * INTO o FROM public.customer_orders WHERE id=p_order_id FOR UPDATE;
  SELECT * INTO a FROM public.dispatch_offer_assignments WHERE order_id=p_order_id AND state='assigned' FOR UPDATE;
  SELECT * INTO b FROM public.mise_delivery_batches WHERE id=a.batch_id FOR UPDATE;
  SELECT * INTO d FROM public.mise_drivers WHERE id=p_actor_driver_id FOR UPDATE;
  SELECT * INTO s FROM public.mise_delivery_batch_stops WHERE batch_id=a.batch_id
    AND order_id=p_order_id AND type='pickup' FOR UPDATE;
  IF a.driver_id IS DISTINCT FROM p_actor_driver_id OR a.tenant_id IS DISTINCT FROM p_tenant_id
    OR b.driver_id IS DISTINCT FROM p_actor_driver_id OR NOT EXISTS(SELECT 1 FROM public.locations l
      WHERE l.id=o.location_id AND l.tenant_id=p_tenant_id)
  THEN RETURN jsonb_build_object('ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH'); END IF;
  IF o.status<>'assigned' OR a.state<>'assigned' OR b.state<>'assigned'
    OR d.state<>'assigned' OR s.state<>'arrived'
  THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_STATE_CONFLICT'); END IF;
  IF o.dispatch_version<>p_expected_order_version OR a.assignment_version<>p_expected_assignment_version
    OR b.state_version<>p_expected_batch_version OR b.route_version<>p_expected_route_version
    OR d.state_version<>p_expected_driver_version OR s.stop_version<>p_expected_stop_version
  THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_VERSION_CONFLICT'); END IF;
  IF (SELECT count(*) FROM public.order_items WHERE order_id=p_order_id)=0
    OR (SELECT count(*) FROM public.order_items WHERE order_id=p_order_id) <>
       (SELECT count(*) FROM public.driver_item_outcomes_v2 WHERE order_id=p_order_id)
  THEN RETURN jsonb_build_object('ok',false,'reason_code','ITEM_RESOLUTION_INCOMPLETE'); END IF;
  UPDATE public.dispatch_offer_assignments SET state='picked_up',assignment_version=assignment_version+1,
    updated_at=now() WHERE id=a.id AND state='assigned' AND assignment_version=p_expected_assignment_version;
  UPDATE public.mise_delivery_batch_stops SET state='completed',completed_at=now(),
    stop_version=stop_version+1 WHERE id=s.id AND state='arrived' AND stop_version=p_expected_stop_version;
  UPDATE public.mise_delivery_batches SET state='at_pickup',state_version=state_version+1,
    picked_up_at=now(),updated_at=now() WHERE id=b.id AND state='assigned'
    AND state_version=p_expected_batch_version AND route_version=p_expected_route_version;
  UPDATE public.customer_orders SET status='picked_up',dispatch_version=dispatch_version+1,updated_at=now()
    WHERE id=o.id AND status='assigned' AND dispatch_version=p_expected_order_version;
  UPDATE public.mise_drivers SET state='at_pickup',state_version=state_version+1,updated_at=now()
    WHERE id=d.id AND state='assigned' AND state_version=p_expected_driver_version;
  result:=jsonb_build_object('ok',true,'state','picked_up',
    'order_version',p_expected_order_version+1,'assignment_version',p_expected_assignment_version+1,
    'batch_version',p_expected_batch_version+1,'route_version',p_expected_route_version,
    'driver_version',p_expected_driver_version+1,'stop_version',p_expected_stop_version+1,
    'correlation_id',corr);
  INSERT INTO public.dispatch_offer_audit(decision_id,idempotency_key,order_id,batch_id,driver_id,
    outcome,reason_code,expected_order_version,algorithm_version,details,correlation_id,event_type)
  VALUES(gen_random_uuid(),p_action_id,p_order_id,b.id,d.id,'assigned','PICKUP_CONFIRMED',
    p_expected_order_version,'driver-v2','{}',corr,'assignment.picked_up');
  INSERT INTO public.driver_action_requests_v2 VALUES(
    p_action_id,p_tenant_id,p_actor_driver_id,'confirm_pickup',p_order_id,fp,corr,result,now());
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.fn_driver_depart_v2(
  p_tenant_id uuid,p_order_id uuid,p_expected_order_version bigint,
  p_expected_assignment_version bigint,p_expected_batch_version bigint,
  p_expected_driver_version bigint,p_actor_driver_id uuid,p_action_id uuid,
  p_stop_id uuid,p_expected_stop_version bigint,p_expected_route_version bigint,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o public.customer_orders%ROWTYPE; a public.dispatch_offer_assignments%ROWTYPE;
 b public.mise_delivery_batches%ROWTYPE; d public.mise_drivers%ROWTYPE;
 s public.mise_delivery_batch_stops%ROWTYPE; corr uuid:=p_correlation_id; result jsonb;
 fp text:=md5(pg_catalog.concat_ws('|',p_tenant_id,p_order_id,p_expected_order_version,
  p_expected_assignment_version,p_expected_batch_version,p_expected_driver_version,
  p_actor_driver_id,p_stop_id,p_expected_stop_version,p_expected_route_version));
 old public.driver_action_requests_v2%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,27801));
 SELECT * INTO old FROM public.driver_action_requests_v2 WHERE action_id=p_action_id;
 IF FOUND THEN
  IF old.tenant_id<>p_tenant_id OR old.driver_id<>p_actor_driver_id
   OR old.action<>'depart' OR old.target_id IS DISTINCT FROM p_order_id
   OR old.request_fingerprint<>fp THEN RETURN jsonb_build_object('ok',false,'reason_code',
    'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
  RETURN old.result||jsonb_build_object('idempotent_replay',true);
 END IF;
 SELECT * INTO o FROM public.customer_orders WHERE id=p_order_id FOR UPDATE;
 SELECT * INTO a FROM public.dispatch_offer_assignments WHERE order_id=p_order_id AND state='picked_up' FOR UPDATE;
 SELECT * INTO b FROM public.mise_delivery_batches WHERE id=a.batch_id FOR UPDATE;
 SELECT * INTO d FROM public.mise_drivers WHERE id=p_actor_driver_id FOR UPDATE;
 SELECT * INTO s FROM public.mise_delivery_batch_stops WHERE id=p_stop_id FOR UPDATE;
 IF a.driver_id<>p_actor_driver_id OR a.tenant_id<>p_tenant_id OR s.batch_id<>b.id OR s.order_id<>p_order_id
  OR s.type<>'pickup' THEN RETURN jsonb_build_object('ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH'); END IF;
 IF o.status<>'picked_up' OR a.state<>'picked_up' OR b.state<>'at_pickup'
  OR d.state<>'at_pickup' OR s.state<>'completed'
 THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_STATE_CONFLICT'); END IF;
 IF o.dispatch_version<>p_expected_order_version OR a.assignment_version<>p_expected_assignment_version
  OR b.state_version<>p_expected_batch_version OR b.route_version<>p_expected_route_version
  OR d.state_version<>p_expected_driver_version OR s.stop_version<>p_expected_stop_version
 THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_VERSION_CONFLICT'); END IF;
 UPDATE public.dispatch_offer_assignments SET state='in_progress',assignment_version=assignment_version+1,updated_at=now() WHERE id=a.id;
 UPDATE public.mise_delivery_batches SET state='in_progress',state_version=state_version+1,updated_at=now() WHERE id=b.id;
 UPDATE public.customer_orders SET status='out_for_delivery',dispatch_version=dispatch_version+1,updated_at=now() WHERE id=o.id;
 UPDATE public.mise_drivers SET state='delivering',state_version=state_version+1,updated_at=now() WHERE id=d.id;
 result:=jsonb_build_object('ok',true,'state','in_progress','order_version',p_expected_order_version+1,
  'assignment_version',p_expected_assignment_version+1,'batch_version',p_expected_batch_version+1,
  'route_version',p_expected_route_version,'driver_version',p_expected_driver_version+1,
  'stop_version',p_expected_stop_version,'correlation_id',corr);
 INSERT INTO public.dispatch_offer_audit(decision_id,idempotency_key,order_id,batch_id,driver_id,outcome,
  reason_code,expected_order_version,algorithm_version,details,correlation_id,event_type)
 VALUES(gen_random_uuid(),p_action_id,p_order_id,b.id,d.id,'assigned','DELIVERY_STARTED',
  p_expected_order_version,'driver-v2','{}',corr,'assignment.in_progress');
 INSERT INTO public.driver_action_requests_v2 VALUES(
  p_action_id,p_tenant_id,p_actor_driver_id,'depart',p_order_id,fp,corr,result,now());
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.fn_driver_complete_v2(
  p_tenant_id uuid,p_order_id uuid,p_expected_order_version bigint,
  p_expected_assignment_version bigint,p_expected_batch_version bigint,
  p_expected_driver_version bigint,p_actor_driver_id uuid,p_action_id uuid,
  p_stop_id uuid,p_expected_stop_version bigint,p_expected_route_version bigint,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o public.customer_orders%ROWTYPE; a public.dispatch_offer_assignments%ROWTYPE;
 b public.mise_delivery_batches%ROWTYPE; d public.mise_drivers%ROWTYPE;
 s public.mise_delivery_batch_stops%ROWTYPE; corr uuid:=p_correlation_id; result jsonb;
 fp text:=md5(pg_catalog.concat_ws('|',p_tenant_id,p_order_id,p_expected_order_version,
  p_expected_assignment_version,p_expected_batch_version,p_expected_driver_version,
  p_actor_driver_id,p_stop_id,p_expected_stop_version,p_expected_route_version));
 old public.driver_action_requests_v2%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,27801));
 SELECT * INTO old FROM public.driver_action_requests_v2 WHERE action_id=p_action_id;
 IF FOUND THEN
  IF old.tenant_id<>p_tenant_id OR old.driver_id<>p_actor_driver_id
   OR old.action<>'complete' OR old.target_id IS DISTINCT FROM p_order_id
   OR old.request_fingerprint<>fp THEN RETURN jsonb_build_object('ok',false,'reason_code',
    'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
  RETURN old.result||jsonb_build_object('idempotent_replay',true);
 END IF;
 SELECT * INTO o FROM public.customer_orders WHERE id=p_order_id FOR UPDATE;
 SELECT * INTO a FROM public.dispatch_offer_assignments WHERE order_id=p_order_id AND state='in_progress' FOR UPDATE;
 SELECT * INTO b FROM public.mise_delivery_batches WHERE id=a.batch_id FOR UPDATE;
 SELECT * INTO d FROM public.mise_drivers WHERE id=p_actor_driver_id FOR UPDATE;
 SELECT * INTO s FROM public.mise_delivery_batch_stops WHERE id=p_stop_id FOR UPDATE;
 IF a.driver_id<>p_actor_driver_id OR a.tenant_id<>p_tenant_id OR s.batch_id<>b.id OR s.order_id<>p_order_id
  OR s.type<>'dropoff' THEN RETURN jsonb_build_object('ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH'); END IF;
 IF o.status<>'out_for_delivery' OR a.state<>'in_progress' OR b.state<>'in_progress'
  OR d.state<>'delivering' OR s.state<>'arrived'
 THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_STATE_CONFLICT'); END IF;
 IF o.dispatch_version<>p_expected_order_version OR a.assignment_version<>p_expected_assignment_version
  OR b.state_version<>p_expected_batch_version OR b.route_version<>p_expected_route_version
  OR d.state_version<>p_expected_driver_version OR s.stop_version<>p_expected_stop_version
 THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_VERSION_CONFLICT'); END IF;
 UPDATE public.dispatch_offer_assignments SET state='completed',assignment_version=assignment_version+1,updated_at=now() WHERE id=a.id;
 UPDATE public.mise_delivery_batch_stops SET state='completed',stop_version=stop_version+1,completed_at=now() WHERE id=s.id;
 UPDATE public.mise_delivery_batches SET state='completed',state_version=state_version+1,completed_at=now(),updated_at=now() WHERE id=b.id;
 UPDATE public.customer_orders SET status='delivered',dispatch_version=dispatch_version+1,geliefert_am=now(),updated_at=now() WHERE id=o.id;
 UPDATE public.mise_drivers SET state='returning',state_version=state_version+1,current_capacity=current_capacity-1,updated_at=now() WHERE id=d.id;
 result:=jsonb_build_object('ok',true,'state','completed','order_version',p_expected_order_version+1,
  'assignment_version',p_expected_assignment_version+1,'batch_version',p_expected_batch_version+1,
  'route_version',p_expected_route_version,'driver_version',p_expected_driver_version+1,
  'stop_version',p_expected_stop_version+1,'correlation_id',corr);
 INSERT INTO public.dispatch_offer_audit(decision_id,idempotency_key,order_id,batch_id,driver_id,outcome,
  reason_code,expected_order_version,algorithm_version,details,correlation_id,event_type)
 VALUES(gen_random_uuid(),p_action_id,p_order_id,b.id,d.id,'completed','DELIVERY_CONFIRMED',
  p_expected_order_version,'driver-v2','{}',corr,'assignment.completed');
 INSERT INTO public.driver_action_requests_v2 VALUES(
  p_action_id,p_tenant_id,p_actor_driver_id,'complete',p_order_id,fp,corr,result,now());
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.fn_driver_accept_ack_compat_v2(
  p_tenant_id uuid,p_assignment_id uuid,p_driver_id uuid,p_snapshot_version bigint,
  p_receipt_key uuid,p_metadata jsonb,p_api_version text,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE r jsonb; a public.dispatch_offer_assignments%ROWTYPE;
 fp text:=md5(pg_catalog.concat_ws('|',p_tenant_id,p_assignment_id,p_driver_id,
  p_snapshot_version,p_metadata::text,p_api_version)); old public.driver_action_requests_v2%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_receipt_key::text,27801));
  SELECT * INTO old FROM public.driver_action_requests_v2 WHERE action_id=p_receipt_key;
  IF FOUND THEN
   IF old.tenant_id<>p_tenant_id OR old.driver_id<>p_driver_id
    OR old.action<>'ack_receipt' OR old.target_id IS DISTINCT FROM p_assignment_id
    OR old.request_fingerprint<>fp THEN RETURN jsonb_build_object('ok',false,'reason_code',
    'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST','correlation_id',old.correlation_id); END IF;
   RETURN old.result||jsonb_build_object('idempotent_replay',true);
  END IF;
  SELECT * INTO a FROM public.dispatch_offer_assignments WHERE id=p_assignment_id FOR UPDATE;
  IF a.tenant_id<>p_tenant_id OR a.driver_id<>p_driver_id THEN RETURN jsonb_build_object(
   'ok',false,'reason_code','ASSIGNMENT_ACK_FORBIDDEN','correlation_id',p_correlation_id); END IF;
  IF a.assignment_version<>p_snapshot_version THEN RETURN jsonb_build_object(
   'ok',false,'reason_code','ASSIGNMENT_VERSION_CONFLICT','correlation_id',p_correlation_id); END IF;
  UPDATE public.dispatch_offer_assignments SET received_by_app_at=coalesce(received_by_app_at,now()),
   updated_at=now() WHERE id=a.id;
  r:=jsonb_build_object('ok',true,'assignment_id',a.id,'assignment_version',
   a.assignment_version,'state',a.state,'received_by_app',true,'correlation_id',p_correlation_id);
  INSERT INTO public.driver_api_compatibility_events_v2(
   driver_id,api_version,action,outcome,correlation_id)
  VALUES(p_driver_id,p_api_version,'accept_as_ack','ok',p_correlation_id);
  INSERT INTO public.driver_action_requests_v2 VALUES(
   p_receipt_key,p_tenant_id,p_driver_id,'ack_receipt',p_assignment_id,fp,p_correlation_id,r,now());
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.fn_driver_session_v2(uuid,uuid,uuid,bigint,boolean,uuid),
  public.fn_driver_arrive_v2(uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,uuid),
  public.fn_driver_resolve_items_v2(uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,jsonb,bigint,bigint,uuid),
  public.fn_driver_report_exception_v2(uuid,uuid,uuid,bigint,text,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_driver_session_v2(uuid,uuid,uuid,bigint,boolean,uuid),
  public.fn_driver_arrive_v2(uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,uuid),
  public.fn_driver_resolve_items_v2(uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,jsonb,bigint,bigint,uuid),
  public.fn_driver_report_exception_v2(uuid,uuid,uuid,bigint,text,text,uuid)
  TO service_role;
REVOKE ALL ON FUNCTION public.fn_driver_pickup_v2(
  uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,bigint,bigint,uuid),
  public.fn_driver_accept_ack_compat_v2(uuid,uuid,uuid,bigint,uuid,jsonb,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_driver_pickup_v2(
  uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,bigint,bigint,uuid),
  public.fn_driver_accept_ack_compat_v2(uuid,uuid,uuid,bigint,uuid,jsonb,text,uuid)
  TO service_role;
REVOKE ALL ON FUNCTION public.fn_driver_depart_v2(
 uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,uuid,bigint,bigint,uuid),
 public.fn_driver_complete_v2(
 uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,uuid,bigint,bigint,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_driver_depart_v2(
 uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,uuid,bigint,bigint,uuid),
 public.fn_driver_complete_v2(
 uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,uuid,bigint,bigint,uuid)
 TO service_role;
