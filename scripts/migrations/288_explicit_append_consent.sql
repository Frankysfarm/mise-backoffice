-- T13: explicit, expiring driver consent before an atomic route append.
-- Default-off. The accepted proposal and fn_append_order_to_route_v2 execute in
-- the same transaction; append failure leaves the proposal accepted/retryable.

CREATE TABLE IF NOT EXISTS public.dispatch_append_consent_config_v2 (
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
 enabled boolean NOT NULL DEFAULT false,
 max_offer_seconds integer NOT NULL DEFAULT 120 CHECK (max_offer_seconds BETWEEN 15 AND 600),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS public.dispatch_append_proposals_v2 (
 id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 driver_id uuid NOT NULL REFERENCES public.mise_drivers(id),
 batch_id uuid NOT NULL REFERENCES public.mise_delivery_batches(id),
 order_id uuid NOT NULL REFERENCES public.customer_orders(id),
 state text NOT NULL CHECK (state IN ('proposed_append','accepted','expired','cancelled','atomic_append')),
 proposal_version bigint NOT NULL DEFAULT 1,
 expected_driver_version bigint NOT NULL, expected_batch_version bigint NOT NULL,
 expected_route_version bigint NOT NULL, expected_order_version bigint NOT NULL,
 append_payload jsonb NOT NULL CHECK (jsonb_typeof(append_payload)='object'),
 expires_at timestamptz NOT NULL, proposed_action_id uuid NOT NULL UNIQUE,
 consent_action_id uuid UNIQUE, append_action_id uuid UNIQUE,
 correlation_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK ((state='accepted')=(consent_action_id IS NOT NULL AND append_action_id IS NULL)),
 CHECK ((state='atomic_append')=(consent_action_id IS NOT NULL AND append_action_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_append_proposal_live_order
 ON public.dispatch_append_proposals_v2(order_id) WHERE state IN ('proposed_append','accepted');
CREATE TABLE IF NOT EXISTS public.dispatch_append_proposal_requests_v2 (
 action_id uuid PRIMARY KEY,proposal_id uuid NOT NULL,request_fingerprint text NOT NULL,
 action text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.dispatch_append_consent_config_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_append_proposals_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_append_proposal_requests_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_append_consent_config_v2,public.dispatch_append_proposals_v2,
 public.dispatch_append_proposal_requests_v2 FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.dispatch_append_consent_config_v2,public.dispatch_append_proposals_v2,
 public.dispatch_append_proposal_requests_v2 TO service_role;

CREATE OR REPLACE FUNCTION public.fn_create_append_proposal_v2(
 p_tenant_id uuid,p_proposal_id uuid,p_driver_id uuid,p_batch_id uuid,p_order_id uuid,
 p_expected_driver_version bigint,p_expected_batch_version bigint,p_expected_route_version bigint,
 p_expected_order_version bigint,p_append_payload jsonb,p_expires_at timestamptz,
 p_action_id uuid,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE cfg public.dispatch_append_consent_config_v2%ROWTYPE; old public.dispatch_append_proposal_requests_v2%ROWTYPE;
 fp text; result jsonb;
BEGIN
 fp:=md5(concat_ws('|',p_tenant_id,p_proposal_id,p_driver_id,p_batch_id,p_order_id,
  p_expected_driver_version,p_expected_batch_version,p_expected_route_version,p_expected_order_version,
  p_append_payload::text,p_expires_at));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,28801));
 SELECT * INTO old FROM public.dispatch_append_proposal_requests_v2 WHERE action_id=p_action_id;
 IF FOUND THEN IF old.request_fingerprint<>fp OR old.action<>'propose' THEN RETURN jsonb_build_object(
  'ok',false,'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
  RETURN old.result||jsonb_build_object('idempotent_replay',true); END IF;
 SELECT * INTO cfg FROM public.dispatch_append_consent_config_v2 WHERE tenant_id=p_tenant_id;
 IF NOT FOUND OR NOT cfg.enabled THEN RETURN jsonb_build_object('ok',false,'reason_code','APPEND_CONSENT_DEFAULT_OFF'); END IF;
 IF p_expires_at<=clock_timestamp()+interval '15 seconds'
  OR p_expires_at>clock_timestamp()+make_interval(secs=>cfg.max_offer_seconds)
  OR jsonb_typeof(p_append_payload)<>'object' THEN RETURN jsonb_build_object(
  'ok',false,'reason_code','INVALID_PROPOSAL_ENVELOPE'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.mise_drivers WHERE id=p_driver_id AND active
   AND state_version=p_expected_driver_version AND state<>'offline')
  OR NOT EXISTS(SELECT 1 FROM public.mise_delivery_batches WHERE id=p_batch_id AND driver_id=p_driver_id
   AND state_version=p_expected_batch_version AND route_version=p_expected_route_version
   AND state NOT IN ('completed','cancelled'))
  OR NOT EXISTS(SELECT 1 FROM public.customer_orders WHERE id=p_order_id
   AND dispatch_version=p_expected_order_version AND mise_batch_id IS NULL)
 THEN RETURN jsonb_build_object('ok',false,'reason_code','PROPOSAL_VERSION_OR_ELIGIBILITY_CONFLICT'); END IF;
 INSERT INTO public.dispatch_append_proposals_v2(id,tenant_id,driver_id,batch_id,order_id,state,
  expected_driver_version,expected_batch_version,expected_route_version,expected_order_version,
  append_payload,expires_at,proposed_action_id,correlation_id) VALUES(p_proposal_id,p_tenant_id,
  p_driver_id,p_batch_id,p_order_id,'proposed_append',p_expected_driver_version,p_expected_batch_version,
  p_expected_route_version,p_expected_order_version,p_append_payload,p_expires_at,p_action_id,p_correlation_id);
 result:=jsonb_build_object('ok',true,'proposal_id',p_proposal_id,'state','proposed_append',
  'proposal_version',1,'expires_at',p_expires_at,'correlation_id',p_correlation_id);
 INSERT INTO public.dispatch_append_proposal_requests_v2 VALUES(p_action_id,p_proposal_id,fp,'propose',result,now());
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.fn_transition_append_proposal_v2(
 p_proposal_id uuid,p_expected_proposal_version bigint,p_action text,p_actor_driver_id uuid,
 p_action_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE p public.dispatch_append_proposals_v2%ROWTYPE; old public.dispatch_append_proposal_requests_v2%ROWTYPE;
 fp text; effective text; result jsonb;
BEGIN
 IF p_action NOT IN ('accept','cancel','expire') THEN RETURN jsonb_build_object('ok',false,'reason_code','INVALID_ACTION'); END IF;
 fp:=md5(concat_ws('|',p_proposal_id,p_expected_proposal_version,p_action,p_actor_driver_id));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,28801));
 SELECT * INTO old FROM public.dispatch_append_proposal_requests_v2 WHERE action_id=p_action_id;
 IF FOUND THEN IF old.request_fingerprint<>fp OR old.action<>p_action THEN RETURN jsonb_build_object(
  'ok',false,'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
  RETURN old.result||jsonb_build_object('idempotent_replay',true); END IF;
 SELECT * INTO p FROM public.dispatch_append_proposals_v2 WHERE id=p_proposal_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason_code','PROPOSAL_NOT_FOUND'); END IF;
 IF p.proposal_version<>p_expected_proposal_version OR p.state<>'proposed_append' THEN RETURN jsonb_build_object(
  'ok',false,'reason_code','PROPOSAL_VERSION_OR_STATE_CONFLICT','state',p.state,'proposal_version',p.proposal_version); END IF;
 IF p_action='expire' AND p.expires_at>clock_timestamp() THEN RETURN jsonb_build_object(
  'ok',false,'reason_code','PROPOSAL_EXPIRY_NOT_DUE'); END IF;
 effective:=CASE WHEN p.expires_at<=clock_timestamp() THEN 'expire' ELSE p_action END;
 IF effective IN ('accept','cancel') AND p_actor_driver_id IS DISTINCT FROM p.driver_id THEN RETURN jsonb_build_object(
  'ok',false,'reason_code','ACTOR_DRIVER_MISMATCH'); END IF;
 UPDATE public.dispatch_append_proposals_v2 SET state=CASE effective WHEN 'accept' THEN 'accepted'
  WHEN 'cancel' THEN 'cancelled' ELSE 'expired' END,proposal_version=proposal_version+1,
  consent_action_id=CASE WHEN effective='accept' THEN p_action_id ELSE NULL END,updated_at=now() WHERE id=p.id;
 result:=jsonb_build_object('ok',effective=p_action,'proposal_id',p.id,'state',CASE effective
  WHEN 'accept' THEN 'accepted' WHEN 'cancel' THEN 'cancelled' ELSE 'expired' END,
  'proposal_version',p.proposal_version+1,'reason_code',CASE WHEN effective<>p_action THEN 'PROPOSAL_EXPIRED' ELSE NULL END);
 INSERT INTO public.dispatch_append_proposal_requests_v2 VALUES(p_action_id,p.id,fp,p_action,result,now());
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.fn_execute_accepted_append_proposal_v2(
 p_proposal_id uuid,p_expected_proposal_version bigint,p_action_id uuid,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE p public.dispatch_append_proposals_v2%ROWTYPE; x jsonb; old public.dispatch_append_proposal_requests_v2%ROWTYPE;
 fp text; result jsonb;
BEGIN
 fp:=md5(concat_ws('|',p_proposal_id,p_expected_proposal_version));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,28801));
 SELECT * INTO old FROM public.dispatch_append_proposal_requests_v2 WHERE action_id=p_action_id;
 IF FOUND THEN IF old.request_fingerprint<>fp OR old.action<>'atomic_append' THEN RETURN jsonb_build_object(
  'ok',false,'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
  RETURN old.result||jsonb_build_object('idempotent_replay',true); END IF;
 SELECT * INTO p FROM public.dispatch_append_proposals_v2 WHERE id=p_proposal_id FOR UPDATE;
 IF p.state<>'accepted' OR p.proposal_version<>p_expected_proposal_version OR p.expires_at<=clock_timestamp()
  THEN RETURN jsonb_build_object('ok',false,'reason_code','ACCEPTED_PROPOSAL_REQUIRED'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.mise_drivers WHERE id=p.driver_id AND state_version=p.expected_driver_version)
  OR NOT EXISTS(SELECT 1 FROM public.mise_delivery_batches WHERE id=p.batch_id
   AND state_version=p.expected_batch_version AND route_version=p.expected_route_version)
  OR NOT EXISTS(SELECT 1 FROM public.customer_orders WHERE id=p.order_id
   AND dispatch_version=p.expected_order_version AND mise_batch_id IS NULL)
 THEN RETURN jsonb_build_object('ok',false,'reason_code','PROPOSAL_INPUT_VERSION_CONFLICT'); END IF;
 x:=p.append_payload;
 result:=public.fn_append_order_to_route_v2(p.tenant_id,(x->>'writer_id')::uuid,(x->>'writer_epoch')::bigint,
  p.driver_id,p.expected_driver_version,p.batch_id,p.expected_route_version,p.order_id,p.expected_order_version,
  (x->>'pickup_stop_id')::uuid,(x->>'dropoff_stop_id')::uuid,(x->>'pickup_lat')::numeric,
  (x->>'pickup_lng')::numeric,(x->>'dropoff_lat')::numeric,(x->>'dropoff_lng')::numeric,
  x->>'pickup_address',x->>'dropoff_address',(x->>'pickup_deadline_at')::timestamptz,
  (x->>'delivery_deadline_at')::timestamptz,x->'route_stops',x->'arrivals',
  coalesce(x->'explanation','{}'::jsonb),coalesce((x->>'matrix_fallback_used')::boolean,false),
  p_action_id,p_correlation_id);
 IF coalesce((result->>'ok')::boolean,false) IS NOT TRUE THEN RETURN result; END IF;
 IF current_setting('mise.test_append_consent_failpoint',true)='after_append' THEN RAISE EXCEPTION 'T13_FAILPOINT_AFTER_APPEND'; END IF;
 UPDATE public.dispatch_append_proposals_v2 SET state='atomic_append',proposal_version=proposal_version+1,
  append_action_id=p_action_id,correlation_id=p_correlation_id,updated_at=now() WHERE id=p.id;
 result:=result||jsonb_build_object('proposal_id',p.id,'proposal_state','atomic_append',
  'proposal_version',p.proposal_version+1);
 INSERT INTO public.dispatch_append_proposal_requests_v2 VALUES(p_action_id,p.id,fp,'atomic_append',result,now());
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.fn_create_append_proposal_v2(uuid,uuid,uuid,uuid,uuid,bigint,bigint,bigint,bigint,jsonb,timestamptz,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_transition_append_proposal_v2(uuid,bigint,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_execute_accepted_append_proposal_v2(uuid,bigint,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_append_proposal_v2(uuid,uuid,uuid,uuid,uuid,bigint,bigint,bigint,bigint,jsonb,timestamptz,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_transition_append_proposal_v2(uuid,bigint,text,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_execute_accepted_append_proposal_v2(uuid,bigint,uuid,uuid) TO service_role;
