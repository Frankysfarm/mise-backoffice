-- T05: durable wake notification ledger, technical ACK and restart watchdog.
-- Default-off compatibility remains a client build flag; no legacy queue is persisted server-side.

ALTER TABLE public.mise_push_outbox
  ADD COLUMN IF NOT EXISTS notification_state text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS provider_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS app_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS correlation_id uuid NOT NULL DEFAULT gen_random_uuid();

UPDATE public.mise_push_outbox
SET notification_state = CASE
  WHEN failed_at IS NOT NULL THEN 'failed'
  WHEN sent_at IS NOT NULL THEN 'provider_accepted'
  ELSE 'queued'
END
WHERE notification_state = 'queued' AND (failed_at IS NOT NULL OR sent_at IS NOT NULL);

ALTER TABLE public.mise_push_outbox
  DROP CONSTRAINT IF EXISTS mise_push_outbox_notification_state_check;
ALTER TABLE public.mise_push_outbox
  ADD CONSTRAINT mise_push_outbox_notification_state_check CHECK (
    notification_state IN ('queued','provider_accepted','app_acknowledged','expired','failed')
  );

CREATE INDEX IF NOT EXISTS idx_mise_push_outbox_recovery_claim
  ON public.mise_push_outbox (next_attempt_at, created_at)
  WHERE notification_state = 'queued';
CREATE INDEX IF NOT EXISTS idx_mise_push_outbox_app_ack
  ON public.mise_push_outbox (driver_id, id)
  WHERE notification_state IN ('provider_accepted','app_acknowledged');

CREATE TABLE IF NOT EXISTS public.driver_notification_ack_requests (
  action_id uuid PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id) ON DELETE RESTRICT,
  notification_id uuid NOT NULL REFERENCES public.mise_push_outbox(id) ON DELETE RESTRICT,
  request_fingerprint text NOT NULL,
  result jsonb NOT NULL,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dispatch_recovery_escalations (
  assignment_id uuid PRIMARY KEY REFERENCES public.dispatch_offer_assignments(id) ON DELETE RESTRICT,
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id) ON DELETE RESTRICT,
  reason_code text NOT NULL,
  assignment_version bigint NOT NULL,
  deadline_at timestamptz NOT NULL,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.batch_recovery_escalations (
  episode_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.mise_delivery_batches(id) ON DELETE RESTRICT,
  assignment_id uuid REFERENCES public.dispatch_offer_assignments(id) ON DELETE RESTRICT,
  driver_id uuid REFERENCES public.mise_drivers(id) ON DELETE RESTRICT,
  expected_batch_version bigint NOT NULL,
  observed_batch_state text NOT NULL,
  reason_code text NOT NULL,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public.batch_recovery_escalations
  ADD COLUMN IF NOT EXISTS episode_id uuid DEFAULT gen_random_uuid();
UPDATE public.batch_recovery_escalations SET episode_id=gen_random_uuid() WHERE episode_id IS NULL;
ALTER TABLE public.batch_recovery_escalations ALTER COLUMN episode_id SET NOT NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='public.batch_recovery_escalations'::regclass
      AND conname='batch_recovery_escalations_pkey'
      AND pg_get_constraintdef(oid) LIKE 'PRIMARY KEY (batch_id)%'
  ) THEN
    ALTER TABLE public.batch_recovery_escalations DROP CONSTRAINT batch_recovery_escalations_pkey;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='public.batch_recovery_escalations'::regclass
      AND contype='p'
  ) THEN
    ALTER TABLE public.batch_recovery_escalations
      ADD CONSTRAINT batch_recovery_escalations_pkey PRIMARY KEY (episode_id);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_batch_recovery_open_episode
  ON public.batch_recovery_escalations(batch_id) WHERE resolved_at IS NULL;

CREATE OR REPLACE FUNCTION public.fn_claim_wake_notifications(
  p_worker_id uuid, p_limit integer DEFAULT 50
) RETURNS SETOF public.mise_push_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN RAISE EXCEPTION 'INVALID_CLAIM_LIMIT'; END IF;
  UPDATE public.mise_push_outbox
  SET notification_state='expired', failed_at=coalesce(failed_at,now()),
      last_error='WAKE_EXPIRED', claim_token=NULL, claimed_at=NULL
  WHERE notification_state='queued' AND expires_at<=now();
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM public.mise_push_outbox
    WHERE notification_state='queued' AND expires_at>now()
      AND next_attempt_at<=now()
      AND (claimed_at IS NULL OR claimed_at<now()-interval '2 minutes')
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT p_limit
  ), claimed AS (
    UPDATE public.mise_push_outbox o
    SET claim_token=p_worker_id,claimed_at=now()
    FROM candidates c WHERE o.id=c.id
    RETURNING o.*
  ) SELECT * FROM claimed;
