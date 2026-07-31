-- Standard APNs assignment alarms: bounded reminders, never VoIP.
-- Total delivery attempts per batch are capped at three (initial + two reminders).
-- Once the batch is accepted its state is no longer pending_acceptance, so
-- acceptance stops reminders without a separate timer or best-effort cancellation.

CREATE OR REPLACE FUNCTION public.fn_repush_pending_batches()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer := 0;
  v_batch record;
BEGIN
  -- Only one reminder producer may decide at a time.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('mise-apns-assignment-reminders', 28401)) THEN
    RETURN 0;
  END IF;

  FOR v_batch IN
    SELECT b.id, b.driver_id
    FROM public.mise_delivery_batches b
    WHERE b.state = 'pending_acceptance'
      AND b.driver_id IS NOT NULL
      AND b.created_at <= now() - interval '45 seconds'
      AND (
        SELECT count(*)
        FROM public.mise_push_outbox p
        WHERE p.driver_id = b.driver_id
          AND p.type IN ('assign', 'order_assigned')
          AND p.data->>'batch_id' = b.id::text
      ) < 3
      AND coalesce((
        SELECT max(p.created_at)
        FROM public.mise_push_outbox p
        WHERE p.driver_id = b.driver_id
          AND p.type IN ('assign', 'order_assigned')
          AND p.data->>'batch_id' = b.id::text
      ), b.created_at) <= now() - interval '45 seconds'
    ORDER BY b.created_at
    FOR UPDATE OF b SKIP LOCKED
  LOOP
    INSERT INTO public.mise_push_outbox(driver_id,type,title,body,sound,priority,data)
    VALUES (
      v_batch.driver_id,
      'order_assigned',
      'Neue Lieferung',
      'Bitte Lieferung jetzt annehmen.',
      'alarm.caf',
      'high',
      jsonb_build_object('batch_id',v_batch.id,'wake_only',true,'reminder',true)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_repush_pending_batches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_repush_pending_batches() TO service_role;

COMMENT ON FUNCTION public.fn_repush_pending_batches() IS
  'Enqueues at most two APNs reminders after the initial assignment; batch acceptance stops them.';
