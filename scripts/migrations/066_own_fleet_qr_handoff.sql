-- 066: Internal-fleet planning and binding bag-QR handoff.
-- Internal shift drivers receive a plan directly. The restaurant handoff, not
-- a dangerous accept button while driving, is the binding custody transition.
begin;

alter table public.customer_orders
  add column if not exists delivery_bag_count smallint not null default 1;

alter table public.mise_delivery_batches
  add column if not exists assignment_mode text not null default 'own_fleet',
  add column if not exists handoff_state text not null default 'planned',
  add column if not exists planned_at timestamptz,
  add column if not exists plan_expires_at timestamptz,
  add column if not exists handoff_started_at timestamptz,
  add column if not exists committed_at timestamptz;

update public.mise_delivery_batches
set assignment_mode=case when state='pending_acceptance' then 'offer' else coalesce(assignment_mode,'own_fleet') end,
    handoff_state=case
      when state in ('picked_up','in_progress','completed') then 'committed'
      when state='at_restaurant' then 'scanning'
      else coalesce(handoff_state,'planned')
    end,
    planned_at=coalesce(planned_at,created_at),
    committed_at=case when state in ('picked_up','in_progress','completed') then coalesce(committed_at,picked_up_at,completed_at) else committed_at end
where assignment_mode is null or handoff_state is null or planned_at is null
   or (state in ('picked_up','in_progress','completed') and committed_at is null);

do $constraints$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.customer_orders'::regclass and conname='customer_orders_delivery_bag_count_check') then
    alter table public.customer_orders add constraint customer_orders_delivery_bag_count_check check(delivery_bag_count between 1 and 12);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.mise_delivery_batches'::regclass and conname='mise_delivery_batches_assignment_mode_check') then
    alter table public.mise_delivery_batches add constraint mise_delivery_batches_assignment_mode_check check(assignment_mode in ('own_fleet','offer'));
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.mise_delivery_batches'::regclass and conname='mise_delivery_batches_handoff_state_check') then
    alter table public.mise_delivery_batches add constraint mise_delivery_batches_handoff_state_check check(handoff_state in ('planned','scanning','ready','committed'));
  end if;
end $constraints$;

create index if not exists idx_mise_batches_own_fleet_plan_expiry
  on public.mise_delivery_batches(plan_expires_at)
  where assignment_mode='own_fleet' and handoff_state='planned' and state in ('assigned','at_restaurant');

