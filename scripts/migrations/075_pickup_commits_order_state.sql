-- 075: A committed pickup must move every ready delivery order to `unterwegs`.
--
-- The driver UI completes a QR/item handoff through confirm_pickup_complete().
-- The previous function committed batch custody but left customer_orders at
-- `fertig`, so the atomic delivery endpoint correctly rejected the next step
-- with order_not_picked_up. Keep batch, stops, driver and orders in one locked
-- transaction and reject a pickup while any order is not kitchen-ready.

begin;

create or replace function public.confirm_pickup_complete(p_batch_id uuid)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_driver_id uuid;
  v_batch public.mise_delivery_batches%rowtype;
  v_missing_count integer;
  v_total_items integer;
  v_incomplete_orders integer;
  v_unready_orders integer;
begin
  select id into v_driver_id
  from public.mise_drivers
  where auth_user_id=auth.uid() and active and approved_at is not null and not rejected;
  if v_driver_id is null then
    return jsonb_build_object('ok',false,'error','Nicht als Fahrer eingeloggt');
  end if;

  select * into strict v_batch
  from public.mise_delivery_batches
  where id=p_batch_id and driver_id=v_driver_id and state in ('assigned','at_restaurant')
  for update;

  -- Lock every active delivery order before checking and changing custody.
  perform 1
  from public.customer_orders o
  where o.id in (
    select s.order_id
    from public.mise_delivery_batch_stops s
    where s.batch_id=p_batch_id and s.type='dropoff' and not coalesce(s.cancelled,false)
  )
  order by o.id
  for update;

  select count(*) filter(where oi.pick_confirmed_at is null),count(*)
    into v_missing_count,v_total_items
  from public.mise_delivery_batch_stops s
  join public.order_items oi on oi.order_id=s.order_id
  where s.batch_id=p_batch_id and s.type='dropoff' and not coalesce(s.cancelled,false);
  if v_missing_count>0 then
    return jsonb_build_object(
      'ok',false,
      'error',format('%s von %s Artikeln noch nicht bestätigt',v_missing_count,v_total_items)
    );
  end if;

  select count(*) into v_unready_orders
  from public.mise_delivery_batch_stops s
  join public.customer_orders o on o.id=s.order_id
  where s.batch_id=p_batch_id and s.type='dropoff' and not coalesce(s.cancelled,false)
    and o.status::text not in ('fertig','unterwegs','storniert','geliefert','abgeschlossen');
  if v_unready_orders>0 then
    return jsonb_build_object('ok',false,'error','Mindestens eine Bestellung ist noch nicht abholbereit');
  end if;

  if v_batch.assignment_mode='own_fleet' then
    select count(*) into v_incomplete_orders
    from public.mise_delivery_batch_stops s
    join public.customer_orders o on o.id=s.order_id
    where s.batch_id=p_batch_id and s.type='dropoff' and not coalesce(s.cancelled,false)
      and o.status::text not in ('storniert','geliefert','abgeschlossen')
      and not coalesce((s.pick_verification->>'complete')::boolean,false);
    if v_incomplete_orders>0 or v_batch.handoff_state<>'ready' then
      return jsonb_build_object('ok',false,'error','Erst alle Beutel-QR-Codes scannen');
    end if;
  end if;

  update public.mise_delivery_batch_stops
  set completed_at=coalesce(completed_at,now())
  where batch_id=p_batch_id and type='pickup' and completed_at is null;

  update public.customer_orders o
  set status='unterwegs',updated_at=now()
  where o.id in (
    select s.order_id
    from public.mise_delivery_batch_stops s
    where s.batch_id=p_batch_id and s.type='dropoff' and not coalesce(s.cancelled,false)
  ) and o.status::text='fertig';

  update public.mise_delivery_batches
  set state='in_progress',picked_up_at=coalesce(picked_up_at,now()),
      handoff_state=case when assignment_mode='own_fleet' then 'committed' else handoff_state end,
      committed_at=case when assignment_mode='own_fleet' then coalesce(committed_at,now()) else committed_at end,
      updated_at=now()
  where id=p_batch_id;

  update public.mise_drivers
  set state='en_route',updated_at=now()
  where id=v_driver_id;

  return jsonb_build_object(
    'ok',true,
    'batch_id',p_batch_id,
    'handoff_state',case when v_batch.assignment_mode='own_fleet' then 'committed' else v_batch.handoff_state end
  );
exception when no_data_found then
  return jsonb_build_object('ok',false,'error','Tour gehört nicht zu diesem Fahrer');
end $function$;

revoke all on function public.confirm_pickup_complete(uuid) from public,anon;
grant execute on function public.confirm_pickup_complete(uuid) to authenticated,service_role;

notify pgrst,'reload schema';
commit;