END $$;

CREATE OR REPLACE FUNCTION public.fn_finish_wake_notification(
  p_notification_id uuid,p_worker_id uuid,p_provider_accepted boolean,
  p_provider_message_id text,p_error text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
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
  ELSE
    UPDATE public.mise_push_outbox SET attempts=attempts+1,
      notification_state=CASE WHEN attempts+1>=5 THEN 'failed' ELSE 'queued' END,
      failed_at=CASE WHEN attempts+1>=5 THEN now() ELSE NULL END,
      next_attempt_at=now()+make_interval(secs=>least(300,5*(2^least(attempts,6))::integer)),
      last_error=coalesce(nullif(p_error,''),'PROVIDER_REJECTED'),
      claim_token=NULL,claimed_at=NULL WHERE id=o.id;
  END IF;
  RETURN jsonb_build_object('ok',true,'provider_accepted',p_provider_accepted);
END $$;

CREATE OR REPLACE FUNCTION public.fn_ack_wake_notification(
  p_driver_id uuid,p_notification_id uuid,p_action_id uuid,p_correlation_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE o public.mise_push_outbox%ROWTYPE; old public.driver_notification_ack_requests%ROWTYPE;
  fp text:=md5(pg_catalog.concat_ws('|',p_driver_id,p_notification_id));
  r jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_action_id::text,28101));
  SELECT * INTO old FROM public.driver_notification_ack_requests WHERE action_id=p_action_id;
  IF FOUND THEN
    IF old.request_fingerprint<>fp THEN
      RETURN jsonb_build_object('ok',false,'reason_code','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
    END IF;
    RETURN old.result||jsonb_build_object('idempotent_replay',true);
  END IF;
  SELECT * INTO o FROM public.mise_push_outbox WHERE id=p_notification_id FOR UPDATE;
  IF NOT FOUND OR o.driver_id<>p_driver_id THEN
    RETURN jsonb_build_object('ok',false,'reason_code','NOTIFICATION_ACK_FORBIDDEN');
  END IF;
  IF o.notification_state IN ('expired','failed') THEN
    RETURN jsonb_build_object('ok',false,'reason_code','NOTIFICATION_TERMINAL');
  END IF;
  UPDATE public.mise_push_outbox SET notification_state='app_acknowledged',
    app_acknowledged_at=coalesce(app_acknowledged_at,now()) WHERE id=o.id;
  r:=jsonb_build_object('ok',true,'technical_ack',true,'notification_id',o.id,
    'assignment_state_changed',false,'correlation_id',p_correlation_id);
  INSERT INTO public.driver_notification_ack_requests
    (action_id,driver_id,notification_id,request_fingerprint,result,correlation_id)
  VALUES(p_action_id,p_driver_id,p_notification_id,fp,r,p_correlation_id);
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.fn_watchdog_escalate_orphan_assignments(
  p_limit integer DEFAULT 50
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE n integer;
BEGIN
  IF p_limit < 1 OR p_limit > 200 THEN RAISE EXCEPTION 'INVALID_WATCHDOG_LIMIT'; END IF;
  WITH due AS (
    SELECT a.id,a.driver_id,a.assignment_version,
      coalesce(o.assignment_deadline_at,a.lease_expires_at) deadline_at
    FROM public.dispatch_offer_assignments a
    JOIN public.customer_orders o ON o.id=a.order_id
    WHERE a.state IN ('assigned','accepted','picked_up','in_progress')
      AND coalesce(o.assignment_deadline_at,a.lease_expires_at)<=now()
    ORDER BY coalesce(o.assignment_deadline_at,a.lease_expires_at)
    FOR UPDATE OF a SKIP LOCKED LIMIT p_limit
  ), inserted AS (
    INSERT INTO public.dispatch_recovery_escalations(
      assignment_id,driver_id,reason_code,assignment_version,deadline_at,correlation_id)
    SELECT id,driver_id,'ASSIGNMENT_DEADLINE_OFFLINE',assignment_version,deadline_at,gen_random_uuid()
    FROM due ON CONFLICT (assignment_id) DO NOTHING RETURNING *
  ), wakes AS (
    INSERT INTO public.mise_push_outbox(driver_id,type,title,body,sound,priority,data,correlation_id)
    SELECT driver_id,'recovery_snapshot_required','Status aktualisieren',
      'Bitte App öffnen und aktuellen Stand laden.','default','high',
      jsonb_build_object('wake_only',true,'snapshot_path','/api/driver/v2/snapshot',
        'assignment_id',assignment_id),correlation_id FROM inserted RETURNING 1
  ) SELECT count(*) INTO n FROM wakes;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.fn_escalate_batch_recovery(
  p_batch_id uuid,p_expected_batch_version bigint,p_reason_code text,p_correlation_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE b public.mise_delivery_batches%ROWTYPE; a public.dispatch_offer_assignments%ROWTYPE;
  inserted_count integer;
BEGIN
  SELECT * INTO b FROM public.mise_delivery_batches WHERE id=p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason_code','BATCH_NOT_FOUND'); END IF;
  IF b.state_version<>p_expected_batch_version THEN
    RETURN jsonb_build_object('ok',false,'reason_code','BATCH_VERSION_CONFLICT');
  END IF;
  SELECT * INTO a FROM public.dispatch_offer_assignments
    WHERE batch_id=b.id AND state IN ('assigned','accepted','picked_up','in_progress')
    ORDER BY updated_at DESC LIMIT 1 FOR UPDATE;
  INSERT INTO public.batch_recovery_escalations(
    batch_id,assignment_id,driver_id,expected_batch_version,observed_batch_state,
    reason_code,correlation_id)
  VALUES(b.id,a.id,b.driver_id,p_expected_batch_version,b.state,p_reason_code,p_correlation_id)
  ON CONFLICT (batch_id) WHERE resolved_at IS NULL DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF a.id IS NOT NULL AND inserted_count=1 THEN
    INSERT INTO public.mise_push_outbox(driver_id,type,title,body,sound,priority,data,correlation_id)
    SELECT a.driver_id,'recovery_snapshot_required','Status aktualisieren',
      'Bitte App öffnen und aktuellen Stand laden.','default','high',
      jsonb_build_object('wake_only',true,'snapshot_path','/api/driver/v2/snapshot',
        'assignment_id',a.id),p_correlation_id
    ;
  END IF;
  RETURN jsonb_build_object('ok',true,'escalated',true,'batch_id',b.id,
    'batch_state',b.state,'batch_version',b.state_version,'assignment_state_changed',false,
    'ownership_released',false,'idempotent_replay',inserted_count=0,
    'correlation_id',p_correlation_id);
END $$;

REVOKE ALL ON FUNCTION public.fn_claim_wake_notifications(uuid,integer),
  public.fn_finish_wake_notification(uuid,uuid,boolean,text,text),
  public.fn_ack_wake_notification(uuid,uuid,uuid,uuid),
  public.fn_watchdog_escalate_orphan_assignments(integer),
  public.fn_escalate_batch_recovery(uuid,bigint,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_claim_wake_notifications(uuid,integer),
  public.fn_finish_wake_notification(uuid,uuid,boolean,text,text),
  public.fn_ack_wake_notification(uuid,uuid,uuid,uuid),
  public.fn_watchdog_escalate_orphan_assignments(integer),
  public.fn_escalate_batch_recovery(uuid,bigint,text,uuid) TO service_role;

ALTER TABLE public.driver_notification_ack_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_recovery_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_recovery_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mise_push_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.driver_notification_ack_requests,
  public.dispatch_recovery_escalations,
  public.batch_recovery_escalations FROM anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.mise_push_outbox FROM anon,authenticated;
GRANT ALL ON public.driver_notification_ack_requests,
  public.dispatch_recovery_escalations,
  public.batch_recovery_escalations TO service_role;
GRANT ALL ON public.mise_push_outbox TO service_role;

DROP POLICY IF EXISTS t05_service_only ON public.driver_notification_ack_requests;
CREATE POLICY t05_service_only ON public.driver_notification_ack_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS t05_service_only ON public.dispatch_recovery_escalations;
CREATE POLICY t05_service_only ON public.dispatch_recovery_escalations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS t05_service_only ON public.batch_recovery_escalations;
CREATE POLICY t05_service_only ON public.batch_recovery_escalations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS t05_service_only ON public.mise_push_outbox;
CREATE POLICY t05_service_only ON public.mise_push_outbox
  FOR ALL TO service_role USING (true) WITH CHECK (true);
