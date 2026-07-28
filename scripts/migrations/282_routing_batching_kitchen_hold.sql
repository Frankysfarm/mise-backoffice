-- T08 persistent kitchen-hold authority. Additive and default-off.
CREATE TABLE IF NOT EXISTS public.dispatch_routing_hold_config_v2 (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  enabled boolean NOT NULL DEFAULT false,
  shadow_only boolean NOT NULL DEFAULT true,
  max_hold_minutes integer NOT NULL DEFAULT 5 CHECK (max_hold_minutes BETWEEN 0 AND 15),
  allow_multi_store boolean NOT NULL DEFAULT false,
  max_added_detour_minutes numeric NOT NULL DEFAULT 8 CHECK (max_added_detour_minutes >= 0),
  route_cache_ttl_seconds integer NOT NULL DEFAULT 300 CHECK (route_cache_ttl_seconds BETWEEN 10 AND 3600),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.dispatch_kitchen_holds_v2 (
  order_id uuid PRIMARY KEY REFERENCES public.customer_orders(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  state text NOT NULL CHECK (state IN ('held','released','cancelled','escalated')),
  hold_version bigint NOT NULL DEFAULT 1 CHECK (hold_version > 0),
  input_version bigint NOT NULL CHECK (input_version > 0),
  kitchen_release_at timestamptz NOT NULL,
  absolute_hold_deadline_at timestamptz NOT NULL,
  next_evaluation_at timestamptz NOT NULL,
  reason_code text NOT NULL,
  input_snapshot jsonb NOT NULL,
  decision_action_id uuid NOT NULL UNIQUE,
  release_action_id uuid UNIQUE,
  correlation_id uuid NOT NULL,
  released_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (kitchen_release_at <= absolute_hold_deadline_at),
  CHECK ((state='released') = (released_at IS NOT NULL)),
  CHECK ((state='cancelled') = (cancelled_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_dispatch_kitchen_holds_due_v2
  ON public.dispatch_kitchen_holds_v2(state,next_evaluation_at,absolute_hold_deadline_at);

CREATE TABLE IF NOT EXISTS public.dispatch_kitchen_release_outbox_v2 (
  order_id uuid PRIMARY KEY REFERENCES public.customer_orders(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  action_id uuid NOT NULL UNIQUE,
  correlation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  delivered_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.dispatch_kitchen_hold_audit_v2 (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.customer_orders(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  action_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('scheduled','rescheduled','released','cancelled')),
  reason_code text NOT NULL,
  hold_version bigint NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (action_id,event_type)
);

CREATE TABLE IF NOT EXISTS public.dispatch_route_plans_v2 (
  assignment_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  route_version bigint NOT NULL CHECK (route_version > 0),
  input_version bigint NOT NULL CHECK (input_version > 0),
  state text NOT NULL CHECK (state IN ('planned','active','completed','cancelled')),
  stops jsonb NOT NULL CHECK (jsonb_typeof(stops)='array'),
  arrivals jsonb NOT NULL CHECK (jsonb_typeof(arrivals)='object'),
  explanation jsonb NOT NULL CHECK (jsonb_typeof(explanation)='object'),
  matrix_fallback_used boolean NOT NULL,
  action_id uuid NOT NULL UNIQUE,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (assignment_id, route_version)
);

CREATE OR REPLACE FUNCTION public.fn_persist_route_plan_v2(
  p_tenant_id uuid,p_assignment_id uuid,p_expected_route_version bigint,
  p_input_version bigint,p_stops jsonb,p_arrivals jsonb,p_explanation jsonb,
  p_matrix_fallback_used boolean,p_action_id uuid,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.dispatch_route_plans_v2%ROWTYPE; cfg public.dispatch_routing_hold_config_v2%ROWTYPE;
BEGIN
  SELECT * INTO cfg FROM public.dispatch_routing_hold_config_v2 WHERE tenant_id=p_tenant_id;
  IF NOT FOUND OR NOT cfg.enabled OR cfg.shadow_only THEN
    RETURN jsonb_build_object('ok',false,'reason_code','T08_ACTIVE_DEFAULT_OFF');
  END IF;
  IF p_input_version<1 OR jsonb_typeof(p_stops)<>'array' OR jsonb_array_length(p_stops)<2
     OR jsonb_typeof(p_arrivals)<>'object' OR jsonb_typeof(p_explanation)<>'object' THEN
    RETURN jsonb_build_object('ok',false,'reason_code','INVALID_ROUTE_PLAN');
  END IF;
  SELECT * INTO r FROM public.dispatch_route_plans_v2 WHERE assignment_id=p_assignment_id FOR UPDATE;
  IF FOUND AND r.action_id=p_action_id THEN
    RETURN jsonb_build_object('ok',true,'route_version',r.route_version,'idempotent_replay',true);
  END IF;
  IF (NOT FOUND AND p_expected_route_version<>0) OR
     (FOUND AND (r.route_version<>p_expected_route_version OR r.state IN ('completed','cancelled'))) THEN
    RETURN jsonb_build_object('ok',false,'reason_code','ROUTE_VERSION_CONFLICT',
      'route_version',CASE WHEN FOUND THEN r.route_version ELSE 0 END);
  END IF;
  INSERT INTO public.dispatch_route_plans_v2(assignment_id,tenant_id,route_version,input_version,
    state,stops,arrivals,explanation,matrix_fallback_used,action_id,correlation_id)
  VALUES(p_assignment_id,p_tenant_id,1,p_input_version,'planned',p_stops,p_arrivals,
    p_explanation,p_matrix_fallback_used,p_action_id,p_correlation_id)
  ON CONFLICT(assignment_id) DO UPDATE SET
    route_version=dispatch_route_plans_v2.route_version+1,input_version=excluded.input_version,
    stops=excluded.stops,arrivals=excluded.arrivals,explanation=excluded.explanation,
    matrix_fallback_used=excluded.matrix_fallback_used,action_id=excluded.action_id,
    correlation_id=excluded.correlation_id,updated_at=clock_timestamp();
  RETURN (SELECT jsonb_build_object('ok',true,'route_version',route_version,'idempotent_replay',false)
    FROM public.dispatch_route_plans_v2 WHERE assignment_id=p_assignment_id);
END $$;

CREATE OR REPLACE FUNCTION public.fn_schedule_kitchen_hold_v2(
  p_tenant_id uuid, p_order_id uuid, p_expected_hold_version bigint,
  p_input_version bigint, p_release_at timestamptz, p_absolute_deadline_at timestamptz,
  p_next_evaluation_at timestamptz, p_reason_code text, p_input_snapshot jsonb,
  p_action_id uuid, p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h public.dispatch_kitchen_holds_v2%ROWTYPE; cfg public.dispatch_routing_hold_config_v2%ROWTYPE;
BEGIN
  SELECT * INTO cfg FROM public.dispatch_routing_hold_config_v2 WHERE tenant_id=p_tenant_id;
  IF NOT FOUND OR NOT cfg.enabled OR cfg.shadow_only THEN
    RETURN jsonb_build_object('ok',false,'reason_code','T08_ACTIVE_DEFAULT_OFF');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.customer_orders
    WHERE id=p_order_id AND tenant_id=p_tenant_id
  ) THEN
    RETURN jsonb_build_object('ok',false,'reason_code','TENANT_ORDER_MISMATCH');
  END IF;
  IF p_release_at>p_absolute_deadline_at OR p_input_version<1 OR p_action_id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason_code','INVALID_HOLD_ENVELOPE');
  END IF;
  IF p_absolute_deadline_at>clock_timestamp()+make_interval(mins=>cfg.max_hold_minutes)
     OR p_absolute_deadline_at<=clock_timestamp()
     OR p_next_evaluation_at>p_absolute_deadline_at THEN
    RETURN jsonb_build_object('ok',false,'reason_code','HOLD_DEADLINE_POLICY_VIOLATION');
  END IF;
  SELECT * INTO h FROM public.dispatch_kitchen_holds_v2 WHERE order_id=p_order_id FOR UPDATE;
  IF FOUND AND h.decision_action_id=p_action_id THEN
    RETURN jsonb_build_object('ok',true,'state',h.state,'hold_version',h.hold_version,'idempotent_replay',true);
  END IF;
  IF FOUND AND (h.state<>'held' OR h.hold_version<>p_expected_hold_version) THEN
    RETURN jsonb_build_object('ok',false,'reason_code','HOLD_VERSION_CONFLICT','hold_version',h.hold_version);
  END IF;
  IF FOUND AND p_absolute_deadline_at>h.absolute_hold_deadline_at THEN
    RETURN jsonb_build_object('ok',false,'reason_code','HOLD_DEADLINE_EXTENSION_FORBIDDEN');
  END IF;
  INSERT INTO public.dispatch_kitchen_holds_v2(
    order_id,tenant_id,state,hold_version,input_version,kitchen_release_at,
    absolute_hold_deadline_at,next_evaluation_at,reason_code,input_snapshot,
    decision_action_id,correlation_id)
  VALUES(p_order_id,p_tenant_id,'held',1,p_input_version,p_release_at,
    p_absolute_deadline_at,p_next_evaluation_at,p_reason_code,p_input_snapshot,
    p_action_id,p_correlation_id)
  ON CONFLICT(order_id) DO UPDATE SET
    hold_version=dispatch_kitchen_holds_v2.hold_version+1,input_version=excluded.input_version,
    kitchen_release_at=excluded.kitchen_release_at,
    absolute_hold_deadline_at=excluded.absolute_hold_deadline_at,
    next_evaluation_at=excluded.next_evaluation_at,reason_code=excluded.reason_code,
    input_snapshot=excluded.input_snapshot,decision_action_id=excluded.decision_action_id,
    correlation_id=excluded.correlation_id,updated_at=clock_timestamp();
  INSERT INTO public.dispatch_kitchen_hold_audit_v2(order_id,tenant_id,action_id,
    correlation_id,event_type,reason_code,hold_version,details)
  SELECT order_id,tenant_id,p_action_id,p_correlation_id,
    CASE WHEN hold_version=1 THEN 'scheduled' ELSE 'rescheduled' END,
    p_reason_code,hold_version,p_input_snapshot
  FROM public.dispatch_kitchen_holds_v2 WHERE order_id=p_order_id
  ON CONFLICT(action_id,event_type) DO NOTHING;
  RETURN (SELECT jsonb_build_object('ok',true,'state',state,'hold_version',hold_version,'idempotent_replay',false)
    FROM public.dispatch_kitchen_holds_v2 WHERE order_id=p_order_id);
END $$;

CREATE OR REPLACE FUNCTION public.fn_release_kitchen_hold_v2(
  p_tenant_id uuid, p_order_id uuid, p_expected_hold_version bigint,
  p_action_id uuid, p_correlation_id uuid, p_reason_code text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h public.dispatch_kitchen_holds_v2%ROWTYPE;
BEGIN
  SELECT * INTO h FROM public.dispatch_kitchen_holds_v2 WHERE order_id=p_order_id FOR UPDATE;
  IF NOT FOUND OR h.tenant_id<>p_tenant_id THEN RETURN jsonb_build_object('ok',false,'reason_code','HOLD_NOT_FOUND'); END IF;
  IF h.state='released' AND h.release_action_id=p_action_id THEN
    RETURN jsonb_build_object('ok',true,'state','released','hold_version',h.hold_version,'idempotent_replay',true);
  END IF;
  IF h.state<>'held' OR h.hold_version<>p_expected_hold_version THEN
    RETURN jsonb_build_object('ok',false,'reason_code','HOLD_VERSION_CONFLICT','hold_version',h.hold_version);
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.customer_orders
    WHERE id=p_order_id AND status::text IN ('cancelled','canceled','storniert')
  ) THEN
    RETURN jsonb_build_object('ok',false,'reason_code','ORDER_CANCELLED');
  END IF;
  UPDATE public.dispatch_kitchen_holds_v2 SET state='released',hold_version=hold_version+1,
    release_action_id=p_action_id,released_at=clock_timestamp(),reason_code=p_reason_code,
    correlation_id=p_correlation_id,updated_at=clock_timestamp() WHERE order_id=p_order_id;
  INSERT INTO public.dispatch_kitchen_release_outbox_v2(order_id,tenant_id,action_id,correlation_id,payload)
  VALUES(p_order_id,p_tenant_id,p_action_id,p_correlation_id,
    jsonb_build_object('type','kitchen_release','order_id',p_order_id,'reason_code',p_reason_code))
  ON CONFLICT(order_id) DO NOTHING;
  INSERT INTO public.dispatch_kitchen_hold_audit_v2(order_id,tenant_id,action_id,
    correlation_id,event_type,reason_code,hold_version)
  SELECT order_id,tenant_id,p_action_id,p_correlation_id,'released',p_reason_code,hold_version
  FROM public.dispatch_kitchen_holds_v2 WHERE order_id=p_order_id
  ON CONFLICT(action_id,event_type) DO NOTHING;
  RETURN (SELECT jsonb_build_object('ok',true,'state',state,'hold_version',hold_version,'idempotent_replay',false)
    FROM public.dispatch_kitchen_holds_v2 WHERE order_id=p_order_id);
END $$;

CREATE OR REPLACE FUNCTION public.fn_cancel_kitchen_hold_v2(
  p_tenant_id uuid,p_order_id uuid,p_expected_hold_version bigint,p_action_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h public.dispatch_kitchen_holds_v2%ROWTYPE;
BEGIN
  SELECT * INTO h FROM public.dispatch_kitchen_holds_v2 WHERE order_id=p_order_id FOR UPDATE;
  IF NOT FOUND OR h.tenant_id<>p_tenant_id THEN RETURN jsonb_build_object('ok',false,'reason_code','HOLD_NOT_FOUND'); END IF;
  IF h.state='cancelled' THEN RETURN jsonb_build_object('ok',true,'state','cancelled','idempotent_replay',true); END IF;
  IF h.state<>'held' OR h.hold_version<>p_expected_hold_version THEN RETURN jsonb_build_object('ok',false,'reason_code','HOLD_VERSION_CONFLICT'); END IF;
  UPDATE public.dispatch_kitchen_holds_v2 SET state='cancelled',hold_version=hold_version+1,
    cancelled_at=clock_timestamp(),updated_at=clock_timestamp() WHERE order_id=p_order_id;
  INSERT INTO public.dispatch_kitchen_hold_audit_v2(order_id,tenant_id,action_id,
    correlation_id,event_type,reason_code,hold_version)
  SELECT order_id,tenant_id,p_action_id,correlation_id,'cancelled','ORDER_CANCELLED',hold_version
  FROM public.dispatch_kitchen_holds_v2 WHERE order_id=p_order_id
  ON CONFLICT(action_id,event_type) DO NOTHING;
  RETURN jsonb_build_object('ok',true,'state','cancelled','idempotent_replay',false);
END $$;

CREATE OR REPLACE FUNCTION public.fn_watchdog_release_kitchen_holds_v2(p_limit integer DEFAULT 100)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h record; n bigint:=0; r jsonb;
BEGIN
  FOR h IN SELECT * FROM public.dispatch_kitchen_holds_v2
    WHERE state='held' AND (kitchen_release_at<=clock_timestamp() OR absolute_hold_deadline_at<=clock_timestamp())
    ORDER BY absolute_hold_deadline_at FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(p_limit,1000))
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.customer_orders
      WHERE id=h.order_id AND status::text IN ('cancelled','canceled','storniert')
    ) THEN
      r:=public.fn_cancel_kitchen_hold_v2(
        h.tenant_id,h.order_id,h.hold_version,gen_random_uuid());
    ELSE
      r:=public.fn_release_kitchen_hold_v2(h.tenant_id,h.order_id,h.hold_version,
        gen_random_uuid(),h.correlation_id,'WATCHDOG_DEADLINE');
      IF (r->>'ok')::boolean THEN n:=n+1; END IF;
    END IF;
  END LOOP;
  RETURN n;
END $$;

-- Atomic-v2 append for a driver who already owns an active batch. Route stop
-- ids are caller-generated so the exact evaluated order can be committed
-- without a second route mutation after this transaction.
CREATE OR REPLACE FUNCTION public.fn_append_order_to_route_v2(
  p_tenant_id uuid,p_writer_id uuid,p_writer_epoch bigint,p_driver_id uuid,
  p_expected_driver_version bigint,p_batch_id uuid,p_expected_route_version bigint,
  p_order_id uuid,p_expected_order_version bigint,p_pickup_stop_id uuid,
  p_dropoff_stop_id uuid,p_pickup_lat numeric,p_pickup_lng numeric,
  p_dropoff_lat numeric,p_dropoff_lng numeric,p_pickup_address text,
  p_dropoff_address text,p_pickup_deadline_at timestamptz,
  p_delivery_deadline_at timestamptz,p_route_stops jsonb,p_arrivals jsonb,
  p_explanation jsonb,p_matrix_fallback_used boolean,p_action_id uuid,
  p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  g public.dispatch_writer_gates%ROWTYPE;
  d public.mise_drivers%ROWTYPE;
  b public.mise_delivery_batches%ROWTYPE;
  o public.customer_orders%ROWTYPE;
  old_req public.dispatch_assignment_requests_v2%ROWTYPE;
  v_assignment_id uuid;
  fingerprint text;
  result jsonb;
  active_count integer;
  represented_count integer;
BEGIN
  IF p_action_id IS NULL OR p_correlation_id IS NULL OR p_pickup_stop_id=p_dropoff_stop_id
     OR jsonb_typeof(p_route_stops)<>'array' OR jsonb_typeof(p_arrivals)<>'object'
     OR jsonb_typeof(p_explanation)<>'object' THEN
    RETURN jsonb_build_object('ok',false,'reason_code','INVALID_APPEND_ENVELOPE');
  END IF;
  fingerprint:=md5(concat_ws('|',p_tenant_id,p_writer_id,p_writer_epoch,p_driver_id,
    p_expected_driver_version,p_batch_id,p_expected_route_version,p_order_id,
    p_expected_order_version,p_pickup_stop_id,p_dropoff_stop_id,p_pickup_lat,p_pickup_lng,
    p_dropoff_lat,p_dropoff_lng,p_pickup_deadline_at,p_delivery_deadline_at,
    p_route_stops::text,p_arrivals::text,p_explanation::text,p_matrix_fallback_used));
  IF coalesce(current_setting('t08.race_barrier',true),'')<>'' AND
     to_regprocedure('public.fn_t08_race_barrier(text)') IS NOT NULL THEN
    EXECUTE 'SELECT public.fn_t08_race_barrier($1)'
      USING current_setting('t08.race_barrier',true);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,28201));
  SELECT * INTO old_req FROM public.dispatch_assignment_requests_v2 WHERE action_id=p_action_id;
  IF FOUND THEN
    IF old_req.request_fingerprint<>fingerprint THEN
      RETURN jsonb_build_object('ok',false,'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',
        'correlation_id',old_req.correlation_id);
    END IF;
    RETURN old_req.result||jsonb_build_object('idempotent_replay',true);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text,27601));
  SELECT * INTO g FROM public.dispatch_writer_gates WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND OR NOT g.enabled OR g.writer<>'atomic_v2'
     OR g.active_writer_id IS DISTINCT FROM p_writer_id OR g.writer_epoch<>p_writer_epoch
     OR g.lease_expires_at<=clock_timestamp() THEN
    RETURN jsonb_build_object('ok',false,'reason_code','WRITER_LEASE_STALE_OR_NOT_OWNER');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.dispatch_routing_hold_config_v2
    WHERE tenant_id=p_tenant_id AND enabled AND NOT shadow_only) THEN
    RETURN jsonb_build_object('ok',false,'reason_code','T08_ACTIVE_DEFAULT_OFF');
  END IF;

  SELECT * INTO d FROM public.mise_drivers WHERE id=p_driver_id FOR UPDATE;
  SELECT * INTO b FROM public.mise_delivery_batches WHERE id=p_batch_id FOR UPDATE;
  SELECT * INTO o FROM public.customer_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR o.tenant_id<>p_tenant_id OR o.typ::text<>'lieferung'
     OR o.status::text NOT IN ('fertig','ready') OR o.mise_batch_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'reason_code','ORDER_NOT_ASSIGNABLE');
  END IF;
  IF d.id IS NULL OR d.state_version<>p_expected_driver_version
     OR d.current_capacity+1>d.max_capacity THEN
    RETURN jsonb_build_object('ok',false,'reason_code','DRIVER_VERSION_OR_CAPACITY_CONFLICT');
  END IF;
  IF b.id IS NULL OR b.driver_id<>p_driver_id OR b.state IN ('completed','cancelled')
     OR b.route_version<>p_expected_route_version THEN
    RETURN jsonb_build_object('ok',false,'reason_code','BATCH_ROUTE_VERSION_CONFLICT');
  END IF;
  IF o.dispatch_version<>p_expected_order_version OR o.location_id IS DISTINCT FROM b.location_id THEN
    RETURN jsonb_build_object('ok',false,'reason_code','ORDER_VERSION_OR_STORE_CONFLICT');
  END IF;
  IF p_pickup_lat NOT BETWEEN -90 AND 90 OR p_dropoff_lat NOT BETWEEN -90 AND 90
     OR p_pickup_lng NOT BETWEEN -180 AND 180 OR p_dropoff_lng NOT BETWEEN -180 AND 180
     OR p_pickup_deadline_at<=clock_timestamp()
     OR p_delivery_deadline_at<=p_pickup_deadline_at THEN
    RETURN jsonb_build_object('ok',false,'reason_code','INVALID_ROUTE_OR_DEADLINE');
  END IF;

  SELECT count(*) INTO active_count FROM public.mise_delivery_batch_stops
    WHERE batch_id=p_batch_id AND state NOT IN ('completed','cancelled');
  SELECT count(DISTINCT (s->>'id')::uuid) INTO represented_count
    FROM jsonb_array_elements(p_route_stops) s
    WHERE s->>'id' IS NOT NULL;
  IF jsonb_array_length(p_route_stops)<>active_count+2
     OR represented_count<>active_count+2
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_route_stops) s
       WHERE (s->>'id')::uuid=p_pickup_stop_id AND s->>'kind'='pickup')
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_route_stops) s
       WHERE (s->>'id')::uuid=p_dropoff_stop_id AND s->>'kind'='dropoff')
     OR EXISTS(SELECT 1 FROM public.mise_delivery_batch_stops s
       WHERE s.batch_id=p_batch_id AND s.state NOT IN ('completed','cancelled')
       AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_route_stops) r
         WHERE (r->>'id')::uuid=s.id)) THEN
    RETURN jsonb_build_object('ok',false,'reason_code','ROUTE_STOP_SET_MISMATCH');
  END IF;

  INSERT INTO public.mise_delivery_batch_stops(
    id,batch_id,order_id,type,sequence,lat,lng,address,state,stop_version)
  VALUES
    (p_pickup_stop_id,p_batch_id,p_order_id,'pickup',active_count,p_pickup_lat,
      p_pickup_lng,p_pickup_address,'pending',0),
    (p_dropoff_stop_id,p_batch_id,p_order_id,'dropoff',active_count+1,p_dropoff_lat,
      p_dropoff_lng,p_dropoff_address,'pending',0);
  UPDATE public.mise_delivery_batch_stops s SET sequence=r.ord::integer-1
  FROM jsonb_array_elements(p_route_stops) WITH ORDINALITY r(item,ord)
  WHERE s.batch_id=p_batch_id AND s.id=(r.item->>'id')::uuid
    AND s.state NOT IN ('completed','cancelled');

  UPDATE public.customer_orders SET mise_batch_id=p_batch_id,mise_driver_id=p_driver_id,
    status='assigned',dispatch_version=dispatch_version+1,
    assignment_deadline_at=p_delivery_deadline_at,updated_at=clock_timestamp()
  WHERE id=p_order_id AND dispatch_version=p_expected_order_version AND mise_batch_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_APPEND_CAS_CONFLICT' USING ERRCODE='40001'; END IF;
  UPDATE public.mise_drivers SET current_capacity=current_capacity+1,
    state_version=state_version+1,updated_at=clock_timestamp()
  WHERE id=p_driver_id AND state_version=p_expected_driver_version
    AND current_capacity+1<=max_capacity;
  IF NOT FOUND THEN RAISE EXCEPTION 'DRIVER_APPEND_CAS_CONFLICT' USING ERRCODE='40001'; END IF;
  UPDATE public.mise_delivery_batches SET route_version=route_version+1,
    state_version=state_version+1,delivery_deadline_at=least(delivery_deadline_at,p_delivery_deadline_at),
    updated_at=clock_timestamp()
  WHERE id=p_batch_id AND route_version=p_expected_route_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'BATCH_APPEND_CAS_CONFLICT' USING ERRCODE='40001'; END IF;

  INSERT INTO public.dispatch_route_plans_v2(assignment_id,tenant_id,route_version,input_version,
    state,stops,arrivals,explanation,matrix_fallback_used,action_id,correlation_id)
  VALUES(p_batch_id,p_tenant_id,p_expected_route_version+1,p_expected_route_version+1,
    'active',p_route_stops,p_arrivals,p_explanation,p_matrix_fallback_used,p_action_id,p_correlation_id)
  ON CONFLICT(assignment_id) DO UPDATE SET route_version=excluded.route_version,
    input_version=excluded.input_version,state='active',stops=excluded.stops,
    arrivals=excluded.arrivals,explanation=excluded.explanation,
    matrix_fallback_used=excluded.matrix_fallback_used,action_id=excluded.action_id,
    correlation_id=excluded.correlation_id,updated_at=clock_timestamp();
  INSERT INTO public.dispatch_offer_assignments(tenant_id,order_id,batch_id,driver_id,state,
    decision_id,idempotency_key,action_id,request_fingerprint,expected_order_version,
    assignment_version,lease_expires_at,pickup_deadline_at,delivery_deadline_at,
    algorithm_version,correlation_id)
  VALUES(p_tenant_id,p_order_id,p_batch_id,p_driver_id,'assigned',p_action_id,gen_random_uuid(),
    p_action_id,fingerprint,p_expected_order_version,1,NULL,p_pickup_deadline_at,
    p_delivery_deadline_at,'route-insertion-v1',p_correlation_id)
  RETURNING id INTO v_assignment_id;
  INSERT INTO public.dispatch_offer_audit(decision_id,idempotency_key,order_id,batch_id,
    driver_id,outcome,reason_code,expected_order_version,algorithm_version,details,
    correlation_id,event_type)
  VALUES(gen_random_uuid(),gen_random_uuid(),p_order_id,p_batch_id,p_driver_id,'assigned',
    'ATOMIC_V2_ROUTE_APPEND',p_expected_order_version,'route-insertion-v1',p_explanation,
    p_correlation_id,'route.order_appended');
  INSERT INTO public.mise_push_outbox(driver_id,type,title,body,sound,priority,data)
  VALUES(p_driver_id,'route_updated','Tour aktualisiert','Ein weiterer Stopp wurde eingeplant.',
    'default','high',jsonb_build_object('batch_id',p_batch_id,'assignment_id',v_assignment_id,
      'route_version',p_expected_route_version+1,'correlation_id',p_correlation_id,
      'requires_acceptance',false));
  result:=jsonb_build_object('ok',true,'idempotent_replay',false,'batch_id',p_batch_id,
    'assignment_id',v_assignment_id,'route_version',p_expected_route_version+1,
    'driver_version',p_expected_driver_version+1,'correlation_id',p_correlation_id);
  INSERT INTO public.dispatch_assignment_requests_v2(action_id,tenant_id,request_fingerprint,
    action,correlation_id,result)
  VALUES(p_action_id,p_tenant_id,fingerprint,'route_append',p_correlation_id,result);
  RETURN result;
