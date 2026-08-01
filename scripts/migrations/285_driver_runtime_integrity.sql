-- Runtime integrity follow-up: one active tour, idempotent alarms and
-- multi-order completion. Additive migration; never rewrite deployed history.

CREATE UNIQUE INDEX IF NOT EXISTS uq_mise_driver_one_active_batch
  ON public.mise_delivery_batches(driver_id)
  WHERE driver_id IS NOT NULL
    AND state IN ('pending_acceptance','assigned','at_pickup','in_progress');

ALTER TABLE public.mise_push_outbox
  ADD COLUMN IF NOT EXISTS dedupe_key text;

UPDATE public.mise_push_outbox
SET dedupe_key = 'legacy:' || id::text
WHERE dedupe_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mise_push_outbox_dedupe_key
  ON public.mise_push_outbox(dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_mise_push_outbox_dedupe_v2()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE logical_key text; ordinal text;
BEGIN
  IF NEW.dedupe_key IS NOT NULL THEN logical_key:=NEW.dedupe_key;
  ELSIF NEW.type IN ('assign','order_assigned') THEN
    ordinal:=coalesce(NEW.data->>'reminder_ordinal',CASE WHEN NEW.data->>'reminder'='true' THEN 'reminder' ELSE 'initial' END);
    logical_key:=CASE
      WHEN NEW.data ? 'assignment_id' THEN 'assignment:'||(NEW.data->>'assignment_id')||':'||ordinal
      WHEN NEW.data ? 'batch_id' THEN 'batch:'||(NEW.data->>'batch_id')||':'||ordinal
      WHEN NEW.data ? 'order_id' THEN 'order:'||(NEW.data->>'order_id')||':'||ordinal
      ELSE 'notification:'||NEW.id::text END;
  ELSE logical_key:='notification:'||NEW.id::text;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(logical_key,28502));
  IF EXISTS(SELECT 1 FROM public.mise_push_outbox WHERE dedupe_key=logical_key) THEN RETURN NULL; END IF;
  NEW.dedupe_key:=logical_key;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mise_push_outbox_dedupe_v2 ON public.mise_push_outbox;
CREATE TRIGGER trg_mise_push_outbox_dedupe_v2 BEFORE INSERT ON public.mise_push_outbox
FOR EACH ROW EXECUTE FUNCTION public.fn_mise_push_outbox_dedupe_v2();

-- A claimed wake is only deliverable while its assignment/batch and driver are
-- still current. Invalid rows become terminal before leaving the database.
CREATE OR REPLACE FUNCTION public.fn_claim_wake_notifications(
  p_worker_id uuid, p_limit integer DEFAULT 50
) RETURNS SETOF public.mise_push_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN RAISE EXCEPTION 'INVALID_CLAIM_LIMIT'; END IF;

  UPDATE public.mise_push_outbox o
  SET notification_state='expired',failed_at=coalesce(failed_at,now()),
      last_error=CASE WHEN o.expires_at<=now() THEN 'WAKE_EXPIRED'
        ELSE 'ASSIGNMENT_SUPERSEDED' END,claim_token=NULL,claimed_at=NULL
  WHERE o.notification_state='queued' AND (
    o.expires_at<=now() OR
    (o.type IN ('assign','order_assigned') AND (
      NOT EXISTS (SELECT 1 FROM public.mise_drivers d
        WHERE d.id=o.driver_id AND d.active AND d.state<>'offline' AND d.push_enabled)
      OR (o.data ? 'assignment_id' AND NOT EXISTS (
        SELECT 1 FROM public.dispatch_offer_assignments a
        WHERE a.id=(o.data->>'assignment_id')::uuid AND a.driver_id=o.driver_id
          AND a.state IN ('assigned','accepted')
          AND (NOT (o.data ? 'assignment_version') OR
            a.assignment_version=(o.data->>'assignment_version')::bigint)))
      OR (o.data ? 'batch_id' AND NOT EXISTS (
        SELECT 1 FROM public.mise_delivery_batches b
        WHERE b.id=(o.data->>'batch_id')::uuid AND b.driver_id=o.driver_id
          AND b.state IN ('pending_acceptance','assigned','at_pickup')))
    ))
  );

  RETURN QUERY WITH candidates AS (
    SELECT id FROM public.mise_push_outbox
    WHERE notification_state='queued' AND expires_at>now() AND next_attempt_at<=now()
      AND (claimed_at IS NULL OR claimed_at<now()-interval '2 minutes')
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT p_limit
  ), claimed AS (
    UPDATE public.mise_push_outbox o SET claim_token=p_worker_id,claimed_at=now()
    FROM candidates c WHERE o.id=c.id RETURNING o.*
  ) SELECT * FROM claimed;