create or replace function public.claim_delivery_order(
  p_order_id uuid,
  p_driver_id uuid,
  p_zone text default null,
  p_dispatch_score numeric default null,
  p_bundle_batch_id uuid default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_order public.customer_orders%rowtype;
  v_location public.locations%rowtype;
  v_batch public.mise_delivery_batches%rowtype;
  v_batch_id uuid;
  v_sequence integer;
  v_stop_count integer;
  v_max_capacity integer;
  v_outcome text:='dispatched';
  v_restaurant_address text;
  v_plan_minutes integer;
begin
  select * into strict v_order from public.customer_orders where id=p_order_id for update;
  if v_order.typ::text<>'lieferung' or v_order.status::text not in ('neu','in_zubereitung','fertig')
     or v_order.mise_batch_id is not null or v_order.mise_driver_id is not null
     or v_order.location_id is null then
    raise exception 'order is not claimable';
  end if;
  select * into strict v_location from public.locations where id=v_order.location_id and aktiv;

  if p_bundle_batch_id is not null then
    select * into strict v_batch from public.mise_delivery_batches where id=p_bundle_batch_id for update;
    if v_batch.driver_id<>p_driver_id or v_batch.location_id is distinct from v_location.id
       or v_batch.state not in ('assigned','at_restaurant')
       or v_batch.assignment_mode<>'own_fleet' or v_batch.handoff_state<>'planned' then
      raise exception 'bundle is no longer claimable';
    end if;
  end if;

  perform 1 from public.mise_drivers where id=p_driver_id for update;
  if not public.mise_driver_is_dispatch_eligible(p_driver_id,v_location.tenant_id,v_location.id,now()) then
    raise exception 'driver is not eligible for tenant, location, shift, GPS or push';
  end if;
  if p_bundle_batch_id is null and exists(
    select 1 from public.mise_delivery_batches where driver_id=p_driver_id and state not in ('completed','cancelled')
  ) then
    raise exception 'driver already has an active delivery batch';
  end if;

  v_restaurant_address:=coalesce(nullif(concat_ws(', ',v_location.adresse,v_location.plz,v_location.stadt),''),v_location.name);
  v_plan_minutes:=greatest(8,least(30,coalesce(v_order.estimated_prep_min,15)+5));

  if p_bundle_batch_id is not null then
    select count(*) into v_stop_count from public.mise_delivery_batch_stops
    where batch_id=v_batch.id and type='dropoff' and not coalesce(cancelled,false) and completed_at is null;
    select max_capacity into v_max_capacity from public.mise_drivers where id=p_driver_id;
    if v_stop_count>=coalesce(v_max_capacity,4) then raise exception 'bundle capacity reached'; end if;
    select coalesce(max(sequence),-1)+1 into v_sequence from public.mise_delivery_batch_stops where batch_id=v_batch.id;
    if not exists(
      select 1 from public.mise_delivery_batch_stops s where s.batch_id=v_batch.id and s.type='pickup'
        and s.lat is not distinct from v_location.lat and s.lng is not distinct from v_location.lng
        and not coalesce(s.cancelled,false)
    ) then
      insert into public.mise_delivery_batch_stops(batch_id,order_id,type,sequence,lat,lng,address)
      values(v_batch.id,v_order.id,'pickup',v_sequence,v_location.lat,v_location.lng,v_restaurant_address);
      v_sequence:=v_sequence+1;
    end if;
    insert into public.mise_delivery_batch_stops(batch_id,order_id,type,sequence,lat,lng,address)
    values(v_batch.id,v_order.id,'dropoff',v_sequence,v_order.kunde_lat,v_order.kunde_lng,v_order.kunde_adresse);
    v_batch_id:=v_batch.id;
    v_outcome:='bundled';
    update public.mise_delivery_batches
      set stop_count=(select count(*) from public.mise_delivery_batch_stops where batch_id=v_batch.id),
          plan_expires_at=greatest(coalesce(plan_expires_at,now()),now()+make_interval(mins=>v_plan_minutes)),updated_at=now()
      where id=v_batch.id;
  else
    insert into public.mise_delivery_batches(
      driver_id,location_id,state,zone,dispatch_score,stop_count,offer_expires_at,accepted_at,
      assignment_mode,handoff_state,planned_at,plan_expires_at
    ) values(
      p_driver_id,v_location.id,'assigned',p_zone,p_dispatch_score,2,null,now(),
      'own_fleet','planned',now(),now()+make_interval(mins=>v_plan_minutes)
    ) returning * into v_batch;
    v_batch_id:=v_batch.id;
    insert into public.mise_delivery_batch_stops(batch_id,order_id,type,sequence,lat,lng,address)
    values
      (v_batch_id,v_order.id,'pickup',0,v_location.lat,v_location.lng,v_restaurant_address),
      (v_batch_id,v_order.id,'dropoff',1,v_order.kunde_lat,v_order.kunde_lng,v_order.kunde_adresse);
  end if;

  update public.customer_orders set mise_batch_id=v_batch_id,mise_driver_id=p_driver_id,
    delivery_zone=coalesce(p_zone,delivery_zone),dispatch_score=coalesce(p_dispatch_score,dispatch_score),
    dispatch_version=dispatch_version+1,updated_at=now()
  where id=v_order.id and mise_batch_id is null and mise_driver_id is null;
  if not found then raise exception 'order claim lost concurrent compare-and-set'; end if;

  update public.mise_drivers set state='assigned',updated_at=now() where id=p_driver_id;
  update public.delivery_alerts set resolved_at=now(),resolved_by='auto-redispatched'
  where location_id=v_location.id::text and alert_type='dispatch_order_attention'
    and resolved_at is null and details->>'order_id'=v_order.id::text;
  return jsonb_build_object('batch_id',v_batch_id,'driver_id',p_driver_id,'outcome',v_outcome,'assignment_mode','own_fleet');
exception when no_data_found then raise exception 'order, location or batch not found';
end $function$;

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
    'ok',true,'duplicate',p_bag_index=any(v_scanned) and coalesce(cardinality(v_scanned),0)>1,
    'order_id',p_order_id,'bag_index',p_bag_index,'order_complete',v_order_complete,
    'scanned_bags',to_jsonb(v_scanned),'required_bags',v_bag_count,
    'scanned_orders',v_scanned_orders,'total_orders',v_total_orders,'handoff_ready',v_incomplete_orders=0
  );
