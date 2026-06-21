-- F4: merge_mise_order_into_active_batch
-- Hängt die Stops eines Ein-Order-Batches (pending_acceptance) in einen bereits
-- angenommenen aktiven Batch (assigned/at_restaurant). Pickup-Dedup via Haversine
-- < 0.1 km (wie addOrderToBundle in lib/frank.ts). Der leere Order-Batch wird
-- soft-cancelled (state='cancelled'), KEIN Hard-Delete.
-- Idempotent: ein bereits gemergter / nicht-aktiver Order-Batch ist ein No-Op.
-- SECURITY DEFINER, owned by supabase_admin.

CREATE OR REPLACE FUNCTION public.merge_mise_order_into_active_batch(
  p_active_batch_id uuid,
  p_order_batch_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_active        record;
  v_order_batch   record;
  v_max_seq       int;
  v_next_seq      int;
  v_stop          record;
  v_dup_pickup    uuid;
  v_moved         int := 0;
  v_dropoff_ct    int := 0;
BEGIN
  -- Haversine helper inline (km)
  -- Beide Batches laden + sperren
  SELECT id, driver_id, state INTO v_active
    FROM public.mise_delivery_batches
   WHERE id = p_active_batch_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active batch % not found', p_active_batch_id;
  END IF;

  -- Ziel-Batch muss wirklich aktiv (angenommen) sein
  IF v_active.state NOT IN ('assigned','at_restaurant') THEN
    RAISE EXCEPTION 'active batch % not in mergeable state (%)', p_active_batch_id, v_active.state;
  END IF;

  SELECT id, driver_id, state INTO v_order_batch
    FROM public.mise_delivery_batches
   WHERE id = p_order_batch_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order batch % not found', p_order_batch_id;
  END IF;

  -- Idempotenz: schon gemergt / nicht mehr offen -> No-Op
  IF v_order_batch.state = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'reason', 'order batch already cancelled');
  END IF;

  IF v_order_batch.state <> 'pending_acceptance' THEN
    RAISE EXCEPTION 'order batch % not in pending_acceptance (%) — refusing merge', p_order_batch_id, v_order_batch.state;
  END IF;

  -- Selber Fahrer erzwingen (Sicherheit)
  IF v_order_batch.driver_id <> v_active.driver_id THEN
    RAISE EXCEPTION 'order batch driver % != active batch driver %', v_order_batch.driver_id, v_active.driver_id;
  END IF;

  -- Aktuelle max sequence im aktiven Batch
  SELECT COALESCE(MAX(sequence), -1) INTO v_max_seq
    FROM public.mise_delivery_batch_stops
   WHERE batch_id = p_active_batch_id;
  v_next_seq := v_max_seq + 1;

  -- Stops des Order-Batches durchgehen (pickups zuerst, dann dropoffs)
  FOR v_stop IN
    SELECT id, order_id, type, lat, lng, address
      FROM public.mise_delivery_batch_stops
     WHERE batch_id = p_order_batch_id
     ORDER BY (type = 'pickup') DESC, sequence ASC
  LOOP
    IF v_stop.type = 'pickup' THEN
      -- Pickup-Dedup: existiert schon ein Pickup im aktiven Batch < 0.1 km?
      SELECT s.id INTO v_dup_pickup
        FROM public.mise_delivery_batch_stops s
       WHERE s.batch_id = p_active_batch_id
         AND s.type = 'pickup'
         AND s.lat IS NOT NULL AND s.lng IS NOT NULL
         AND v_stop.lat IS NOT NULL AND v_stop.lng IS NOT NULL
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
        -- Dedup: doppelten Pickup-Stop des Order-Batches verwerfen (Hard-Delete eines
        -- redundanten Routing-Stops ist ok; es ist KEINE Order/Verbindung).
        DELETE FROM public.mise_delivery_batch_stops WHERE id = v_stop.id;
        CONTINUE;
      END IF;

      -- Pickup neu (anderes Restaurant) -> umhängen
      UPDATE public.mise_delivery_batch_stops
         SET batch_id = p_active_batch_id, sequence = v_next_seq
       WHERE id = v_stop.id;
      v_next_seq := v_next_seq + 1;
      v_moved := v_moved + 1;
    ELSE
      -- Dropoff -> umhängen
      UPDATE public.mise_delivery_batch_stops
         SET batch_id = p_active_batch_id, sequence = v_next_seq
       WHERE id = v_stop.id;
      v_next_seq := v_next_seq + 1;
      v_moved := v_moved + 1;
      v_dropoff_ct := v_dropoff_ct + 1;
    END IF;
  END LOOP;

  -- Orders dieses Order-Batches auf den aktiven Batch + dessen Fahrer umpointen
  UPDATE public.customer_orders
     SET mise_batch_id = p_active_batch_id,
         mise_driver_id = v_active.driver_id
   WHERE mise_batch_id = p_order_batch_id;

  -- Order-Batch ist jetzt leer -> soft cancel (KEIN Hard-Delete)
  UPDATE public.mise_delivery_batches
     SET state = 'cancelled',
         cancelled_at = now(),
         cancellation_reason = 'merged into active batch ' || p_active_batch_id::text
   WHERE id = p_order_batch_id;

  -- Decision-Log
  INSERT INTO public.mise_frank_decisions (type, driver_id, order_ids, reason_text)
  VALUES ('bundle', v_active.driver_id,
          COALESCE((
            SELECT array_agg(id) FROM public.customer_orders WHERE mise_batch_id = p_active_batch_id
          ), '{}'),
          'Order in aktive Tour aufgenommen (Einzelannahme + Merge).');

  RETURN jsonb_build_object(
    'ok', true,
    'noop', false,
    'active_batch_id', p_active_batch_id,
    'order_batch_id', p_order_batch_id,
    'stops_moved', v_moved,
    'dropoffs_added', v_dropoff_ct
  );
END;
$function$;

ALTER FUNCTION public.merge_mise_order_into_active_batch(uuid, uuid) OWNER TO supabase_admin;

REVOKE ALL ON FUNCTION public.merge_mise_order_into_active_batch(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_mise_order_into_active_batch(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
