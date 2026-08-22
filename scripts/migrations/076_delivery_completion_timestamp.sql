-- 076: Keep the public order completion timestamp in the same atomic commit as
-- the drop-off stop and batch completion. Analytics and customer tracking use
-- customer_orders.geliefert_am as their authoritative completion time.

begin;

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
      geliefert_am=coalesce(geliefert_am,v_now),
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

revoke all on function public.complete_driver_delivery(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.complete_driver_delivery(uuid,uuid,jsonb) to service_role;

notify pgrst,'reload schema';
commit;
