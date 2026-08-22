-- Transactional regression test. Run after migration 067 and ROLLBACK the caller.
do $test$
declare
  v_driver_id uuid;
  v_location_id uuid;
  v_order_id uuid;
  v_batch_id uuid:=gen_random_uuid();
  v_result jsonb;
begin
  select d.id into v_driver_id
  from public.mise_drivers d
  where d.auth_user_id is not null and not exists(
    select 1 from public.mise_delivery_batches b
    where b.driver_id=d.id and b.state not in ('completed','cancelled')
  ) limit 1;
  select o.id,o.location_id into v_order_id,v_location_id
  from public.customer_orders o
  where o.typ::text='lieferung' and o.location_id is not null
    and o.status::text in ('neu','in_zubereitung','fertig')
  limit 1;
  if v_driver_id is null or v_order_id is null then raise exception 'pickup duplicate fixture unavailable'; end if;

  update public.customer_orders set delivery_bag_count=2 where id=v_order_id;
  insert into public.mise_delivery_batches(
    id,driver_id,location_id,state,assignment_mode,handoff_state,planned_at,plan_expires_at,stop_count
  ) values(v_batch_id,v_driver_id,v_location_id,'assigned','own_fleet','planned',now(),now()+interval '20 minutes',1);
  insert into public.mise_delivery_batch_stops(batch_id,order_id,type,sequence,address)
  values(v_batch_id,v_order_id,'dropoff',1,'Duplicate flag regression');

  v_result:=public.scan_delivery_pickup_bag(v_batch_id,v_driver_id,v_order_id,1);
  if coalesce((v_result->>'duplicate')::boolean,true) then
    raise exception 'first scan was marked duplicate: %',v_result;
  end if;

  v_result:=public.scan_delivery_pickup_bag(v_batch_id,v_driver_id,v_order_id,1);
  if not coalesce((v_result->>'duplicate')::boolean,false) then
    raise exception 'repeated scan was not marked duplicate: %',v_result;
  end if;

  v_result:=public.scan_delivery_pickup_bag(v_batch_id,v_driver_id,v_order_id,2);
  if coalesce((v_result->>'duplicate')::boolean,true) then
    raise exception 'first scan of another bag was marked duplicate: %',v_result;
  end if;
end
$test$;

select 'pickup_scan_duplicate_flag_ok' as result;
