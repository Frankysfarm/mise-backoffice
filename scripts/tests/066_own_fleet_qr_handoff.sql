-- Transactional behavior test. Run after migration 066 and ROLLBACK the caller.
do $test$
declare
  v_driver_id uuid;
  v_auth_user_id uuid;
  v_location_id uuid;
  v_order_id uuid;
  v_batch_id uuid:=gen_random_uuid();
  v_result jsonb;
begin
  select d.id,d.auth_user_id into v_driver_id,v_auth_user_id
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
  if v_driver_id is null or v_order_id is null then raise exception 'own-fleet QR fixture unavailable'; end if;

  update public.mise_drivers set active=true,approved_at=coalesce(approved_at,now()),rejected=false where id=v_driver_id;
  update public.customer_orders set delivery_bag_count=2 where id=v_order_id;
  update public.order_items set pick_confirmed_at=null where order_id=v_order_id;

  insert into public.mise_delivery_batches(
    id,driver_id,location_id,state,assignment_mode,handoff_state,planned_at,plan_expires_at,stop_count
  ) values(v_batch_id,v_driver_id,v_location_id,'assigned','own_fleet','planned',now(),now()+interval '20 minutes',1);
  insert into public.mise_delivery_batch_stops(batch_id,order_id,type,sequence,address)
  values(v_batch_id,v_order_id,'dropoff',1,'QR contract test');

  v_result:=public.scan_delivery_pickup_bag(v_batch_id,v_driver_id,v_order_id,1);
  if not coalesce((v_result->>'ok')::boolean,false)
     or coalesce((v_result->>'handoff_ready')::boolean,false)
     or (select handoff_state from public.mise_delivery_batches where id=v_batch_id)<>'scanning' then
    raise exception 'first bag did not start an incomplete handoff: %',v_result;
  end if;

  v_result:=public.scan_delivery_pickup_bag(v_batch_id,v_driver_id,v_order_id,2);
  if not coalesce((v_result->>'handoff_ready')::boolean,false)
     or (select handoff_state from public.mise_delivery_batches where id=v_batch_id)<>'ready'
     or exists(select 1 from public.order_items where order_id=v_order_id and pick_confirmed_at is null) then
    raise exception 'last bag did not make the handoff ready: %',v_result;
  end if;

  -- Repeating the same QR is idempotent and must not create a third bag.
  perform public.scan_delivery_pickup_bag(v_batch_id,v_driver_id,v_order_id,2);
  if (select jsonb_array_length(pick_verification->'scanned_bags')
      from public.mise_delivery_batch_stops where batch_id=v_batch_id and type='dropoff')<>2 then
    raise exception 'bag scan is not idempotent';
  end if;

  perform set_config('request.jwt.claim.sub',v_auth_user_id::text,true);
  v_result:=public.confirm_pickup_complete(v_batch_id);
  if not coalesce((v_result->>'ok')::boolean,false)
     or not exists(select 1 from public.mise_delivery_batches where id=v_batch_id and state='in_progress' and handoff_state='committed' and committed_at is not null) then
    raise exception 'ready handoff did not commit custody: %',v_result;
  end if;

  if has_function_privilege('anon','public.scan_delivery_pickup_bag(uuid,uuid,uuid,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.scan_delivery_pickup_bag(uuid,uuid,uuid,integer)','EXECUTE')
     or not has_function_privilege('service_role','public.scan_delivery_pickup_bag(uuid,uuid,uuid,integer)','EXECUTE') then
    raise exception 'scan function grants are unsafe';
  end if;
end
$test$;

select 'own_fleet_qr_handoff_contract_ok' as result;
