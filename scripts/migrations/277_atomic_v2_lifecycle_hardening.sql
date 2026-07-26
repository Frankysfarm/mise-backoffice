-- T02 review hardening. Idempotent replacement of lifecycle RPCs.
-- Multi-order lifecycle remains explicitly default-off until a canonical
-- shared-trip transition contract is approved.

DROP FUNCTION IF EXISTS public.fn_dispatch_cancel_order_v2(
  uuid, uuid, bigint, uuid, text
);
DROP FUNCTION IF EXISTS public.fn_dispatch_reassign_before_pickup_v2(
  uuid, uuid, bigint, bigint, uuid, bigint, uuid, bigint,
  uuid, uuid, text, text
);
DROP FUNCTION IF EXISTS public.fn_dispatch_complete_delivery_v2(
  uuid, uuid, bigint, bigint, uuid
);

CREATE OR REPLACE FUNCTION public.fn_dispatch_test_failpoint_v2(p_step text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp
AS $$
BEGIN
  IF current_setting('t02.enable_failpoints',true)='on'
     AND current_setting('t02.failpoint',true)=p_step THEN
    RAISE EXCEPTION 'T02_INJECTED_FAILURE_AFTER_%', p_step;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_pickup_assignment_v2(
  p_tenant_id uuid, p_order_id uuid,
  p_expected_order_version bigint, p_expected_assignment_version bigint,
  p_expected_batch_version bigint, p_expected_driver_version bigint,
  p_actor_driver_id uuid, p_action_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_order public.customer_orders%ROWTYPE;
  v_assignment public.dispatch_offer_assignments%ROWTYPE;
  v_batch public.mise_delivery_batches%ROWTYPE;
  v_driver public.mise_drivers%ROWTYPE;
  v_existing public.dispatch_assignment_requests_v2%ROWTYPE;
  v_fp text := md5(pg_catalog.concat_ws('|', p_tenant_id::text, p_order_id::text,
    p_expected_order_version::text, p_expected_assignment_version::text,
    p_expected_batch_version::text, p_expected_driver_version::text,
    p_actor_driver_id::text));
  v_corr uuid := gen_random_uuid();
  v_result jsonb;
BEGIN
  IF p_action_id IS NULL OR p_actor_driver_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'MISSING_ACTION_OR_ACTOR');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_action_id::text, 27602));
  SELECT * INTO v_existing FROM public.dispatch_assignment_requests_v2
  WHERE action_id = p_action_id;
  IF FOUND THEN
    IF v_existing.request_fingerprint <> v_fp THEN
      RETURN jsonb_build_object('ok', false,
        'reason_code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
    END IF;
    RETURN v_existing.result || jsonb_build_object('idempotent_replay', true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text, 27601));
  SELECT * INTO v_order FROM public.customer_orders WHERE id = p_order_id FOR UPDATE;
  SELECT * INTO v_assignment FROM public.dispatch_offer_assignments
    WHERE order_id = p_order_id AND state = 'assigned' FOR UPDATE;
  IF NOT FOUND OR v_assignment.tenant_id IS DISTINCT FROM p_tenant_id
     OR v_assignment.driver_id IS DISTINCT FROM p_actor_driver_id
     OR v_order.id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.locations l
       WHERE l.id = v_order.location_id AND l.tenant_id = p_tenant_id)
     OR v_order.mise_batch_id IS DISTINCT FROM v_assignment.batch_id
     OR v_order.mise_driver_id IS DISTINCT FROM v_assignment.driver_id
     OR NOT EXISTS (SELECT 1 FROM public.mise_driver_tenants dt
       WHERE dt.driver_id = p_actor_driver_id AND dt.tenant_id = p_tenant_id
         AND dt.status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'TENANT_OR_ACTOR_AUTHORITY_MISMATCH');
  END IF;
  IF (SELECT count(*) FROM public.dispatch_offer_assignments a
      WHERE a.batch_id = v_assignment.batch_id
        AND a.state IN ('assigned', 'picked_up', 'in_progress')) <> 1 THEN
    RETURN jsonb_build_object('ok', false,
      'reason_code', 'MULTI_ORDER_LIFECYCLE_DEFAULT_OFF');
  END IF;
  SELECT * INTO v_batch FROM public.mise_delivery_batches
    WHERE id = v_assignment.batch_id FOR UPDATE;
  SELECT * INTO v_driver FROM public.mise_drivers
    WHERE id = v_assignment.driver_id FOR UPDATE;
  IF v_order.status::text <> 'assigned' OR v_batch.state <> 'assigned'
     OR v_driver.state <> 'assigned' THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'EXPECTED_STATE_CONFLICT');
  END IF;
  IF v_order.dispatch_version <> p_expected_order_version
     OR v_assignment.assignment_version <> p_expected_assignment_version
     OR v_batch.state_version <> p_expected_batch_version
     OR v_driver.state_version <> p_expected_driver_version THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'EXPECTED_VERSION_CONFLICT');
  END IF;
  UPDATE public.dispatch_offer_assignments SET state = 'picked_up',
    assignment_version = assignment_version + 1, updated_at = now()
    WHERE id = v_assignment.id AND state = 'assigned'
      AND assignment_version = p_expected_assignment_version;
  PERFORM public.fn_dispatch_test_failpoint_v2('pickup.assignment');
  UPDATE public.mise_delivery_batch_stops SET state = 'completed',
    completed_at = coalesce(completed_at, now()), stop_version = stop_version + 1
    WHERE batch_id = v_assignment.batch_id AND order_id = p_order_id
      AND type = 'pickup' AND state = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'PICKUP_STOP_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('pickup.stops');
  UPDATE public.mise_delivery_batches SET state = 'at_pickup',
    state_version = state_version + 1, picked_up_at = now(), updated_at = now()
    WHERE id = v_batch.id AND state = 'assigned'
      AND state_version = p_expected_batch_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'PICKUP_BATCH_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('pickup.batch');
  UPDATE public.customer_orders SET status = 'picked_up',
    dispatch_version = dispatch_version + 1, updated_at = now()
    WHERE id = p_order_id AND status::text = 'assigned'
      AND dispatch_version = p_expected_order_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'PICKUP_ORDER_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('pickup.order');
  UPDATE public.mise_drivers SET state = 'at_pickup',
    state_version = state_version + 1, updated_at = now()
    WHERE id = v_driver.id AND state = 'assigned'
      AND state_version = p_expected_driver_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'PICKUP_DRIVER_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('pickup.driver');
  INSERT INTO public.dispatch_offer_audit (
    decision_id,idempotency_key,order_id,batch_id,driver_id,outcome,reason_code,
    expected_order_version,algorithm_version,details,correlation_id,event_type
  ) VALUES (gen_random_uuid(), p_action_id, p_order_id, v_batch.id, v_driver.id,
    'assigned', 'PICKUP_CONFIRMED', p_expected_order_version, 'atomic-v2',
    '{}'::jsonb, v_corr, 'assignment.picked_up');
  PERFORM public.fn_dispatch_test_failpoint_v2('pickup.audit');
  v_result := jsonb_build_object('ok', true, 'state', 'picked_up',
    'assignment_version', p_expected_assignment_version + 1,
    'order_version', p_expected_order_version + 1,
    'batch_version', p_expected_batch_version + 1,
    'driver_version', p_expected_driver_version + 1, 'correlation_id', v_corr);
  INSERT INTO public.dispatch_assignment_requests_v2
    (action_id,tenant_id,request_fingerprint,action,correlation_id,result)
  VALUES (p_action_id,p_tenant_id,v_fp,'confirm_pickup',v_corr,v_result);
  PERFORM public.fn_dispatch_test_failpoint_v2('pickup.request');
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_start_delivery_v2(
  p_tenant_id uuid, p_order_id uuid,
  p_expected_order_version bigint, p_expected_assignment_version bigint,
  p_expected_batch_version bigint, p_expected_driver_version bigint,
  p_actor_driver_id uuid, p_action_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_order public.customer_orders%ROWTYPE;
  v_assignment public.dispatch_offer_assignments%ROWTYPE;
  v_batch public.mise_delivery_batches%ROWTYPE;
  v_driver public.mise_drivers%ROWTYPE;
  v_existing public.dispatch_assignment_requests_v2%ROWTYPE;
  v_fp text := md5(pg_catalog.concat_ws('|', p_tenant_id::text, p_order_id::text,
    p_expected_order_version::text, p_expected_assignment_version::text,
    p_expected_batch_version::text, p_expected_driver_version::text,
    p_actor_driver_id::text));
  v_corr uuid := gen_random_uuid();
  v_result jsonb;
BEGIN
  IF p_action_id IS NULL OR p_actor_driver_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'MISSING_ACTION_OR_ACTOR');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_action_id::text, 27602));
  SELECT * INTO v_existing FROM public.dispatch_assignment_requests_v2
    WHERE action_id = p_action_id;
  IF FOUND THEN
    IF v_existing.request_fingerprint <> v_fp THEN
      RETURN jsonb_build_object('ok', false,
        'reason_code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
    END IF;
    RETURN v_existing.result || jsonb_build_object('idempotent_replay', true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text, 27601));
  SELECT * INTO v_order FROM public.customer_orders WHERE id=p_order_id FOR UPDATE;
  SELECT * INTO v_assignment FROM public.dispatch_offer_assignments
    WHERE order_id=p_order_id AND state='picked_up' FOR UPDATE;
  IF NOT FOUND OR v_assignment.tenant_id IS DISTINCT FROM p_tenant_id
     OR v_assignment.driver_id IS DISTINCT FROM p_actor_driver_id
     OR v_order.mise_batch_id IS DISTINCT FROM v_assignment.batch_id
     OR v_order.mise_driver_id IS DISTINCT FROM v_assignment.driver_id
     OR NOT EXISTS (SELECT 1 FROM public.locations l
       WHERE l.id=v_order.location_id AND l.tenant_id=p_tenant_id)
     OR NOT EXISTS (SELECT 1 FROM public.mise_driver_tenants dt
       WHERE dt.driver_id=p_actor_driver_id AND dt.tenant_id=p_tenant_id
         AND dt.status='active') THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'TENANT_OR_ACTOR_AUTHORITY_MISMATCH');
  END IF;
  IF (SELECT count(*) FROM public.dispatch_offer_assignments a
      WHERE a.batch_id=v_assignment.batch_id
        AND a.state IN ('assigned','picked_up','in_progress')) <> 1 THEN
    RETURN jsonb_build_object('ok', false,
      'reason_code', 'MULTI_ORDER_LIFECYCLE_DEFAULT_OFF');
  END IF;
  SELECT * INTO v_batch FROM public.mise_delivery_batches
    WHERE id=v_assignment.batch_id FOR UPDATE;
  SELECT * INTO v_driver FROM public.mise_drivers
    WHERE id=v_assignment.driver_id FOR UPDATE;
  IF v_order.status::text <> 'picked_up' OR v_batch.state <> 'at_pickup'
     OR v_driver.state <> 'at_pickup' THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'EXPECTED_STATE_CONFLICT');
  END IF;
  IF v_order.dispatch_version<>p_expected_order_version
     OR v_assignment.assignment_version<>p_expected_assignment_version
     OR v_batch.state_version<>p_expected_batch_version
     OR v_driver.state_version<>p_expected_driver_version THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'EXPECTED_VERSION_CONFLICT');
  END IF;
  IF EXISTS (SELECT 1 FROM public.mise_delivery_batch_stops
    WHERE batch_id=v_batch.id AND type='pickup' AND state<>'completed') THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'PICKUP_NOT_COMPLETE');
  END IF;
  UPDATE public.dispatch_offer_assignments SET state='in_progress',
    assignment_version=assignment_version+1,updated_at=now()
    WHERE id=v_assignment.id AND state='picked_up'
      AND assignment_version=p_expected_assignment_version;
  PERFORM public.fn_dispatch_test_failpoint_v2('start.assignment');
  UPDATE public.mise_delivery_batches SET state='in_progress',
    state_version=state_version+1,updated_at=now()
    WHERE id=v_batch.id AND state='at_pickup'
      AND state_version=p_expected_batch_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'START_BATCH_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('start.batch');
  UPDATE public.customer_orders SET status='out_for_delivery',
    dispatch_version=dispatch_version+1,updated_at=now()
    WHERE id=p_order_id AND status::text='picked_up'
      AND dispatch_version=p_expected_order_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'START_ORDER_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('start.order');
  UPDATE public.mise_drivers SET state='delivering',
    state_version=state_version+1,updated_at=now()
    WHERE id=v_driver.id AND state='at_pickup'
      AND state_version=p_expected_driver_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'START_DRIVER_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('start.driver');
  INSERT INTO public.dispatch_offer_audit (
    decision_id,idempotency_key,order_id,batch_id,driver_id,outcome,reason_code,
    expected_order_version,algorithm_version,details,correlation_id,event_type
  ) VALUES (gen_random_uuid(),p_action_id,p_order_id,v_batch.id,v_driver.id,
    'assigned','DELIVERY_STARTED',p_expected_order_version,'atomic-v2',
    '{}'::jsonb,v_corr,'assignment.in_progress');
  PERFORM public.fn_dispatch_test_failpoint_v2('start.audit');
  v_result:=jsonb_build_object('ok',true,'state','in_progress',
    'assignment_version',p_expected_assignment_version+1,
    'order_version',p_expected_order_version+1,
    'batch_version',p_expected_batch_version+1,
    'driver_version',p_expected_driver_version+1,'correlation_id',v_corr);
  INSERT INTO public.dispatch_assignment_requests_v2
    (action_id,tenant_id,request_fingerprint,action,correlation_id,result)
  VALUES (p_action_id,p_tenant_id,v_fp,'start_delivery',v_corr,v_result);
  PERFORM public.fn_dispatch_test_failpoint_v2('start.request');
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_cancel_order_v2(
  p_tenant_id uuid, p_order_id uuid,
  p_expected_order_version bigint, p_expected_assignment_version bigint,
  p_expected_batch_version bigint, p_expected_driver_version bigint,
  p_writer_id uuid, p_writer_epoch bigint, p_action_id uuid, p_reason_code text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_order public.customer_orders%ROWTYPE;
  v_assignment public.dispatch_offer_assignments%ROWTYPE;
  v_batch public.mise_delivery_batches%ROWTYPE;
  v_driver public.mise_drivers%ROWTYPE;
  v_gate public.dispatch_writer_gates%ROWTYPE;
  v_existing public.dispatch_assignment_requests_v2%ROWTYPE;
  v_fp text:=md5(pg_catalog.concat_ws('|',p_tenant_id::text,p_order_id::text,
    p_expected_order_version::text,p_expected_assignment_version::text,
    p_expected_batch_version::text,p_expected_driver_version::text,
    p_writer_id::text,p_writer_epoch::text,p_reason_code));
  v_corr uuid:=gen_random_uuid();
  v_result jsonb;
BEGIN
  IF p_action_id IS NULL OR p_writer_id IS NULL OR btrim(coalesce(p_reason_code,''))='' THEN
    RETURN jsonb_build_object('ok',false,'reason_code','MISSING_MUTATION_ENVELOPE');
  END IF;
  IF coalesce(current_setting('t02.race_barrier',true),'')<>'' AND
     pg_catalog.to_regprocedure('public.fn_t02_race_barrier(text)') IS NOT NULL THEN
    EXECUTE 'SELECT public.fn_t02_race_barrier($1)'
    USING current_setting('t02.race_barrier',true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_action_id::text,27602));
  SELECT * INTO v_existing FROM public.dispatch_assignment_requests_v2
    WHERE action_id=p_action_id;
  IF FOUND THEN
    IF v_existing.request_fingerprint<>v_fp THEN RETURN jsonb_build_object(
      'ok',false,'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
    RETURN v_existing.result||jsonb_build_object('idempotent_replay',true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text,27601));
  SELECT * INTO v_gate FROM public.dispatch_writer_gates
    WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND OR NOT v_gate.enabled OR v_gate.writer<>'atomic_v2'
     OR v_gate.active_writer_id IS DISTINCT FROM p_writer_id
     OR v_gate.writer_epoch<>p_writer_epoch
     OR v_gate.lease_expires_at<=clock_timestamp() THEN
    RETURN jsonb_build_object('ok',false,'reason_code','WRITER_LEASE_STALE_OR_NOT_OWNER');
  END IF;
  SELECT * INTO v_order FROM public.customer_orders WHERE id=p_order_id FOR UPDATE;
  SELECT * INTO v_assignment FROM public.dispatch_offer_assignments
    WHERE order_id=p_order_id AND state IN ('assigned','picked_up','in_progress') FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object(
    'ok',false,'reason_code','ACTIVE_ASSIGNMENT_NOT_FOUND'); END IF;
  IF v_assignment.state<>'assigned' THEN RETURN jsonb_build_object(
    'ok',false,'reason_code','POST_PICKUP_CANCELLATION_NOT_SUPPORTED'); END IF;
  IF v_assignment.tenant_id IS DISTINCT FROM p_tenant_id OR v_order.id IS NULL
     OR v_order.status::text<>'assigned'
     OR v_order.mise_batch_id IS DISTINCT FROM v_assignment.batch_id
     OR v_order.mise_driver_id IS DISTINCT FROM v_assignment.driver_id
     OR NOT EXISTS (SELECT 1 FROM public.locations l
       WHERE l.id=v_order.location_id AND l.tenant_id=p_tenant_id)
     OR NOT EXISTS (SELECT 1 FROM public.mise_driver_tenants dt
       WHERE dt.driver_id=v_assignment.driver_id AND dt.tenant_id=p_tenant_id
         AND dt.status='active') THEN
    RETURN jsonb_build_object('ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH');
  END IF;
  IF (SELECT count(*) FROM public.dispatch_offer_assignments a
      WHERE a.batch_id=v_assignment.batch_id
        AND a.state IN ('assigned','picked_up','in_progress'))<>1 THEN
    RETURN jsonb_build_object('ok',false,
      'reason_code','MULTI_ORDER_LIFECYCLE_DEFAULT_OFF');
  END IF;
  SELECT * INTO v_batch FROM public.mise_delivery_batches WHERE id=v_assignment.batch_id FOR UPDATE;
  SELECT * INTO v_driver FROM public.mise_drivers WHERE id=v_assignment.driver_id FOR UPDATE;
  IF v_order.dispatch_version<>p_expected_order_version
     OR v_assignment.assignment_version<>p_expected_assignment_version
     OR v_batch.state_version<>p_expected_batch_version
     OR v_driver.state_version<>p_expected_driver_version THEN
    RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_VERSION_CONFLICT');
  END IF;
  UPDATE public.dispatch_offer_assignments SET state='cancelled',
    assignment_version=assignment_version+1,updated_at=now()
    WHERE id=v_assignment.id AND state='assigned'
      AND assignment_version=p_expected_assignment_version;
  PERFORM public.fn_dispatch_test_failpoint_v2('cancel.assignment');
  UPDATE public.mise_delivery_batch_stops SET state='cancelled',
    stop_version=stop_version+1 WHERE batch_id=v_batch.id
      AND order_id=p_order_id AND state IN ('pending','arrived','servicing');
  PERFORM public.fn_dispatch_test_failpoint_v2('cancel.stops');
  UPDATE public.mise_delivery_batches SET state='cancelled',
    state_version=state_version+1,cancelled_at=now(),updated_at=now()
    WHERE id=v_batch.id AND state='assigned'
      AND state_version=p_expected_batch_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'CANCEL_BATCH_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('cancel.batch');
  UPDATE public.customer_orders SET status='cancelled',mise_batch_id=NULL,
    mise_driver_id=NULL,assignment_deadline_at=NULL,
    dispatch_version=dispatch_version+1,updated_at=now()
    WHERE id=p_order_id AND status::text='assigned'
      AND dispatch_version=p_expected_order_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'CANCEL_ORDER_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('cancel.order');
  UPDATE public.mise_drivers SET state='idle',current_capacity=current_capacity-1,
    state_version=state_version+1,updated_at=now()
    WHERE id=v_driver.id AND current_capacity=1
      AND state_version=p_expected_driver_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'CANCEL_DRIVER_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('cancel.driver');
  INSERT INTO public.dispatch_offer_audit (
    decision_id,idempotency_key,order_id,batch_id,driver_id,outcome,reason_code,
    expected_order_version,algorithm_version,details,correlation_id,event_type
  ) VALUES (gen_random_uuid(),p_action_id,p_order_id,v_batch.id,v_driver.id,
    'cancelled',p_reason_code,p_expected_order_version,'atomic-v2','{}'::jsonb,
    v_corr,'assignment.cancelled');
  PERFORM public.fn_dispatch_test_failpoint_v2('cancel.audit');
  INSERT INTO public.mise_push_outbox(driver_id,type,title,body,sound,priority,data)
  VALUES(v_driver.id,'assignment_cancelled','Tour storniert',
    'Die Zuweisung wurde serverseitig storniert.','default','high',
    jsonb_build_object('assignment_id',v_assignment.id,'order_id',p_order_id,
      'correlation_id',v_corr));
  PERFORM public.fn_dispatch_test_failpoint_v2('cancel.outbox');
  v_result:=jsonb_build_object('ok',true,'state','cancelled',
    'assignment_version',p_expected_assignment_version+1,
    'order_version',p_expected_order_version+1,
    'batch_version',p_expected_batch_version+1,
    'driver_version',p_expected_driver_version+1,'correlation_id',v_corr);
  INSERT INTO public.dispatch_assignment_requests_v2
    (action_id,tenant_id,request_fingerprint,action,correlation_id,result)
  VALUES(p_action_id,p_tenant_id,v_fp,'cancel',v_corr,v_result);
  PERFORM public.fn_dispatch_test_failpoint_v2('cancel.request');
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_reassign_before_pickup_v2(
  p_tenant_id uuid,p_order_id uuid,
  p_expected_order_version bigint,p_expected_assignment_version bigint,
  p_expected_batch_version bigint,p_expected_old_driver_version bigint,
  p_new_driver_id uuid,p_expected_new_driver_version bigint,
  p_writer_id uuid,p_writer_epoch bigint,
  p_action_id uuid,p_actor_id uuid,p_reason_code text,p_note text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp
AS $$
DECLARE
  v_order public.customer_orders%ROWTYPE;
  v_old public.dispatch_offer_assignments%ROWTYPE;
  v_batch public.mise_delivery_batches%ROWTYPE;
  v_old_driver public.mise_drivers%ROWTYPE;
  v_new_driver public.mise_drivers%ROWTYPE;
  v_gate public.dispatch_writer_gates%ROWTYPE;
  v_existing public.dispatch_assignment_requests_v2%ROWTYPE;
  v_new_batch uuid; v_new_assignment uuid; v_corr uuid:=gen_random_uuid();
  v_result jsonb;
  v_fp text:=md5(pg_catalog.concat_ws('|',p_tenant_id::text,p_order_id::text,
    p_expected_order_version::text,p_expected_assignment_version::text,
    p_expected_batch_version::text,p_expected_old_driver_version::text,
    p_new_driver_id::text,p_expected_new_driver_version::text,p_writer_id::text,
    p_writer_epoch::text,p_actor_id::text,p_reason_code,p_note));
BEGIN
  IF p_action_id IS NULL OR p_actor_id IS NULL OR p_writer_id IS NULL
     OR btrim(coalesce(p_reason_code,''))=''
     OR btrim(coalesce(p_note,''))='' THEN RETURN jsonb_build_object(
       'ok',false,'reason_code','MANUAL_OVERRIDE_EVIDENCE_MISSING'); END IF;
  IF coalesce(current_setting('t02.race_barrier',true),'')<>'' AND
     pg_catalog.to_regprocedure('public.fn_t02_race_barrier(text)') IS NOT NULL THEN
    EXECUTE 'SELECT public.fn_t02_race_barrier($1)'
    USING current_setting('t02.race_barrier',true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_action_id::text,27602));
  SELECT * INTO v_existing FROM public.dispatch_assignment_requests_v2
    WHERE action_id=p_action_id;
  IF FOUND THEN
    IF v_existing.request_fingerprint<>v_fp THEN RETURN jsonb_build_object(
      'ok',false,'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
    RETURN v_existing.result||jsonb_build_object('idempotent_replay',true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text,27601));
  SELECT * INTO v_gate FROM public.dispatch_writer_gates
    WHERE tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND OR NOT v_gate.enabled OR v_gate.writer<>'atomic_v2'
     OR v_gate.active_writer_id IS DISTINCT FROM p_writer_id
     OR v_gate.writer_epoch<>p_writer_epoch
     OR v_gate.lease_expires_at<=clock_timestamp() THEN
    RETURN jsonb_build_object('ok',false,
      'reason_code','WRITER_LEASE_STALE_OR_NOT_OWNER');
  END IF;
  SELECT * INTO v_order FROM public.customer_orders WHERE id=p_order_id FOR UPDATE;
  SELECT * INTO v_old FROM public.dispatch_offer_assignments WHERE order_id=p_order_id
    AND state IN ('assigned','picked_up','in_progress') FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object(
    'ok',false,'reason_code','ACTIVE_ASSIGNMENT_NOT_FOUND'); END IF;
  IF v_old.state<>'assigned' THEN RETURN jsonb_build_object(
    'ok',false,'reason_code','POST_PICKUP_REASSIGNMENT_NOT_SUPPORTED'); END IF;
  IF NOT coalesce(v_gate.pre_pickup_reassignment_enabled,false) THEN
    RETURN jsonb_build_object('ok',false,
      'reason_code','PRE_PICKUP_REASSIGNMENT_DEFAULT_OFF'); END IF;
  IF v_old.tenant_id IS DISTINCT FROM p_tenant_id OR v_order.id IS NULL
     OR v_order.status::text<>'assigned'
     OR v_order.mise_batch_id IS DISTINCT FROM v_old.batch_id
     OR v_order.mise_driver_id IS DISTINCT FROM v_old.driver_id
     OR NOT EXISTS(SELECT 1 FROM public.locations l
       WHERE l.id=v_order.location_id AND l.tenant_id=p_tenant_id)
     OR NOT EXISTS(SELECT 1 FROM public.mise_driver_tenants dt
       WHERE dt.driver_id=v_old.driver_id AND dt.tenant_id=p_tenant_id AND dt.status='active')
     OR NOT EXISTS(SELECT 1 FROM public.mise_driver_tenants dt
       WHERE dt.driver_id=p_new_driver_id AND dt.tenant_id=p_tenant_id AND dt.status='active') THEN
    RETURN jsonb_build_object('ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH');
  END IF;
  IF (SELECT count(*) FROM public.dispatch_offer_assignments a
      WHERE a.batch_id=v_old.batch_id
        AND a.state IN ('assigned','picked_up','in_progress'))<>1 THEN
    RETURN jsonb_build_object('ok',false,
      'reason_code','MULTI_ORDER_LIFECYCLE_DEFAULT_OFF');
  END IF;
  SELECT * INTO v_batch FROM public.mise_delivery_batches WHERE id=v_old.batch_id FOR UPDATE;
  SELECT * INTO v_old_driver FROM public.mise_drivers WHERE id=v_old.driver_id FOR UPDATE;
  SELECT * INTO v_new_driver FROM public.mise_drivers WHERE id=p_new_driver_id FOR UPDATE;
  IF v_order.dispatch_version<>p_expected_order_version
     OR v_old.assignment_version<>p_expected_assignment_version
     OR v_batch.state_version<>p_expected_batch_version
     OR v_old_driver.state_version<>p_expected_old_driver_version
     OR v_new_driver.state_version<>p_expected_new_driver_version THEN
    RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_VERSION_CONFLICT');
  END IF;
  IF v_old_driver.state<>'exception' OR NOT v_new_driver.active
     OR v_new_driver.state NOT IN('idle','returning','available')
     OR v_new_driver.current_capacity+1>v_new_driver.max_capacity THEN
    RETURN jsonb_build_object('ok',false,'reason_code','DRIVER_STATE_NOT_ELIGIBLE');
  END IF;
  INSERT INTO public.mise_delivery_batches(
    driver_id,state,location_id,route_version,state_version,
    pickup_deadline_at,delivery_deadline_at,updated_at)
  VALUES(p_new_driver_id,'assigned',v_batch.location_id,v_batch.route_version+1,1,
    v_batch.pickup_deadline_at,v_batch.delivery_deadline_at,now())
  RETURNING id INTO v_new_batch;
  PERFORM public.fn_dispatch_test_failpoint_v2('reassign.new_batch');
  INSERT INTO public.mise_delivery_batch_stops(
    batch_id,order_id,type,sequence,lat,lng,address,state,stop_version)
  SELECT v_new_batch,order_id,type,sequence,lat,lng,address,'pending',0
    FROM public.mise_delivery_batch_stops
    WHERE batch_id=v_old.batch_id AND order_id=p_order_id ORDER BY sequence;
  PERFORM public.fn_dispatch_test_failpoint_v2('reassign.new_stops');
  UPDATE public.dispatch_offer_assignments SET state='reassigned',
    assignment_version=assignment_version+1,updated_at=now()
    WHERE id=v_old.id AND state='assigned'
      AND assignment_version=p_expected_assignment_version;
  PERFORM public.fn_dispatch_test_failpoint_v2('reassign.old_assignment');
  UPDATE public.mise_delivery_batch_stops SET state='cancelled',
    stop_version=stop_version+1 WHERE batch_id=v_old.batch_id
      AND order_id=p_order_id AND state IN('pending','arrived','servicing');
  PERFORM public.fn_dispatch_test_failpoint_v2('reassign.old_stops');
  UPDATE public.mise_delivery_batches SET state='cancelled',
    state_version=state_version+1,cancelled_at=now(),updated_at=now()
    WHERE id=v_batch.id AND state='assigned'
      AND state_version=p_expected_batch_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'REASSIGN_BATCH_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('reassign.old_batch');
  UPDATE public.customer_orders SET mise_batch_id=v_new_batch,
    mise_driver_id=p_new_driver_id,dispatch_version=dispatch_version+1,updated_at=now()
    WHERE id=p_order_id AND status::text='assigned'
      AND dispatch_version=p_expected_order_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'REASSIGN_ORDER_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('reassign.order');
  UPDATE public.mise_drivers SET current_capacity=current_capacity-1,
    state_version=state_version+1,updated_at=now()
    WHERE id=v_old_driver.id AND state='exception' AND current_capacity=1
      AND state_version=p_expected_old_driver_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'REASSIGN_OLD_DRIVER_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('reassign.old_driver');
  UPDATE public.mise_drivers SET state='assigned',current_capacity=current_capacity+1,
    state_version=state_version+1,updated_at=now()
    WHERE id=v_new_driver.id AND state_version=p_expected_new_driver_version
      AND state IN('idle','returning','available');
  IF NOT FOUND THEN RAISE EXCEPTION 'REASSIGN_NEW_DRIVER_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('reassign.new_driver');
  INSERT INTO public.dispatch_offer_assignments(
    tenant_id,order_id,batch_id,driver_id,state,decision_id,idempotency_key,
    action_id,request_fingerprint,expected_order_version,assignment_version,
    algorithm_version,correlation_id,pickup_deadline_at,delivery_deadline_at)
  VALUES(p_tenant_id,p_order_id,v_new_batch,p_new_driver_id,'assigned',p_action_id,
    gen_random_uuid(),p_action_id,v_fp,p_expected_order_version,1,'atomic-v2',
    v_corr,v_old.pickup_deadline_at,v_old.delivery_deadline_at)
  RETURNING id INTO v_new_assignment;
  PERFORM public.fn_dispatch_test_failpoint_v2('reassign.new_assignment');
  INSERT INTO public.dispatch_offer_audit(
    decision_id,idempotency_key,order_id,batch_id,driver_id,outcome,reason_code,
    expected_order_version,algorithm_version,details,correlation_id,event_type)
  VALUES
    (gen_random_uuid(),gen_random_uuid(),p_order_id,v_old.batch_id,v_old.driver_id,
     'reassigned',p_reason_code,p_expected_order_version,'atomic-v2',
     jsonb_build_object('replacement_assignment_id',v_new_assignment,
       'actor_id',p_actor_id,'note',p_note),v_corr,'assignment.reassigned'),
    (gen_random_uuid(),gen_random_uuid(),p_order_id,v_new_batch,p_new_driver_id,
     'assigned',p_reason_code,p_expected_order_version,'atomic-v2',
     jsonb_build_object('replaces_assignment_id',v_old.id,
       'actor_id',p_actor_id,'note',p_note),v_corr,'assignment.created');
  PERFORM public.fn_dispatch_test_failpoint_v2('reassign.audit');
  INSERT INTO public.mise_push_outbox(driver_id,type,title,body,sound,priority,data)
  VALUES
    (v_old.driver_id,'assignment_reassigned','Tour neu zugewiesen',
     'Die alte Zuweisung bleibt auditiert.','default','high',
     jsonb_build_object('assignment_id',v_old.id,'correlation_id',v_corr)),
    (p_new_driver_id,'order_assigned','Neue Tour',
     'Eine neue Lieferung ist dir zugewiesen.','default','high',
     jsonb_build_object('assignment_id',v_new_assignment,
       'requires_acceptance',false,'correlation_id',v_corr));
  PERFORM public.fn_dispatch_test_failpoint_v2('reassign.outbox');
  v_result:=jsonb_build_object('ok',true,'state','assigned',
    'old_assignment_state','reassigned','assignment_id',v_new_assignment,
    'batch_id',v_new_batch,'order_version',p_expected_order_version+1,
    'old_driver_version',p_expected_old_driver_version+1,
    'new_driver_version',p_expected_new_driver_version+1,'correlation_id',v_corr);
  INSERT INTO public.dispatch_assignment_requests_v2
    (action_id,tenant_id,request_fingerprint,action,correlation_id,result)
  VALUES(p_action_id,p_tenant_id,v_fp,'reassign_before_pickup',v_corr,v_result);
  PERFORM public.fn_dispatch_test_failpoint_v2('reassign.request');
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_complete_delivery_v2(
  p_tenant_id uuid,p_order_id uuid,
  p_expected_order_version bigint,p_expected_assignment_version bigint,
  p_expected_batch_version bigint,p_expected_driver_version bigint,
  p_actor_driver_id uuid,p_action_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp
AS $$
DECLARE
  v_order public.customer_orders%ROWTYPE;
  v_assignment public.dispatch_offer_assignments%ROWTYPE;
  v_batch public.mise_delivery_batches%ROWTYPE;
  v_driver public.mise_drivers%ROWTYPE;
  v_existing public.dispatch_assignment_requests_v2%ROWTYPE;
  v_corr uuid:=gen_random_uuid(); v_result jsonb;
  v_fp text:=md5(pg_catalog.concat_ws('|',p_tenant_id::text,p_order_id::text,
    p_expected_order_version::text,p_expected_assignment_version::text,
    p_expected_batch_version::text,p_expected_driver_version::text,
    p_actor_driver_id::text));
BEGIN
  IF p_action_id IS NULL OR p_actor_driver_id IS NULL THEN RETURN jsonb_build_object(
    'ok',false,'reason_code','MISSING_ACTION_OR_ACTOR'); END IF;
  IF coalesce(current_setting('t02.race_barrier',true),'')<>'' AND
     pg_catalog.to_regprocedure('public.fn_t02_race_barrier(text)') IS NOT NULL THEN
    EXECUTE 'SELECT public.fn_t02_race_barrier($1)'
    USING current_setting('t02.race_barrier',true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_action_id::text,27602));
  SELECT * INTO v_existing FROM public.dispatch_assignment_requests_v2
    WHERE action_id=p_action_id;
  IF FOUND THEN
    IF v_existing.request_fingerprint<>v_fp THEN RETURN jsonb_build_object(
      'ok',false,'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
    RETURN v_existing.result||jsonb_build_object('idempotent_replay',true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text,27601));
  SELECT * INTO v_order FROM public.customer_orders WHERE id=p_order_id FOR UPDATE;
  SELECT * INTO v_assignment FROM public.dispatch_offer_assignments
    WHERE order_id=p_order_id AND state='in_progress' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object(
    'ok',false,'reason_code','DELIVERY_NOT_IN_PROGRESS'); END IF;
  IF v_assignment.tenant_id IS DISTINCT FROM p_tenant_id
     OR v_assignment.driver_id IS DISTINCT FROM p_actor_driver_id
     OR v_order.status::text<>'out_for_delivery'
     OR v_order.mise_batch_id IS DISTINCT FROM v_assignment.batch_id
     OR v_order.mise_driver_id IS DISTINCT FROM v_assignment.driver_id
     OR NOT EXISTS(SELECT 1 FROM public.locations l
       WHERE l.id=v_order.location_id AND l.tenant_id=p_tenant_id)
     OR NOT EXISTS(SELECT 1 FROM public.mise_driver_tenants dt
       WHERE dt.driver_id=p_actor_driver_id AND dt.tenant_id=p_tenant_id AND dt.status='active') THEN
    RETURN jsonb_build_object('ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH');
  END IF;
  IF (SELECT count(*) FROM public.dispatch_offer_assignments a
      WHERE a.batch_id=v_assignment.batch_id
        AND a.state IN('assigned','picked_up','in_progress'))<>1 THEN
    RETURN jsonb_build_object('ok',false,
      'reason_code','MULTI_ORDER_LIFECYCLE_DEFAULT_OFF');
  END IF;
  SELECT * INTO v_batch FROM public.mise_delivery_batches WHERE id=v_assignment.batch_id FOR UPDATE;
  SELECT * INTO v_driver FROM public.mise_drivers WHERE id=v_assignment.driver_id FOR UPDATE;
  IF v_batch.state<>'in_progress' OR v_driver.state<>'delivering' THEN
    RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_STATE_CONFLICT'); END IF;
  IF v_order.dispatch_version<>p_expected_order_version
     OR v_assignment.assignment_version<>p_expected_assignment_version
     OR v_batch.state_version<>p_expected_batch_version
     OR v_driver.state_version<>p_expected_driver_version THEN
    RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_VERSION_CONFLICT'); END IF;
  UPDATE public.dispatch_offer_assignments SET state='completed',
    assignment_version=assignment_version+1,updated_at=now()
    WHERE id=v_assignment.id AND state='in_progress'
      AND assignment_version=p_expected_assignment_version;
  PERFORM public.fn_dispatch_test_failpoint_v2('complete.assignment');
  UPDATE public.mise_delivery_batch_stops SET state='completed',
    completed_at=coalesce(completed_at,now()),stop_version=stop_version+1
    WHERE batch_id=v_batch.id AND order_id=p_order_id
      AND type='dropoff' AND state='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_STOP_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('complete.stops');
  UPDATE public.mise_delivery_batches SET state='completed',
    state_version=state_version+1,completed_at=now(),updated_at=now()
    WHERE id=v_batch.id AND state='in_progress'
      AND state_version=p_expected_batch_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_BATCH_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('complete.batch');
  UPDATE public.customer_orders SET status='delivered',
    dispatch_version=dispatch_version+1,geliefert_am=now(),updated_at=now()
    WHERE id=p_order_id AND status::text='out_for_delivery'
      AND dispatch_version=p_expected_order_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_ORDER_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('complete.order');
  UPDATE public.mise_drivers SET state='returning',
    current_capacity=current_capacity-1,state_version=state_version+1,updated_at=now()
    WHERE id=v_driver.id AND state='delivering' AND current_capacity=1
      AND state_version=p_expected_driver_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_DRIVER_CAS_CONFLICT'; END IF;
  PERFORM public.fn_dispatch_test_failpoint_v2('complete.driver');
  INSERT INTO public.dispatch_offer_audit(
    decision_id,idempotency_key,order_id,batch_id,driver_id,outcome,reason_code,
    expected_order_version,algorithm_version,details,correlation_id,event_type)
  VALUES(gen_random_uuid(),p_action_id,p_order_id,v_batch.id,v_driver.id,
    'completed','DELIVERY_CONFIRMED',p_expected_order_version,'atomic-v2',
    '{}'::jsonb,v_corr,'assignment.completed');
  PERFORM public.fn_dispatch_test_failpoint_v2('complete.audit');
  v_result:=jsonb_build_object('ok',true,'state','completed',
    'assignment_version',p_expected_assignment_version+1,
    'order_version',p_expected_order_version+1,
    'batch_version',p_expected_batch_version+1,
    'driver_version',p_expected_driver_version+1,'correlation_id',v_corr);
  INSERT INTO public.dispatch_assignment_requests_v2
    (action_id,tenant_id,request_fingerprint,action,correlation_id,result)
  VALUES(p_action_id,p_tenant_id,v_fp,'complete_delivery',v_corr,v_result);
  PERFORM public.fn_dispatch_test_failpoint_v2('complete.request');
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dispatch_pickup_assignment_v2(
  uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_dispatch_start_delivery_v2(
  uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_dispatch_cancel_order_v2(
  uuid,uuid,bigint,bigint,bigint,bigint,uuid,bigint,uuid,text
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_dispatch_reassign_before_pickup_v2(
  uuid,uuid,bigint,bigint,bigint,bigint,uuid,bigint,uuid,bigint,
  uuid,uuid,text,text
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_dispatch_complete_delivery_v2(
  uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid
) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fn_dispatch_test_failpoint_v2(text)
  FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION public.fn_dispatch_pickup_assignment_v2(
  uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid
), public.fn_dispatch_start_delivery_v2(
  uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid
), public.fn_dispatch_cancel_order_v2(
  uuid,uuid,bigint,bigint,bigint,bigint,uuid,bigint,uuid,text
), public.fn_dispatch_reassign_before_pickup_v2(
  uuid,uuid,bigint,bigint,bigint,bigint,uuid,bigint,uuid,bigint,
  uuid,uuid,text,text
), public.fn_dispatch_complete_delivery_v2(
  uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid
) TO service_role;
