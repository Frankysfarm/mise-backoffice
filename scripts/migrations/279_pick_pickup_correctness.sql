-- T04: exact item outcomes and atomic whole-trip pickup/departure.

ALTER TABLE public.driver_item_outcomes_v2
  DROP CONSTRAINT IF EXISTS driver_item_outcomes_v2_outcome_check;
UPDATE public.driver_item_outcomes_v2
  SET outcome=CASE outcome WHEN 'picked' THEN 'present_confirmed'
    WHEN 'missing' THEN 'unresolved' ELSE outcome END
  WHERE outcome IN ('picked','missing');
ALTER TABLE public.driver_item_outcomes_v2
  ADD CONSTRAINT driver_item_outcomes_v2_outcome_check CHECK (outcome IN (
    'present_confirmed','substituted_approved','cancelled_refunded',
    'resolved_missing','unresolved'
  ));
ALTER TABLE public.driver_item_outcomes_v2
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS actor_type text NOT NULL DEFAULT 'driver',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS pickup_confirmed_action_id uuid,
  ADD COLUMN IF NOT EXISTS pickup_confirmed_correlation_id uuid,
  ADD COLUMN IF NOT EXISTS pickup_confirmed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.driver_batch_pickups_v2 (
  action_id uuid PRIMARY KEY REFERENCES public.driver_action_requests_v2(action_id)
    DEFERRABLE INITIALLY DEFERRED,
  tenant_id uuid NOT NULL,
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id),
  batch_id uuid NOT NULL REFERENCES public.mise_delivery_batches(id),
  request_fingerprint text NOT NULL,
  correlation_id uuid NOT NULL,
  manifest jsonb NOT NULL,
  result jsonb NOT NULL,
  picked_up_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_batch_pickups_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_batch_pickups_v2 FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.fn_driver_pickup_batch_v2(
  p_tenant_id uuid,p_batch_id uuid,p_expected_batch_version bigint,
  p_expected_route_version bigint,p_expected_driver_version bigint,
  p_actor_driver_id uuid,p_action_id uuid,p_manifest jsonb,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  b public.mise_delivery_batches%ROWTYPE; d public.mise_drivers%ROWTYPE;
  old public.driver_action_requests_v2%ROWTYPE; v_result jsonb; order_count int;
  fp text:=md5(pg_catalog.concat_ws('|',p_tenant_id,p_batch_id,p_expected_batch_version,
    p_expected_route_version,p_expected_driver_version,p_actor_driver_id,p_manifest::text));
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,27901));
  SELECT * INTO old FROM public.driver_action_requests_v2 WHERE action_id=p_action_id;
  IF FOUND THEN
    IF old.tenant_id<>p_tenant_id OR old.driver_id<>p_actor_driver_id
      OR old.action<>'pickup_batch' OR old.target_id IS DISTINCT FROM p_batch_id
      OR old.request_fingerprint<>fp THEN RETURN jsonb_build_object('ok',false,
        'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'); END IF;
    RETURN old.result||jsonb_build_object('idempotent_replay',true);
  END IF;
  SELECT * INTO b FROM public.mise_delivery_batches WHERE id=p_batch_id FOR UPDATE;
  SELECT * INTO d FROM public.mise_drivers WHERE id=p_actor_driver_id FOR UPDATE;
  IF b.id IS NULL OR d.id IS NULL OR b.driver_id IS DISTINCT FROM p_actor_driver_id
    OR NOT EXISTS(SELECT 1 FROM public.mise_driver_tenants WHERE tenant_id=p_tenant_id
      AND driver_id=p_actor_driver_id AND status='active')
  THEN RETURN jsonb_build_object('ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH'); END IF;
  IF b.state_version<>p_expected_batch_version OR b.route_version<>p_expected_route_version
    OR d.state_version<>p_expected_driver_version
  THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_VERSION_CONFLICT'); END IF;
  IF b.state NOT IN ('assigned','at_pickup') OR d.state NOT IN ('assigned','at_pickup')
  THEN RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_STATE_CONFLICT'); END IF;
  IF jsonb_typeof(p_manifest)<>'array' THEN RETURN jsonb_build_object(
    'ok',false,'reason_code','INVALID_PICKUP_MANIFEST'); END IF;

  -- Serialize every assignment/order/stop before validating the exact manifest.
  PERFORM 1 FROM public.dispatch_offer_assignments
    WHERE batch_id=p_batch_id ORDER BY order_id FOR UPDATE;
  PERFORM 1 FROM public.customer_orders o JOIN public.dispatch_offer_assignments a ON a.order_id=o.id
    WHERE a.batch_id=p_batch_id ORDER BY o.id FOR UPDATE OF o;
  PERFORM 1 FROM public.mise_delivery_batch_stops
    WHERE batch_id=p_batch_id ORDER BY order_id,id FOR UPDATE;

  SELECT count(*) INTO order_count FROM public.dispatch_offer_assignments a
    JOIN public.customer_orders o ON o.id=a.order_id
    WHERE a.batch_id=p_batch_id AND a.driver_id=p_actor_driver_id
      AND a.tenant_id=p_tenant_id AND a.state='assigned' AND o.status='assigned';
  IF (SELECT count(DISTINCT x->>'order_id') FROM jsonb_array_elements(p_manifest)x)
      <>jsonb_array_length(p_manifest)
    OR order_count<>(SELECT count(*) FROM jsonb_array_elements(p_manifest)x
      JOIN public.dispatch_offer_assignments a ON a.order_id=(x->>'order_id')::uuid
      JOIN public.customer_orders o ON o.id=a.order_id
      WHERE a.batch_id=p_batch_id AND a.state='assigned' AND o.status='assigned')
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_manifest)x WHERE
      NOT EXISTS(SELECT 1 FROM public.dispatch_offer_assignments a
        JOIN public.customer_orders o ON o.id=a.order_id
        JOIN public.mise_delivery_batch_stops s ON s.batch_id=a.batch_id
          AND s.order_id=a.order_id AND s.type='pickup'
        WHERE a.batch_id=p_batch_id AND a.order_id=(x->>'order_id')::uuid
          AND a.id=(x->>'assignment_id')::uuid AND s.id=(x->>'stop_id')::uuid
          AND ((a.state='assigned' AND o.status='assigned'
            AND a.assignment_version=(x->>'assignment_version')::bigint
            AND o.dispatch_version=(x->>'order_version')::bigint
            AND s.stop_version=(x->>'stop_version')::bigint AND s.state='arrived')
          OR (o.status='cancelled' OR a.state='cancelled'))))
  THEN RETURN jsonb_build_object('ok',false,'reason_code','ASSIGNED_ORDER_SET_MISMATCH'); END IF;

  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_manifest)x
    WHERE EXISTS(SELECT 1 FROM public.dispatch_offer_assignments a
      JOIN public.customer_orders o ON o.id=a.order_id WHERE a.batch_id=p_batch_id
        AND a.order_id=(x->>'order_id')::uuid AND a.state='assigned' AND o.status='assigned')
      AND (jsonb_typeof(x->'items')<>'array'
      OR jsonb_array_length(x->'items')<>(SELECT count(*) FROM public.order_items oi
        WHERE oi.order_id=(x->>'order_id')::uuid)
      OR (SELECT count(DISTINCT i->>'id') FROM jsonb_array_elements(x->'items')i)
         <>jsonb_array_length(x->'items')
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(x->'items')i WHERE
        NOT EXISTS(SELECT 1 FROM public.order_items oi WHERE oi.id=(i->>'id')::uuid
          AND oi.order_id=(x->>'order_id')::uuid))))
  THEN RETURN jsonb_build_object('ok',false,'reason_code','REQUIRED_ITEM_SET_MISMATCH'); END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_manifest)x,
    jsonb_array_elements(x->'items')i WHERE i->>'outcome'='unresolved'
      AND EXISTS(SELECT 1 FROM public.dispatch_offer_assignments a
        JOIN public.customer_orders o ON o.id=a.order_id WHERE a.batch_id=p_batch_id
          AND a.order_id=(x->>'order_id')::uuid AND a.state='assigned' AND o.status='assigned'))
  THEN RETURN jsonb_build_object('ok',false,'reason_code','ITEM_MISSING_REQUIRES_RESOLUTION'); END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_manifest)x,
    jsonb_array_elements(x->'items')i WHERE EXISTS(SELECT 1
      FROM public.dispatch_offer_assignments a JOIN public.customer_orders o ON o.id=a.order_id
      WHERE a.batch_id=p_batch_id AND a.order_id=(x->>'order_id')::uuid
        AND a.state='assigned' AND o.status='assigned') AND (i->>'outcome' NOT IN
      ('present_confirmed','substituted_approved','cancelled_refunded','resolved_missing')
      OR (i->>'outcome'<>'present_confirmed' AND
        (jsonb_typeof(i->'evidence')<>'object' OR i->'evidence'='{}'::jsonb))))
  THEN RETURN jsonb_build_object('ok',false,'reason_code','INVALID_OR_UNEVIDENCED_ITEM_OUTCOME'); END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_manifest)x,
    jsonb_array_elements(x->'items')i WHERE i->>'outcome'<>'present_confirmed'
      AND EXISTS(SELECT 1 FROM public.dispatch_offer_assignments a
        JOIN public.customer_orders o ON o.id=a.order_id WHERE a.batch_id=p_batch_id
          AND a.order_id=(x->>'order_id')::uuid AND a.state='assigned' AND o.status='assigned')
      AND NOT EXISTS(SELECT 1 FROM public.driver_item_outcomes_v2 r
        WHERE r.order_id=(x->>'order_id')::uuid AND r.item_id=(i->>'id')::uuid
          AND r.outcome=i->>'outcome' AND r.actor_type IN ('kitchen','dispatcher','system')
          AND r.evidence=i->'evidence'))
  THEN RETURN jsonb_build_object('ok',false,
    'reason_code','ITEM_EXCEPTION_REQUIRES_SERVER_RESOLUTION'); END IF;

  -- Only after the complete manifest is valid may cancellation cleanup mutate
  -- assignments/stops. Cancelled orders are never marked picked/completed.
  UPDATE public.dispatch_offer_assignments a SET state='cancelled',
    assignment_version=assignment_version+1,updated_at=now()
    FROM public.customer_orders o WHERE a.batch_id=p_batch_id AND a.order_id=o.id
      AND a.state='assigned' AND o.status='cancelled';
  UPDATE public.mise_delivery_batch_stops s SET state='cancelled',
    stop_version=stop_version+1,completed_at=NULL
    FROM public.customer_orders o WHERE s.batch_id=p_batch_id AND s.order_id=o.id
      AND o.status='cancelled' AND s.state IN ('pending','arrived','servicing');
  INSERT INTO public.dispatch_offer_audit(decision_id,idempotency_key,order_id,batch_id,
    driver_id,outcome,reason_code,expected_order_version,algorithm_version,details,
    correlation_id,event_type)
  SELECT gen_random_uuid(),p_action_id,o.id,p_batch_id,p_actor_driver_id,'cancelled',
    'ORDER_CANCELLED_DURING_PICK',o.dispatch_version,'driver-v2-t04',
    jsonb_build_object('pickup_custody_acquired',false),p_correlation_id,
    'pickup.order_cancelled'
  FROM public.customer_orders o JOIN public.dispatch_offer_assignments a ON a.order_id=o.id
  WHERE a.batch_id=p_batch_id AND o.status='cancelled' AND a.state='cancelled';

  INSERT INTO public.driver_action_requests_v2 VALUES(
    p_action_id,p_tenant_id,p_actor_driver_id,'pickup_batch',p_batch_id,fp,
    p_correlation_id,'{}',now());
  INSERT INTO public.driver_item_outcomes_v2(
    order_id,item_id,tenant_id,driver_id,outcome,action_id,correlation_id,evidence,actor_type,
    pickup_confirmed_action_id,pickup_confirmed_correlation_id,pickup_confirmed_at)
  SELECT (x->>'order_id')::uuid,(i->>'id')::uuid,p_tenant_id,p_actor_driver_id,
    i->>'outcome',p_action_id,p_correlation_id,coalesce(i->'evidence','{}'::jsonb),'driver',
    p_action_id,p_correlation_id,now()
    FROM jsonb_array_elements(p_manifest)x,jsonb_array_elements(x->'items')i
    WHERE EXISTS(SELECT 1 FROM public.dispatch_offer_assignments a
      JOIN public.customer_orders o ON o.id=a.order_id WHERE a.batch_id=p_batch_id
        AND a.order_id=(x->>'order_id')::uuid AND a.state='assigned' AND o.status='assigned')
  ON CONFLICT(order_id,item_id) DO UPDATE SET
    pickup_confirmed_action_id=excluded.pickup_confirmed_action_id,
    pickup_confirmed_correlation_id=excluded.pickup_confirmed_correlation_id,
    pickup_confirmed_at=excluded.pickup_confirmed_at,updated_at=now();
  IF current_setting('mise.test_pickup_failpoint',true)='after_item_outcomes' THEN
    RAISE EXCEPTION 'T04_PICKUP_FAILPOINT_AFTER_ITEM_OUTCOMES';
  END IF;

  UPDATE public.dispatch_offer_assignments SET state='in_progress',
    assignment_version=assignment_version+2,updated_at=now()
    WHERE batch_id=p_batch_id AND state='assigned';
  UPDATE public.customer_orders o SET status='out_for_delivery',
    dispatch_version=dispatch_version+2,updated_at=now()
    FROM public.dispatch_offer_assignments a WHERE a.batch_id=p_batch_id
      AND a.order_id=o.id AND a.state='in_progress' AND o.status='assigned';
  UPDATE public.mise_delivery_batch_stops SET state='completed',
    stop_version=stop_version+1,completed_at=now()
    WHERE batch_id=p_batch_id AND type='pickup' AND state='arrived';
  UPDATE public.mise_delivery_batches SET state='in_progress',
    state_version=state_version+2,picked_up_at=coalesce(picked_up_at,now()),updated_at=now()
    WHERE id=p_batch_id;
  UPDATE public.mise_drivers SET state='delivering',state_version=state_version+2,
    updated_at=now() WHERE id=p_actor_driver_id;

  INSERT INTO public.dispatch_offer_audit(decision_id,idempotency_key,order_id,batch_id,
    driver_id,outcome,reason_code,expected_order_version,algorithm_version,details,
    correlation_id,event_type)
  SELECT gen_random_uuid(),p_action_id,(x->>'order_id')::uuid,p_batch_id,p_actor_driver_id,
    'assigned','ATOMIC_BATCH_PICKUP_DEPARTED',(x->>'order_version')::bigint,'driver-v2-t04',
    jsonb_build_object('items',x->'items'),p_correlation_id,'assignment.in_progress'
    FROM jsonb_array_elements(p_manifest)x
    WHERE EXISTS(SELECT 1 FROM public.dispatch_offer_assignments a
      JOIN public.customer_orders o ON o.id=a.order_id WHERE a.batch_id=p_batch_id
        AND a.order_id=(x->>'order_id')::uuid AND a.state='in_progress'
        AND o.status='out_for_delivery');
  v_result:=jsonb_build_object('ok',true,'state','in_progress','orders',order_count,
    'batch_version',p_expected_batch_version+2,'driver_version',p_expected_driver_version+2,
    'route_version',p_expected_route_version,'correlation_id',p_correlation_id);
  UPDATE public.driver_action_requests_v2 SET result=v_result WHERE action_id=p_action_id;
  INSERT INTO public.driver_batch_pickups_v2 VALUES(
    p_action_id,p_tenant_id,p_actor_driver_id,p_batch_id,fp,p_correlation_id,p_manifest,v_result,now());
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.fn_driver_pickup_batch_v2(
  uuid,uuid,bigint,bigint,bigint,uuid,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_driver_pickup_batch_v2(
  uuid,uuid,bigint,bigint,bigint,uuid,uuid,jsonb,uuid) TO service_role;

-- T03 single-order pickup/departure cannot prove a complete trip manifest.
-- Keep their signatures for deterministic compatibility errors, but make them
-- incapable of lifecycle writes even for service_role callers.
CREATE OR REPLACE FUNCTION public.fn_driver_pickup_v2(
  p_tenant_id uuid,p_order_id uuid,p_expected_order_version bigint,
  p_expected_assignment_version bigint,p_expected_batch_version bigint,
  p_expected_driver_version bigint,p_actor_driver_id uuid,p_action_id uuid,
  p_expected_stop_version bigint,p_expected_route_version bigint,p_correlation_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp
AS $$ SELECT jsonb_build_object('ok',false,
  'reason_code','LEGACY_SINGLE_ORDER_PICKUP_DISABLED_T04',
  'correlation_id',p_correlation_id) $$;

CREATE OR REPLACE FUNCTION public.fn_driver_depart_v2(
  p_tenant_id uuid,p_order_id uuid,p_expected_order_version bigint,
  p_expected_assignment_version bigint,p_expected_batch_version bigint,
  p_expected_driver_version bigint,p_actor_driver_id uuid,p_action_id uuid,
  p_stop_id uuid,p_expected_stop_version bigint,p_expected_route_version bigint,
  p_correlation_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp
AS $$ SELECT jsonb_build_object('ok',false,
  'reason_code','LEGACY_SINGLE_ORDER_DEPART_DISABLED_T04',
  'correlation_id',p_correlation_id) $$;
