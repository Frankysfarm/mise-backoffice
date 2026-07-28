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
  UPDATE public.dispatch_kitchen_holds_v2 SET state='released',hold_version=hold_version+1,
    release_action_id=p_action_id,released_at=clock_timestamp(),reason_code=p_reason_code,
    correlation_id=p_correlation_id,updated_at=clock_timestamp() WHERE order_id=p_order_id;
  INSERT INTO public.dispatch_kitchen_release_outbox_v2(order_id,tenant_id,action_id,correlation_id,payload)
  VALUES(p_order_id,p_tenant_id,p_action_id,p_correlation_id,
    jsonb_build_object('type','kitchen_release','order_id',p_order_id,'reason_code',p_reason_code))
  ON CONFLICT(order_id) DO NOTHING;
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
    r:=public.fn_release_kitchen_hold_v2(h.tenant_id,h.order_id,h.hold_version,
      gen_random_uuid(),h.correlation_id,'WATCHDOG_DEADLINE');
    IF (r->>'ok')::boolean THEN n:=n+1; END IF;
  END LOOP;
  RETURN n;
END $$;

ALTER TABLE public.dispatch_routing_hold_config_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_kitchen_holds_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_kitchen_release_outbox_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_route_plans_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_routing_hold_config_v2,public.dispatch_kitchen_holds_v2,
  public.dispatch_kitchen_release_outbox_v2 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.dispatch_route_plans_v2 FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.dispatch_routing_hold_config_v2,public.dispatch_kitchen_holds_v2,
  public.dispatch_kitchen_release_outbox_v2 TO service_role;
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