END $$;

DROP FUNCTION IF EXISTS public.fn_finish_wake_notification(uuid,uuid,boolean,text,text);
CREATE OR REPLACE FUNCTION public.fn_finish_wake_notification(
  p_notification_id uuid,p_worker_id uuid,p_provider_accepted boolean,
  p_provider_message_id text,p_error text,p_retryable boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o public.mise_push_outbox%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.mise_push_outbox WHERE id=p_notification_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason_code','NOTIFICATION_NOT_FOUND'); END IF;
  IF o.claim_token IS DISTINCT FROM p_worker_id OR o.notification_state<>'queued' THEN
    RETURN jsonb_build_object('ok',false,'reason_code','NOTIFICATION_CLAIM_CONFLICT');
  END IF;
  IF p_provider_accepted THEN
    UPDATE public.mise_push_outbox SET notification_state='provider_accepted',
      provider_accepted_at=now(),sent_at=now(),provider_message_id=p_provider_message_id,
      last_error=NULL,claim_token=NULL,claimed_at=NULL WHERE id=o.id;
  ELSIF NOT p_retryable THEN
    UPDATE public.mise_push_outbox SET attempts=attempts+1,notification_state='expired',
      failed_at=now(),last_error=coalesce(nullif(p_error,''),'NON_RETRYABLE'),
      claim_token=NULL,claimed_at=NULL WHERE id=o.id;
  ELSE
    UPDATE public.mise_push_outbox SET attempts=attempts+1,
      notification_state=CASE WHEN attempts+1>=5 THEN 'failed' ELSE 'queued' END,
      failed_at=CASE WHEN attempts+1>=5 THEN now() ELSE NULL END,
      next_attempt_at=now()+make_interval(secs=>least(300,5*(2^least(attempts,6))::integer)),
      last_error=coalesce(nullif(p_error,''),'PROVIDER_REJECTED'),claim_token=NULL,claimed_at=NULL
      WHERE id=o.id;
  END IF;
  RETURN jsonb_build_object('ok',true,'provider_accepted',p_provider_accepted);
END $$;

-- Compatibility wrapper for older workers during a rolling deployment.
CREATE OR REPLACE FUNCTION public.fn_finish_wake_notification(
  p_notification_id uuid,p_worker_id uuid,p_provider_accepted boolean,
  p_provider_message_id text,p_error text
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT public.fn_finish_wake_notification($1,$2,$3,$4,$5,true)
$$;

CREATE OR REPLACE FUNCTION public.fn_repush_pending_batches()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_count integer:=0; v_batch record; v_ordinal integer;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('mise-apns-assignment-reminders',28401)) THEN RETURN 0; END IF;
  FOR v_batch IN
    SELECT b.id,b.driver_id
    FROM public.mise_delivery_batches b
    JOIN public.mise_drivers d ON d.id=b.driver_id AND d.active AND d.state<>'offline' AND d.push_enabled
    WHERE b.state='pending_acceptance' AND b.created_at<=now()-interval '45 seconds'
      AND NOT EXISTS (SELECT 1 FROM public.dispatch_offer_assignments a
        WHERE a.batch_id=b.id AND (a.received_by_app_at IS NOT NULL OR a.state NOT IN ('assigned','accepted')))
      AND NOT EXISTS (SELECT 1 FROM public.mise_push_outbox p
        WHERE p.driver_id=b.driver_id AND p.data->>'batch_id'=b.id::text
          AND p.app_acknowledged_at IS NOT NULL)
      AND (SELECT count(*) FROM public.mise_push_outbox p
        WHERE p.driver_id=b.driver_id AND p.type IN ('assign','order_assigned')
          AND p.data->>'batch_id'=b.id::text)<3
      AND coalesce((SELECT max(p.created_at) FROM public.mise_push_outbox p
        WHERE p.driver_id=b.driver_id AND p.type IN ('assign','order_assigned')
          AND p.data->>'batch_id'=b.id::text),b.created_at)<=now()-interval '45 seconds'
    ORDER BY b.created_at FOR UPDATE OF b SKIP LOCKED
  LOOP
    SELECT count(*) INTO v_ordinal FROM public.mise_push_outbox p
      WHERE p.driver_id=v_batch.driver_id AND p.type IN ('assign','order_assigned')
        AND p.data->>'batch_id'=v_batch.id::text;
    INSERT INTO public.mise_push_outbox(driver_id,type,title,body,sound,priority,data,dedupe_key)
    VALUES(v_batch.driver_id,'order_assigned','Neue Lieferung','Bitte Lieferung jetzt annehmen.',
      'alarm.caf','high',jsonb_build_object('batch_id',v_batch.id,'wake_only',true,
        'reminder',true,'reminder_ordinal',v_ordinal),
      'batch:'||v_batch.id::text||':reminder:'||v_ordinal::text)
    ON CONFLICT(dedupe_key) DO NOTHING;
    IF FOUND THEN v_count:=v_count+1; END IF;
  END LOOP;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.fn_claim_wake_notifications(uuid,integer),
  public.fn_finish_wake_notification(uuid,uuid,boolean,text,text),
  public.fn_finish_wake_notification(uuid,uuid,boolean,text,text,boolean),
  public.fn_repush_pending_batches() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_wake_notifications(uuid,integer),
  public.fn_finish_wake_notification(uuid,uuid,boolean,text,text),
  public.fn_finish_wake_notification(uuid,uuid,boolean,text,text,boolean),
  public.fn_repush_pending_batches() TO service_role;

COMMENT ON INDEX public.uq_mise_driver_one_active_batch IS
  'Hard invariant: a driver owns at most one active delivery tour.';

-- Completing one drop-off must not complete a multi-order tour. All lifecycle
-- rows change under the same locks, including the canonical customer order.
CREATE OR REPLACE FUNCTION public.fn_driver_complete_v2(
  p_tenant_id uuid,p_order_id uuid,p_expected_order_version bigint,
  p_expected_assignment_version bigint,p_expected_batch_version bigint,
  p_expected_driver_version bigint,p_actor_driver_id uuid,p_action_id uuid,
  p_stop_id uuid,p_expected_stop_version bigint,p_expected_route_version bigint,p_correlation_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o public.customer_orders%ROWTYPE; a public.dispatch_offer_assignments%ROWTYPE;
 b public.mise_delivery_batches%ROWTYPE; d public.mise_drivers%ROWTYPE;
 s public.mise_delivery_batch_stops%ROWTYPE; old public.driver_action_requests_v2%ROWTYPE;
 remaining integer; next_state text; corr uuid:=p_correlation_id; result jsonb;
 fp text:=md5(pg_catalog.concat_ws('|',p_tenant_id,p_order_id,p_expected_order_version,
  p_expected_assignment_version,p_expected_batch_version,p_expected_driver_version,
  p_actor_driver_id,p_stop_id,p_expected_stop_version,p_expected_route_version));
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,28501));
 SELECT * INTO old FROM public.driver_action_requests_v2 WHERE action_id=p_action_id;
 IF FOUND THEN
  IF old.tenant_id<>p_tenant_id OR old.driver_id<>p_actor_driver_id OR old.action<>'complete'
   OR old.target_id IS DISTINCT FROM p_order_id OR old.request_fingerprint<>fp THEN
   RETURN jsonb_build_object('ok',false,'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
  END IF;
  RETURN old.result||jsonb_build_object('idempotent_replay',true);
 END IF;
 SELECT * INTO o FROM public.customer_orders WHERE id=p_order_id FOR UPDATE;
 SELECT * INTO a FROM public.dispatch_offer_assignments
   WHERE order_id=p_order_id AND state='in_progress' FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason_code','DELIVERY_NOT_IN_PROGRESS'); END IF;
 SELECT * INTO b FROM public.mise_delivery_batches WHERE id=a.batch_id FOR UPDATE;
 SELECT * INTO d FROM public.mise_drivers WHERE id=p_actor_driver_id FOR UPDATE;
 SELECT * INTO s FROM public.mise_delivery_batch_stops WHERE id=p_stop_id FOR UPDATE;
 PERFORM 1 FROM public.dispatch_offer_assignments x WHERE x.batch_id=b.id ORDER BY x.id FOR UPDATE;
 PERFORM 1 FROM public.mise_delivery_batch_stops x WHERE x.batch_id=b.id ORDER BY x.id FOR UPDATE;
 IF a.driver_id<>p_actor_driver_id OR a.tenant_id<>p_tenant_id OR s.batch_id<>b.id
  OR s.order_id<>p_order_id OR s.type<>'dropoff' THEN
  RETURN jsonb_build_object('ok',false,'reason_code','TENANT_OR_ACTOR_AUTHORITY_MISMATCH'); END IF;
 IF o.status::text NOT IN ('out_for_delivery','unterwegs') OR b.state<>'in_progress'
  OR d.state<>'delivering' OR s.state<>'arrived' THEN
  RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_STATE_CONFLICT'); END IF;
 IF o.dispatch_version<>p_expected_order_version OR a.assignment_version<>p_expected_assignment_version
  OR b.state_version<>p_expected_batch_version OR b.route_version<>p_expected_route_version
  OR d.state_version<>p_expected_driver_version OR s.stop_version<>p_expected_stop_version THEN
  RETURN jsonb_build_object('ok',false,'reason_code','EXPECTED_VERSION_CONFLICT'); END IF;

 UPDATE public.dispatch_offer_assignments SET state='completed',assignment_version=assignment_version+1,
   updated_at=now() WHERE id=a.id;
 UPDATE public.mise_delivery_batch_stops SET state='completed',stop_version=stop_version+1,
   completed_at=coalesce(completed_at,now()) WHERE id=s.id;
 UPDATE public.customer_orders SET status='delivered',dispatch_version=dispatch_version+1,
   geliefert_am=coalesce(geliefert_am,now()),updated_at=now() WHERE id=o.id;

 SELECT count(*) INTO remaining FROM public.dispatch_offer_assignments x
   WHERE x.batch_id=b.id AND x.state IN ('assigned','accepted','picked_up','in_progress');
 next_state:=CASE WHEN remaining=0 THEN 'completed' ELSE 'in_progress' END;
 IF remaining=0 THEN
  UPDATE public.mise_delivery_batches SET state='completed',state_version=state_version+1,
    completed_at=coalesce(completed_at,now()),updated_at=now() WHERE id=b.id;
  UPDATE public.mise_drivers SET state='returning',state_version=state_version+1,
    current_capacity=greatest(current_capacity-1,0),updated_at=now() WHERE id=d.id;
 ELSE
  UPDATE public.mise_delivery_batches SET state_version=state_version+1,route_version=route_version+1,
    updated_at=now() WHERE id=b.id;
  UPDATE public.mise_drivers SET state_version=state_version+1,
    current_capacity=greatest(current_capacity-1,0),updated_at=now() WHERE id=d.id;
 END IF;
 result:=jsonb_build_object('ok',true,'state',next_state,'remaining_assignments',remaining,
  'order_version',p_expected_order_version+1,'assignment_version',p_expected_assignment_version+1,
  'batch_version',p_expected_batch_version+1,
  'route_version',p_expected_route_version+CASE WHEN remaining>0 THEN 1 ELSE 0 END,
  'driver_version',p_expected_driver_version+1,'stop_version',p_expected_stop_version+1,
  'route_replan_required',remaining>0,'correlation_id',corr);
 INSERT INTO public.dispatch_offer_audit(decision_id,idempotency_key,order_id,batch_id,driver_id,
  outcome,reason_code,expected_order_version,algorithm_version,details,correlation_id,event_type)
 VALUES(gen_random_uuid(),p_action_id,p_order_id,b.id,d.id,'completed','DELIVERY_CONFIRMED',
  p_expected_order_version,'driver-v2-t11',jsonb_build_object('remaining_assignments',remaining),
  corr,'assignment.completed');
 INSERT INTO public.driver_action_requests_v2 VALUES(
  p_action_id,p_tenant_id,p_actor_driver_id,'complete',p_order_id,fp,corr,result,now());
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.fn_driver_complete_v2(
 uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,uuid,bigint,bigint,uuid
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_driver_complete_v2(
 uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid,uuid,bigint,bigint,uuid
) TO service_role;
