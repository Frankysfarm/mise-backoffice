BEGIN;

DROP FUNCTION IF EXISTS public.merge_mise_order_into_active_batch(uuid, uuid);

CREATE FUNCTION public.merge_mise_order_into_active_batch(
  p_active_batch_id uuid,
  p_order_batch_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_active             record;
  v_order_batch        record;
  v_max_seq            integer;
  v_next_seq           integer;
  v_stop               record;
  v_dup_pickup         uuid;
  v_moved              integer := 0;
  v_dropoff_ct         integer := 0;
  v_active_stop_count  integer := 0;
  v_claim_role         text;
BEGIN
  SELECT id, driver_id, state
    INTO v_active
    FROM public.mise_delivery_batches
   WHERE id = p_active_batch_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active batch % not found', p_active_batch_id;
  END IF;

  IF v_active.state NOT IN ('assigned', 'at_restaurant') THEN
    RAISE EXCEPTION 'active batch % not in mergeable state (%)',
      p_active_batch_id, v_active.state;
  END IF;

  v_claim_role := COALESCE(current_setting('request.jwt.claim.role', true), '');
  IF session_user NOT IN ('postgres', 'supabase_admin')
     AND v_claim_role <> 'service_role'
     AND NOT EXISTS (
       SELECT 1
         FROM public.mise_drivers d
        WHERE d.id = v_active.driver_id
          AND d.auth_user_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'driver is not authorized for active batch %', p_active_batch_id
      USING ERRCODE = '42501';
  END IF;

  SELECT id, driver_id, state
    INTO v_order_batch
    FROM public.mise_delivery_batches
   WHERE id = p_order_batch_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order batch % not found', p_order_batch_id;
  END IF;

  IF v_order_batch.state = 'cancelled' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'noop', true,
      'reason', 'order batch already cancelled'
    );
  END IF;

  IF v_order_batch.state <> 'pending_acceptance' THEN
    RAISE EXCEPTION 'order batch % not in pending_acceptance (%)',
      p_order_batch_id, v_order_batch.state;
  END IF;

  IF v_order_batch.driver_id <> v_active.driver_id THEN
    RAISE EXCEPTION 'order batch driver % != active batch driver %',
      v_order_batch.driver_id, v_active.driver_id;
  END IF;

  SELECT COALESCE(MAX(sequence), -1)
    INTO v_max_seq
    FROM public.mise_delivery_batch_stops
   WHERE batch_id = p_active_batch_id;
  v_next_seq := v_max_seq + 1;

  FOR v_stop IN
    SELECT id, order_id, type, lat, lng, address
      FROM public.mise_delivery_batch_stops
     WHERE batch_id = p_order_batch_id
     ORDER BY (type = 'pickup') DESC, sequence ASC
  LOOP
    IF v_stop.type = 'pickup' THEN
      SELECT s.id
        INTO v_dup_pickup
        FROM public.mise_delivery_batch_stops s
       WHERE s.batch_id = p_active_batch_id
         AND s.type = 'pickup'
         AND s.lat IS NOT NULL
         AND s.lng IS NOT NULL
         AND v_stop.lat IS NOT NULL
         AND v_stop.lng IS NOT NULL
         AND (
           6371 * acos(
             LEAST(1.0, GREATEST(-1.0,
               cos(radians(s.lat)) * cos(radians(v_stop.lat)) *
               cos(radians(v_stop.lng) - radians(s.lng)) +
               sin(radians(s.lat)) * sin(radians(v_stop.lat))
             ))
           )
         ) < 0.1
       LIMIT 1;

      IF v_dup_pickup IS NOT NULL THEN
        DELETE FROM public.mise_delivery_batch_stops WHERE id = v_stop.id;
        CONTINUE;
      END IF;
    END IF;

    UPDATE public.mise_delivery_batch_stops
       SET batch_id = p_active_batch_id,
           sequence = v_next_seq
     WHERE id = v_stop.id;
    v_next_seq := v_next_seq + 1;
    v_moved := v_moved + 1;

    IF v_stop.type = 'dropoff' THEN
      v_dropoff_ct := v_dropoff_ct + 1;
    END IF;
  END LOOP;

  UPDATE public.customer_orders
     SET mise_batch_id = p_active_batch_id,
         mise_driver_id = v_active.driver_id
   WHERE mise_batch_id = p_order_batch_id;

  SELECT COUNT(*)
    INTO v_active_stop_count
    FROM public.mise_delivery_batch_stops
   WHERE batch_id = p_active_batch_id;

  UPDATE public.mise_delivery_batches
     SET stop_count = v_active_stop_count,
         modification_count = modification_count + 1,
         last_modified_at = now()
   WHERE id = p_active_batch_id;

  UPDATE public.mise_delivery_batches
     SET state = 'cancelled',
         stop_count = 0,
         cancelled_at = now(),
         cancellation_reason = 'merged into active batch ' || p_active_batch_id::text,
         last_modified_at = now()
   WHERE id = p_order_batch_id;

  INSERT INTO public.mise_frank_decisions (type, driver_id, order_ids, reason_text)
  VALUES (
    'bundle',
    v_active.driver_id,
    COALESCE((
      SELECT array_agg(id)
        FROM public.customer_orders
       WHERE mise_batch_id = p_active_batch_id
    ), '{}'::uuid[]),
    'Order in aktive Tour aufgenommen (Einzelannahme + Merge).'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'noop', false,
    'active_batch_id', p_active_batch_id,
    'order_batch_id', p_order_batch_id,
    'stops_moved', v_moved,
    'dropoffs_added', v_dropoff_ct,
    'active_stop_count', v_active_stop_count
  );
END;
$function$;

ALTER FUNCTION public.merge_mise_order_into_active_batch(uuid, uuid)
  OWNER TO supabase_admin;

REVOKE ALL ON FUNCTION public.merge_mise_order_into_active_batch(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_mise_order_into_active_batch(uuid, uuid)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