END $$;

ALTER TABLE public.dispatch_routing_hold_config_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_kitchen_holds_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_kitchen_release_outbox_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_kitchen_hold_audit_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_route_plans_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_routing_hold_config_v2,public.dispatch_kitchen_holds_v2,
  public.dispatch_kitchen_release_outbox_v2,public.dispatch_kitchen_hold_audit_v2
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.dispatch_route_plans_v2 FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.dispatch_routing_hold_config_v2,public.dispatch_kitchen_holds_v2,
  public.dispatch_kitchen_release_outbox_v2,public.dispatch_kitchen_hold_audit_v2
  TO service_role;
GRANT ALL ON public.dispatch_route_plans_v2 TO service_role;
REVOKE ALL ON FUNCTION public.fn_persist_route_plan_v2(
  uuid,uuid,bigint,bigint,jsonb,jsonb,jsonb,boolean,uuid,uuid
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_schedule_kitchen_hold_v2(
  uuid,uuid,bigint,bigint,timestamptz,timestamptz,timestamptz,text,jsonb,uuid,uuid
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_release_kitchen_hold_v2(
  uuid,uuid,bigint,uuid,uuid,text
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_cancel_kitchen_hold_v2(
  uuid,uuid,bigint,uuid
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_watchdog_release_kitchen_holds_v2(integer)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_append_order_to_route_v2(
  uuid,uuid,bigint,uuid,bigint,uuid,bigint,uuid,bigint,uuid,uuid,
  numeric,numeric,numeric,numeric,text,text,timestamptz,timestamptz,
  jsonb,jsonb,jsonb,boolean,uuid,uuid
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_schedule_kitchen_hold_v2(
  uuid,uuid,bigint,bigint,timestamptz,timestamptz,timestamptz,text,jsonb,uuid,uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_release_kitchen_hold_v2(
  uuid,uuid,bigint,uuid,uuid,text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_cancel_kitchen_hold_v2(
  uuid,uuid,bigint,uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_watchdog_release_kitchen_holds_v2(integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_persist_route_plan_v2(
  uuid,uuid,bigint,bigint,jsonb,jsonb,jsonb,boolean,uuid,uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_append_order_to_route_v2(
  uuid,uuid,bigint,uuid,bigint,uuid,bigint,uuid,bigint,uuid,uuid,
  numeric,numeric,numeric,numeric,text,text,timestamptz,timestamptz,
  jsonb,jsonb,jsonb,boolean,uuid,uuid
) TO service_role;
