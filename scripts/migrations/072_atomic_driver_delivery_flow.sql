-- 072: Atomic, ownership-bound pickup and delivery transitions.
-- Prevents partial tour state when a request is retried or interrupted midway.
begin;

create or replace function public.complete_driver_pickup(
  p_order_id uuid,
  p_driver_id uuid
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_order public.customer_orders%rowtype;
  v_batch public.mise_delivery_batches%rowtype;
begin
  select * into strict v_order
  from public.customer_orders
  where id=p_order_id
  for update;

  if v_order.mise_batch_id is null then
    return jsonb_build_object('ok',false,'code','active_stop_missing','error','Bestellung gehört zu keiner aktiven Tour');
  end if;

  select * into strict v_batch
  from public.mise_delivery_batches
  where id=v_order.mise_batch_id and driver_id=p_driver_id
  for update;

  if v_batch.state not in ('assigned','at_restaurant','picked_up','in_progress') then
    return jsonb_build_object('ok',false,'code','active_stop_missing','error','Tour ist nicht mehr aktiv');
  end if;
  if not exists(
    select 1 from public.mise_delivery_batch_stops s
    where s.batch_id=v_batch.id and s.order_id=v_order.id and s.type='dropoff'
      and not coalesce(s.cancelled,false)
  ) then
    return jsonb_build_object('ok',false,'code','active_stop_missing','error','Aktiver Stopp fehlt');
  end if;
  if v_batch.assignment_mode='own_fleet' then
    return jsonb_build_object('ok',false,'code','qr_handoff_required','error','Interne Touren starten ausschließlich über die vollständige QR-Übergabe');
  end if;

  -- An already committed pickup is a successful no-op for client retries.
  if v_order.status::text='unterwegs' and v_batch.state in ('picked_up','in_progress') then
    return jsonb_build_object('ok',true,'already_picked_up',true,'batch_id',v_batch.id,'should_reroute',false);
  end if;

  -- A bundle leaves the restaurant as one custody unit. Every non-cancelled
  -- order must be ready and every item must have durable pick evidence.
  if exists(
    select 1
    from public.mise_delivery_batch_stops s
    join public.customer_orders o on o.id=s.order_id
    where s.batch_id=v_batch.id and s.type='dropoff' and not coalesce(s.cancelled,false)
      and o.status::text not in ('fertig','unterwegs')
  ) then
    return jsonb_build_object('ok',false,'code','order_not_ready','error','Mindestens eine Bestellung ist noch nicht abholbereit');
  end if;
  if exists(
    select 1
    from public.mise_delivery_batch_stops s
    join public.order_items oi on oi.order_id=s.order_id
    where s.batch_id=v_batch.id and s.type='dropoff' and not coalesce(s.cancelled,false)
      and oi.pick_confirmed_at is null
  ) then
    return jsonb_build_object('ok',false,'code','pick_not_confirmed','error','Noch nicht alle Artikel sind bestätigt');
  end if;

  update public.mise_delivery_batch_stops
  set completed_at=coalesce(completed_at,now())
  where batch_id=v_batch.id and type='pickup' and not coalesce(cancelled,false);

  update public.customer_orders o
  set status='unterwegs',updated_at=now()
  where o.id in (
    select s.order_id from public.mise_delivery_batch_stops s
    where s.batch_id=v_batch.id and s.type='dropoff' and not coalesce(s.cancelled,false)
  ) and o.status::text='fertig';

  update public.mise_delivery_batches
  set state='in_progress',picked_up_at=coalesce(picked_up_at,now()),updated_at=now()
  where id=v_batch.id;
  update public.mise_drivers set state='en_route',updated_at=now() where id=p_driver_id;

  return jsonb_build_object('ok',true,'batch_id',v_batch.id,'should_reroute',true);
exception when no_data_found then
  return jsonb_build_object('ok',false,'code','active_stop_missing','error','Tour oder Bestellung gehört nicht zu diesem Fahrer');
end $function$;

create or replace function public.complete_driver_delivery(
  p_order_id uuid,
  p_driver_id uuid,
  p_delivery_proof jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_order public.customer_orders%rowtype;
  v_batch public.mise_delivery_batches%rowtype;
  v_stop public.mise_delivery_batch_stops%rowtype;
  v_now timestamptz:=now();
  v_open_stops integer;
begin
  select * into strict v_order
  from public.customer_orders
  where id=p_order_id
  for update;

  if v_order.mise_batch_id is null then
    return jsonb_build_object('ok',false,'code','active_stop_missing','error','Bestellung gehört zu keiner Tour');
  end if;
  select * into strict v_batch
  from public.mise_delivery_batches
  where id=v_order.mise_batch_id and driver_id=p_driver_id
  for update;
  select * into strict v_stop
  from public.mise_delivery_batch_stops
  where batch_id=v_batch.id and order_id=v_order.id and type='dropoff'
    and not coalesce(cancelled,false)
  for update;

  if v_order.status::text='geliefert' then
    return jsonb_build_object(
      'ok',true,'already_delivered',true,'batch_id',v_batch.id,
      'batch_completed',v_batch.state='completed'
    );
  end if;
  if v_batch.state not in ('picked_up','in_progress') or v_order.status::text<>'unterwegs' then
    return jsonb_build_object('ok',false,'code','order_not_picked_up','error','Bestellung wurde noch nicht abgeholt');
  end if;

  update public.mise_delivery_batch_stops
  set completed_at=coalesce(completed_at,v_now),
      delivery_proof=coalesce(p_delivery_proof,'{}'::jsonb)||jsonb_build_object('delivered_at',v_now)
  where id=v_stop.id;

  update public.customer_orders
  set status='geliefert',
      bezahlt=case when bezahlt is not true and (zahlungsart='bar' or zahlungsart is null) then true else bezahlt end,
      zahlungsart=case when bezahlt is not true and (zahlungsart='bar' or zahlungsart is null) then 'bar' else zahlungsart end,
      stripe_payment_id=case
        when bezahlt is not true and (zahlungsart='bar' or zahlungsart is null)
          then 'cash:driver:'||p_driver_id::text||':'||v_now::text
        else stripe_payment_id
      end,
      updated_at=v_now
  where id=v_order.id and status::text='unterwegs';

  select count(*) into v_open_stops
  from public.mise_delivery_batch_stops
  where batch_id=v_batch.id and not coalesce(cancelled,false) and completed_at is null;

  if v_open_stops=0 then
    update public.mise_delivery_batches
    set state='completed',completed_at=coalesce(completed_at,v_now),updated_at=v_now
    where id=v_batch.id;
    update public.driver_status set aktueller_batch_id=null where aktueller_batch_id=v_batch.id;
    update public.mise_drivers
    set state=case
          when dispatch_availability='paused' then 'offline'
          when state='en_route' then 'returning'
          else state
        end,
        updated_at=v_now
    where id=p_driver_id;
  end if;

  return jsonb_build_object(
    'ok',true,'already_delivered',false,'batch_id',v_batch.id,
    'batch_completed',v_open_stops=0
  );
exception when no_data_found then
  return jsonb_build_object('ok',false,'code','active_stop_missing','error','Tour oder Bestellung gehört nicht zu diesem Fahrer');
end $function$;

revoke all on function public.complete_driver_pickup(uuid,uuid) from public,anon,authenticated;
revoke all on function public.complete_driver_delivery(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.complete_driver_pickup(uuid,uuid) to service_role;
grant execute on function public.complete_driver_delivery(uuid,uuid,jsonb) to service_role;

notify pgrst,'reload schema';
commit;
