-- 060: Fahrer-Pick-Flow-Funktionen versionieren (P0-4 aus RELEASE-COMPLETION-PLAN-DRIVER-V1)
--
-- confirm_pick_item + confirm_pickup_complete existierten bislang NUR in der
-- Live-DB (direkt angelegt, keine Migration). Extrahiert am 12.08.2026 per
-- pg_get_functiondef aus supabase-db (mise-gastro.de), Wortlaut unverändert.
-- Der Fahrer-Client ruft beide direkt auf:
--   confirm_pick_item        -> app/fahrer/app/pick-dialog.tsx ("Ist dabei"/"Fehlt")
--   confirm_pickup_complete  -> app/fahrer/app/client.tsx completeAndRoute ("Route berechnen")
--
-- Review-Notizen (bewusst NICHT geändert — Feature-Freeze, Verhalten = Live):
--  * confirm_pickup_complete hat keinen SET search_path (Härtung -> Backlog P2).
--  * confirm_pick_item prüft nur "ist Fahrer", nicht "ist DIESER Tour zugewiesen"
--    (jeder eingeloggte Fahrer kann Items beliebiger Orders bestätigen -> Backlog P2).
--  * EXECUTE liegt per Default-ACL auch bei anon; auth.uid() IS NULL läuft in den
--    "Nicht als Fahrer"-Guard, daher kein Datenzugriff ohne Login.
-- Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.confirm_pick_item(p_order_item_id uuid, p_missing boolean DEFAULT false, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_driver_id uuid;
  v_order_id uuid;
  v_tenant_id uuid;
BEGIN
  SELECT id
    INTO v_driver_id
    FROM public.employees
   WHERE auth_user_id = auth.uid()
     AND kann_ausliefern = true;

  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nicht als Fahrer eingeloggt');
  END IF;

  SELECT oi.order_id, co.tenant_id
    INTO v_order_id, v_tenant_id
    FROM public.order_items oi
    JOIN public.customer_orders co ON co.id = oi.order_id
   WHERE oi.id = p_order_item_id;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Item nicht gefunden');
  END IF;

  UPDATE public.order_items
     SET pick_confirmed_at = now(),
         pick_missing = coalesce(p_missing, false),
         pick_missing_note = p_note
   WHERE id = p_order_item_id;

  -- Die frühere Funktion schrieb in die nicht vorhandene Tabelle push_outbox.
  -- Fehlende Artikel werden stattdessen zuverlässig im Frank-Audit protokolliert.
  IF p_missing THEN
    INSERT INTO public.mise_frank_decisions (
      type,
      driver_id,
      order_ids,
      reason_text,
      reason_data
    )
    VALUES (
      'alert',
      NULL,
      ARRAY[v_order_id],
      'PICK_ITEM_MISSING: ' || coalesce(p_note, 'Item nicht in der Tasche'),
      jsonb_build_object(
        'tenant_id', v_tenant_id,
        'employee_id', v_driver_id,
        'order_item_id', p_order_item_id
      )
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END
$function$;

CREATE OR REPLACE FUNCTION public.confirm_pickup_complete(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_driver_id uuid;
  v_missing_count int;
  v_total_items int;
begin
  select id into v_driver_id from employees where auth_user_id = auth.uid() and kann_ausliefern = true;
  if v_driver_id is null then return jsonb_build_object('ok', false, 'error', 'Nicht als Fahrer'); end if;

  -- Check: alle Items dieses Batches gepickt?
  select
    count(*) filter (where oi.pick_confirmed_at is null),
    count(*)
    into v_missing_count, v_total_items
    from delivery_batch_stops s
    join order_items oi on oi.order_id = s.order_id
    where s.batch_id = p_batch_id;

  if v_missing_count > 0 then
    return jsonb_build_object('ok', false, 'error',
      format('%s von %s Items noch nicht bestätigt', v_missing_count, v_total_items));
  end if;

  update delivery_batches set status = 'unterwegs'::batch_status where id = p_batch_id;

  -- Mise-Batch: Pickups als erledigt markieren + state -> on_route (zeigt DeliveryView)
  update mise_delivery_batch_stops set completed_at = now()
    where batch_id = p_batch_id and type = 'pickup' and completed_at is null;
  update mise_delivery_batches set state = 'in_progress', picked_up_at = now()
    where id = p_batch_id and state in ('assigned','at_restaurant');
  update mise_drivers set state = 'en_route'
    where id = (select driver_id from mise_delivery_batches where id = p_batch_id);

  return jsonb_build_object('ok', true);
end $function$;

GRANT EXECUTE ON FUNCTION public.confirm_pick_item(uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_pickup_complete(uuid) TO authenticated, service_role;
