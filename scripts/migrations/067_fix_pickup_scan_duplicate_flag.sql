-- Report whether this exact bag QR had already been scanned before this call.
-- Migration 066 derived the flag after merging the current bag into the array,
-- which made the first bag of a multi-bag order look new but every later bag
-- look duplicated. The stored handoff state was already idempotent; this fixes
-- the API contract consumed by the driver app and QA monitoring.
create or replace function public.scan_delivery_pickup_bag(
  p_batch_id uuid,
  p_driver_id uuid,
  p_order_id uuid,
  p_bag_index integer
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_batch public.mise_delivery_batches%rowtype;
  v_stop public.mise_delivery_batch_stops%rowtype;
  v_bag_count integer;
  v_scanned integer[];
  v_already_scanned boolean;
  v_order_complete boolean;
  v_incomplete_orders integer;
  v_total_orders integer;
  v_scanned_orders integer;
begin
  select * into strict v_batch from public.mise_delivery_batches
    where id=p_batch_id and driver_id=p_driver_id for update;
  if v_batch.assignment_mode<>'own_fleet' or v_batch.state not in ('assigned','at_restaurant')
     or v_batch.handoff_state not in ('planned','scanning','ready') then
    return jsonb_build_object('ok',false,'error','Tour ist nicht mehr in der Übergabe');
  end if;

  select s.* into strict v_stop
  from public.mise_delivery_batch_stops s
  where s.batch_id=p_batch_id and s.order_id=p_order_id and s.type='dropoff'
    and not coalesce(s.cancelled,false)
    and exists(select 1 from public.customer_orders o where o.id=s.order_id and o.status::text not in ('storniert','geliefert','abgeschlossen'))
  for update;
  select delivery_bag_count into strict v_bag_count
  from public.customer_orders where id=p_order_id for update;

  if p_bag_index<1 or p_bag_index>v_bag_count then
    return jsonb_build_object('ok',false,'error','Ungültige Beutelnummer');
  end if;

  select exists(
    select 1
    from jsonb_array_elements_text(coalesce(v_stop.pick_verification->'scanned_bags','[]'::jsonb)) value
    where value ~ '^[0-9]+$' and value::integer=p_bag_index
  ) into v_already_scanned;

  select coalesce(array_agg(distinct x order by x),'{}'::integer[]) into v_scanned
  from (
    select value::integer x
    from jsonb_array_elements_text(coalesce(v_stop.pick_verification->'scanned_bags','[]'::jsonb)) value
    where value ~ '^[0-9]+$'
    union all select p_bag_index
  ) bags;
  v_order_complete:=coalesce(cardinality(v_scanned),0)>=v_bag_count;

  update public.mise_delivery_batch_stops
  set pick_verification=jsonb_build_object(
    'method','bag_qr','required_bags',v_bag_count,'scanned_bags',to_jsonb(v_scanned),
    'complete',v_order_complete,'last_scanned_at',now()
  ) where id=v_stop.id;

  if v_order_complete then
    update public.order_items set pick_confirmed_at=coalesce(pick_confirmed_at,now()),pick_missing=coalesce(pick_missing,false)
    where order_id=p_order_id;
  end if;

  select count(*),count(*) filter(where coalesce((s.pick_verification->>'complete')::boolean,false))
    into v_total_orders,v_scanned_orders
  from public.mise_delivery_batch_stops s
  join public.customer_orders o on o.id=s.order_id
  where s.batch_id=p_batch_id and s.type='dropoff' and not coalesce(s.cancelled,false)
    and o.status::text not in ('storniert','geliefert','abgeschlossen');
  v_incomplete_orders:=v_total_orders-v_scanned_orders;

  update public.mise_delivery_batches
  set state='at_restaurant',handoff_state=case when v_incomplete_orders=0 then 'ready' else 'scanning' end,
      handoff_started_at=coalesce(handoff_started_at,now()),updated_at=now()
  where id=p_batch_id;
  update public.mise_drivers set state='at_restaurant',updated_at=now() where id=p_driver_id;

  return jsonb_build_object(
    'ok',true,'duplicate',v_already_scanned,
    'order_id',p_order_id,'bag_index',p_bag_index,'order_complete',v_order_complete,
    'scanned_bags',to_jsonb(v_scanned),'required_bags',v_bag_count,
    'scanned_orders',v_scanned_orders,'total_orders',v_total_orders,'handoff_ready',v_incomplete_orders=0
  );
exception when no_data_found then
  return jsonb_build_object('ok',false,'error','Tour oder Bestellung gehört nicht zu diesem Fahrer');
end $function$;

revoke all on function public.scan_delivery_pickup_bag(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.scan_delivery_pickup_bag(uuid,uuid,uuid,integer) to service_role;
