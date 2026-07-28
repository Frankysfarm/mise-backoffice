-- T09 durable operations, security and observability authority. Default-off.
CREATE TABLE IF NOT EXISTS public.ops_tenant_policy_v2 (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  mutation_enabled boolean NOT NULL DEFAULT false,
  observability_enabled boolean NOT NULL DEFAULT false,
  gps_retention_days integer NOT NULL DEFAULT 30 CHECK (gps_retention_days BETWEEN 1 AND 365),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.ops_actor_scopes_v2 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid REFERENCES public.locations(id),
  role text NOT NULL CHECK (role IN ('dispatcher','admin','kitchen')),
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE NULLS NOT DISTINCT(actor_id,tenant_id,role,location_id)
);

CREATE TABLE IF NOT EXISTS public.ops_manual_override_requests_v2 (
  action_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  location_id uuid REFERENCES public.locations(id),
  actor_id uuid NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  target_kind text NOT NULL,
  target_id uuid NOT NULL,
  expected_version bigint NOT NULL,
  request_fingerprint text NOT NULL,
  reason_code text NOT NULL,
  reason_note text NOT NULL,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  result jsonb NOT NULL,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.ops_events_v2 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  correlation_id uuid NOT NULL,
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  reason_code text NOT NULL,
  resource_kind text NOT NULL,
  resource_id_hash text,
  actor_role text NOT NULL,
  actor_id_hash text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_ops_events_v2_tenant_time
  ON public.ops_events_v2(tenant_id,occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.ops_alert_episodes_v2 (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  reason_code text NOT NULL,
  resource_key text NOT NULL,
  state text NOT NULL CHECK (state IN ('open','acknowledged','resolved')),
  severity text NOT NULL CHECK (severity IN ('warning','critical')),
  observed numeric NOT NULL,
  threshold numeric NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  occurrence_count bigint NOT NULL DEFAULT 1,
  correlation_id uuid NOT NULL,
  PRIMARY KEY(tenant_id,reason_code,resource_key)
);

CREATE TABLE IF NOT EXISTS public.ops_worker_heartbeats_v2 (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  worker_name text NOT NULL,
  last_started_at timestamptz NOT NULL,
  last_succeeded_at timestamptz,
  last_failed_at timestamptz,
  last_error_code text,
  correlation_id uuid NOT NULL,
  PRIMARY KEY(tenant_id,worker_name)
);

CREATE OR REPLACE FUNCTION public.fn_ops_manual_override_v2(
  p_tenant_id uuid,p_location_id uuid,p_actor_id uuid,p_actor_role text,
  p_action text,p_target_kind text,p_target_id uuid,p_expected_version bigint,
  p_reason_code text,p_reason_note text,p_action_id uuid,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  old_req public.ops_manual_override_requests_v2%ROWTYPE;
  fingerprint text;
  before_doc jsonb;
  after_doc jsonb;
  result jsonb;
  d public.mise_drivers%ROWTYPE;
  o public.customer_orders%ROWTYPE;
  h public.dispatch_kitchen_holds_v2%ROWTYPE;
  exception_kind text;
BEGIN
  IF p_actor_role NOT IN ('dispatcher','admin') OR p_action_id IS NULL
     OR p_correlation_id IS NULL OR p_reason_code !~ '^[A-Z][A-Z0-9_.-]{2,80}$'
     OR length(trim(p_reason_note))<8 OR length(p_reason_note)>500
     OR p_expected_version<0 THEN
    RETURN jsonb_build_object('ok',false,'reason_code','INVALID_OVERRIDE_ENVELOPE');
  END IF;
  fingerprint:=md5(concat_ws('|',p_tenant_id,p_location_id,p_actor_id,p_actor_role,
    p_action,p_target_kind,p_target_id,p_expected_version,p_reason_code,p_reason_note));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,28301));
  SELECT * INTO old_req FROM public.ops_manual_override_requests_v2
    WHERE action_id=p_action_id;
  IF FOUND THEN
    IF old_req.request_fingerprint<>fingerprint THEN
      RETURN jsonb_build_object('ok',false,
        'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
    END IF;
    RETURN old_req.result||jsonb_build_object('idempotent_replay',true);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ops_tenant_policy_v2
    WHERE tenant_id=p_tenant_id AND mutation_enabled) THEN
    RETURN jsonb_build_object('ok',false,'reason_code','OPS_MUTATION_DEFAULT_OFF');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ops_actor_scopes_v2
    WHERE actor_id=p_actor_id AND tenant_id=p_tenant_id AND role=p_actor_role
      AND enabled AND (location_id IS NULL OR location_id=p_location_id)) THEN
    RETURN jsonb_build_object('ok',false,'reason_code','OPS_ACTOR_SCOPE_FORBIDDEN');
  END IF;
  IF p_location_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.locations
    WHERE id=p_location_id AND tenant_id=p_tenant_id) THEN
    RETURN jsonb_build_object('ok',false,'reason_code','OPS_LOCATION_SCOPE_FORBIDDEN');
  END IF;

  IF p_action IN ('DRIVER_ACCIDENT','VEHICLE_PROBLEM','DRIVER_UNREACHABLE',
      'GPS_DEVICE_PROBLEM','SHIFT_END_ACTIVE','TOUR_INTERRUPT','REASSIGN_ESCALATE') THEN
    SELECT * INTO d FROM public.mise_drivers WHERE id=p_target_id FOR UPDATE;
    IF NOT FOUND OR d.state_version<>p_expected_version OR NOT EXISTS(
      SELECT 1 FROM public.mise_driver_tenants WHERE driver_id=d.id
        AND tenant_id=p_tenant_id AND status='active') THEN
      RETURN jsonb_build_object('ok',false,'reason_code','DRIVER_VERSION_OR_SCOPE_CONFLICT');
    END IF;
    before_doc:=jsonb_build_object('driver_id',d.id,'state',d.state,
      'state_version',d.state_version);
    exception_kind:=CASE p_action
      WHEN 'DRIVER_ACCIDENT' THEN 'medical_safety_emergency'
      WHEN 'VEHICLE_PROBLEM' THEN 'vehicle_failure'
      WHEN 'GPS_DEVICE_PROBLEM' THEN 'location_permission_gps_failure'
      WHEN 'SHIFT_END_ACTIVE' THEN 'shift_invalid'
      ELSE 'network_device_failure' END;
    INSERT INTO public.driver_action_requests_v2(action_id,tenant_id,driver_id,
      action,target_id,request_fingerprint,correlation_id,result)
    VALUES(p_action_id,p_tenant_id,d.id,'manual_exception',d.id,fingerprint,
      p_correlation_id,jsonb_build_object('ok',true,'source','ops_override'));
    INSERT INTO public.driver_exceptions_v2(tenant_id,driver_id,kind,state,note,
      action_id,correlation_id)
    VALUES(p_tenant_id,d.id,exception_kind,'reassignment_required',
      p_reason_note,p_action_id,p_correlation_id);
    UPDATE public.mise_drivers SET state_version=state_version+1,
      updated_at=clock_timestamp() WHERE id=d.id;
    after_doc:=before_doc||jsonb_build_object('state_version',d.state_version+1,
      'exception_state','reassignment_required','exception_kind',exception_kind);
  ELSIF p_action IN ('ORDER_CANCEL','KITCHEN_CANNOT_FULFILL') THEN
    SELECT * INTO o FROM public.customer_orders WHERE id=p_target_id FOR UPDATE;
    IF NOT FOUND OR o.tenant_id<>p_tenant_id OR o.location_id IS DISTINCT FROM p_location_id
       OR o.dispatch_version<>p_expected_version THEN
      RETURN jsonb_build_object('ok',false,'reason_code','ORDER_VERSION_OR_SCOPE_CONFLICT');
    END IF;
    before_doc:=jsonb_build_object('order_id',o.id,'status',o.status,
      'dispatch_version',o.dispatch_version);
    UPDATE public.customer_orders SET status='cancelled',
      dispatch_version=dispatch_version+1,updated_at=clock_timestamp() WHERE id=o.id;
    IF EXISTS(SELECT 1 FROM public.dispatch_kitchen_holds_v2
      WHERE order_id=o.id AND state='held') THEN
      SELECT * INTO h FROM public.dispatch_kitchen_holds_v2 WHERE order_id=o.id;
      PERFORM public.fn_cancel_kitchen_hold_v2(
        p_tenant_id,o.id,h.hold_version,gen_random_uuid());
    END IF;
    after_doc:=jsonb_build_object('order_id',o.id,'status','cancelled',
      'dispatch_version',o.dispatch_version+1);
  ELSIF p_action='KITCHEN_RELEASE_NOW' THEN
    SELECT * INTO h FROM public.dispatch_kitchen_holds_v2
      WHERE order_id=p_target_id FOR UPDATE;
    IF NOT FOUND OR h.tenant_id<>p_tenant_id OR h.hold_version<>p_expected_version THEN
      RETURN jsonb_build_object('ok',false,'reason_code','HOLD_VERSION_OR_SCOPE_CONFLICT');
    END IF;
    before_doc:=jsonb_build_object('order_id',h.order_id,'state',h.state,
      'hold_version',h.hold_version);
    result:=public.fn_release_kitchen_hold_v2(p_tenant_id,h.order_id,h.hold_version,
      p_action_id,p_correlation_id,'MANUAL_KITCHEN_RELEASE');
    IF NOT coalesce((result->>'ok')::boolean,false) THEN RETURN result; END IF;
    after_doc:=jsonb_build_object('order_id',h.order_id,'state','released',
      'hold_version',h.hold_version+1);
  ELSE
    RETURN jsonb_build_object('ok',false,'reason_code','OVERRIDE_ACTION_UNSUPPORTED');
  END IF;
  result:=jsonb_build_object('ok',true,'action',p_action,'target_id',p_target_id,
    'before',before_doc,'after',after_doc,'correlation_id',p_correlation_id,
    'idempotent_replay',false);
  INSERT INTO public.ops_manual_override_requests_v2(action_id,tenant_id,location_id,
    actor_id,actor_role,action,target_kind,target_id,expected_version,
    request_fingerprint,reason_code,reason_note,before_state,after_state,result,
    correlation_id)
  VALUES(p_action_id,p_tenant_id,p_location_id,p_actor_id,p_actor_role,p_action,
    p_target_kind,p_target_id,p_expected_version,fingerprint,p_reason_code,
    p_reason_note,before_doc,after_doc,result,p_correlation_id);
  INSERT INTO public.ops_events_v2(tenant_id,correlation_id,event_type,severity,
    reason_code,resource_kind,resource_id_hash,actor_role,actor_id_hash,attributes)
  VALUES(p_tenant_id,p_correlation_id,'operations.manual_override','warning',
    p_reason_code,p_target_kind,substr(encode(digest(p_target_id::text,'sha256'),'hex'),1,20),
    p_actor_role,substr(encode(digest(p_actor_id::text,'sha256'),'hex'),1,20),
    jsonb_build_object('action',p_action,'before',before_doc,'after',after_doc));
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.fn_ops_record_alert_v2(
  p_tenant_id uuid,p_reason_code text,p_resource_key text,p_severity text,
  p_observed numeric,p_threshold numeric,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.ops_tenant_policy_v2
    WHERE tenant_id=p_tenant_id AND observability_enabled) THEN
    RETURN jsonb_build_object('ok',false,'reason_code','OBSERVABILITY_DEFAULT_OFF');
  END IF;
  INSERT INTO public.ops_alert_episodes_v2(tenant_id,reason_code,resource_key,state,
    severity,observed,threshold,correlation_id)
  VALUES(p_tenant_id,p_reason_code,p_resource_key,'open',p_severity,p_observed,
    p_threshold,p_correlation_id)
  ON CONFLICT(tenant_id,reason_code,resource_key) DO UPDATE SET
    last_seen_at=clock_timestamp(),occurrence_count=ops_alert_episodes_v2.occurrence_count+1,
    severity=excluded.severity,observed=excluded.observed,threshold=excluded.threshold,
    correlation_id=excluded.correlation_id,
    state=CASE WHEN ops_alert_episodes_v2.state='resolved' THEN 'open'
      ELSE ops_alert_episodes_v2.state END;
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.fn_ops_prune_gps_v2(
  p_tenant_id uuid,p_now timestamptz DEFAULT clock_timestamp()
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n bigint;
BEGIN
  DELETE FROM public.mise_driver_position_history h
  USING public.ops_tenant_policy_v2 p
  WHERE p.tenant_id=p_tenant_id AND h.tenant_id=p.tenant_id
    AND h.received_at<p_now-make_interval(days=>p.gps_retention_days);
  GET DIAGNOSTICS n=ROW_COUNT;
  RETURN n;
END $$;

ALTER TABLE public.ops_tenant_policy_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_actor_scopes_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_manual_override_requests_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_events_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_alert_episodes_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_worker_heartbeats_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_tenant_policy_v2,public.ops_actor_scopes_v2,
  public.ops_manual_override_requests_v2,public.ops_events_v2,
  public.ops_alert_episodes_v2,public.ops_worker_heartbeats_v2
  FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ops_tenant_policy_v2,public.ops_actor_scopes_v2,
  public.ops_manual_override_requests_v2,public.ops_events_v2,
  public.ops_alert_episodes_v2,public.ops_worker_heartbeats_v2 TO service_role;
REVOKE ALL ON FUNCTION public.fn_ops_manual_override_v2(
  uuid,uuid,uuid,text,text,text,uuid,bigint,text,text,uuid,uuid
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_record_alert_v2(
  uuid,text,text,text,numeric,numeric,uuid
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_prune_gps_v2(uuid,timestamptz)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_manual_override_v2(
  uuid,uuid,uuid,text,text,text,uuid,bigint,text,text,uuid,uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_record_alert_v2(
  uuid,text,text,text,numeric,numeric,uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_prune_gps_v2(uuid,timestamptz)
  TO service_role;