exception when no_data_found then
  return jsonb_build_object('ok',false,'error','Tour oder Bestellung gehört nicht zu diesem Fahrer');
end $function$;

create or replace function public.set_delivery_bag_count(
  p_order_id uuid,
  p_location_id uuid,
  p_bag_count integer
) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_batch_id uuid; v_locked_batch_id uuid;
begin
  if p_bag_count<1 or p_bag_count>12 then raise exception 'bag count must be between 1 and 12'; end if;
  select mise_batch_id into strict v_batch_id from public.customer_orders
    where id=p_order_id and location_id=p_location_id and typ::text='lieferung';
  -- Use the same batch -> order lock order as the scanner. Re-read the order
  -- after acquiring the batch lock so a concurrent dispatch cannot slip past.
  if v_batch_id is not null then
    perform 1 from public.mise_delivery_batches where id=v_batch_id for update;
  end if;
  select mise_batch_id into strict v_locked_batch_id from public.customer_orders
    where id=p_order_id and location_id=p_location_id and typ::text='lieferung' for update;
  if v_locked_batch_id is distinct from v_batch_id then raise exception 'order assignment changed; retry'; end if;
  if v_locked_batch_id is not null and not exists(
    select 1 from public.mise_delivery_batches
    where id=v_locked_batch_id and state in ('assigned','at_restaurant') and handoff_state='planned'
  ) then
    raise exception 'bag count is locked after handoff start';
  end if;
  update public.customer_orders set delivery_bag_count=p_bag_count,updated_at=now() where id=p_order_id;
  return true;
exception when no_data_found then return false;
end $function$;

create or replace function public.confirm_pick_item(
  p_order_item_id uuid,
  p_missing boolean default false,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_driver_id uuid; v_order_id uuid; v_tenant_id uuid;
begin
  select id into v_driver_id from public.mise_drivers where auth_user_id=auth.uid() and active and approved_at is not null and not rejected;
  if v_driver_id is null then return jsonb_build_object('ok',false,'error','Nicht als Fahrer eingeloggt'); end if;

  select oi.order_id,co.tenant_id into v_order_id,v_tenant_id
  from public.order_items oi join public.customer_orders co on co.id=oi.order_id
  where oi.id=p_order_item_id
    and exists(
      select 1 from public.mise_delivery_batches b
      where b.id=co.mise_batch_id and b.driver_id=v_driver_id and b.state in ('assigned','at_restaurant')
    );
  if v_order_id is null then return jsonb_build_object('ok',false,'error','Item gehört nicht zu deiner aktiven Tour'); end if;

  update public.order_items set pick_confirmed_at=now(),pick_missing=coalesce(p_missing,false),pick_missing_note=left(p_note,500)
  where id=p_order_item_id;
  if p_missing then
    insert into public.mise_frank_decisions(type,driver_id,order_ids,reason_text,reason_data)
    values('alert',v_driver_id,array[v_order_id],'PICK_ITEM_MISSING: '||coalesce(p_note,'Item nicht in der Tasche'),
      jsonb_build_object('tenant_id',v_tenant_id,'order_item_id',p_order_item_id));
  end if;
  return jsonb_build_object('ok',true);
end $function$;

create or replace function public.confirm_pickup_complete(p_batch_id uuid)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_driver_id uuid;
  v_batch public.mise_delivery_batches%rowtype;
  v_missing_count integer;
  v_total_items integer;
  v_incomplete_orders integer;
begin
  select id into v_driver_id from public.mise_drivers where auth_user_id=auth.uid() and active and approved_at is not null and not rejected;
  if v_driver_id is null then return jsonb_build_object('ok',false,'error','Nicht als Fahrer eingeloggt'); end if;
  select * into strict v_batch from public.mise_delivery_batches
    where id=p_batch_id and driver_id=v_driver_id and state in ('assigned','at_restaurant') for update;

  select count(*) filter(where oi.pick_confirmed_at is null),count(*) into v_missing_count,v_total_items
  from public.mise_delivery_batch_stops s join public.order_items oi on oi.order_id=s.order_id
  where s.batch_id=p_batch_id and s.type='dropoff' and not coalesce(s.cancelled,false);
  if v_missing_count>0 then
    return jsonb_build_object('ok',false,'error',format('%s von %s Artikeln noch nicht bestätigt',v_missing_count,v_total_items));
  end if;

  if v_batch.assignment_mode='own_fleet' then
    select count(*) into v_incomplete_orders
    from public.mise_delivery_batch_stops s join public.customer_orders o on o.id=s.order_id
    where s.batch_id=p_batch_id and s.type='dropoff' and not coalesce(s.cancelled,false)
      and o.status::text not in ('storniert','geliefert','abgeschlossen')
      and not coalesce((s.pick_verification->>'complete')::boolean,false);
    if v_incomplete_orders>0 or v_batch.handoff_state<>'ready' then
      return jsonb_build_object('ok',false,'error','Erst alle Beutel-QR-Codes scannen');
    end if;
  end if;

  update public.mise_delivery_batch_stops set completed_at=coalesce(completed_at,now())
    where batch_id=p_batch_id and type='pickup' and completed_at is null;
  update public.mise_delivery_batches
    set state='in_progress',picked_up_at=coalesce(picked_up_at,now()),handoff_state='committed',committed_at=coalesce(committed_at,now()),updated_at=now()
    where id=p_batch_id;
  update public.mise_drivers set state='en_route',updated_at=now() where id=v_driver_id;
  return jsonb_build_object('ok',true,'handoff_state','committed');
exception when no_data_found then
  return jsonb_build_object('ok',false,'error','Tour gehört nicht zu diesem Fahrer');
end $function$;

create or replace function public.expire_own_fleet_plans()
returns integer
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_batch record; v_count integer:=0;
begin
  for v_batch in
    select b.id from public.mise_delivery_batches b
    where b.assignment_mode='own_fleet' and b.handoff_state='planned' and b.state='assigned'
      and b.plan_expires_at is not null and b.plan_expires_at<=now()
    order by b.plan_expires_at for update skip locked
  loop
    perform public.requeue_delivery_batch(v_batch.id,'own_fleet_plan_expired_before_handoff',0);
    v_count:=v_count+1;
  end loop;
  return v_count;
end $function$;

revoke all on function public.claim_delivery_order(uuid,uuid,text,numeric,uuid) from public,anon,authenticated;
revoke all on function public.scan_delivery_pickup_bag(uuid,uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.set_delivery_bag_count(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.confirm_pick_item(uuid,boolean,text) from public,anon;
revoke all on function public.confirm_pickup_complete(uuid) from public,anon;
revoke all on function public.expire_own_fleet_plans() from public,anon,authenticated;
grant execute on function public.claim_delivery_order(uuid,uuid,text,numeric,uuid) to service_role;
grant execute on function public.scan_delivery_pickup_bag(uuid,uuid,uuid,integer) to service_role;
grant execute on function public.set_delivery_bag_count(uuid,uuid,integer) to service_role;
grant execute on function public.confirm_pick_item(uuid,boolean,text) to authenticated,service_role;
grant execute on function public.confirm_pickup_complete(uuid) to authenticated,service_role;
grant execute on function public.expire_own_fleet_plans() to service_role;

notify pgrst,'reload schema';
commit;
