-- One-writer, atomic delivery dispatch and driver-workday contract.
begin;

create or replace function public.mise_driver_has_current_shift(
  p_driver_id uuid,
  p_location_id uuid,
  p_at timestamptz default now()
) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $function$
declare
  v_berlin_date date;
  v_day_start timestamptz;
  v_day_end timestamptz;
begin
  v_berlin_date:=(p_at at time zone 'Europe/Berlin')::date;
  v_day_start:=v_berlin_date::timestamp at time zone 'Europe/Berlin';
  -- Convert both local midnights separately. A Berlin day can contain 23 or 25
  -- hours at the DST boundary, so adding a fixed 24-hour interval is unsafe.
  v_day_end:=(v_berlin_date+1)::timestamp at time zone 'Europe/Berlin';

  -- A started shift that currently covers the instant is authoritative, including
  -- a legitimate overnight shift which began on the previous Berlin date.
  if exists(
    select 1 from public.driver_shifts s
    where s.driver_id=p_driver_id and s.location_id=p_location_id
      and s.status='active' and s.actual_start is not null and s.actual_end is null
      and s.planned_start<=p_at and s.planned_end>p_at
  ) then return true; end if;

  -- Compatibility mode exists only where no shift plan overlaps this Berlin
  -- workday.  The same-day online lease remains mandatory in the caller.
  return not exists(
    select 1 from public.driver_shifts s
    where s.location_id=p_location_id and s.status<>'cancelled'
      and s.planned_start<v_day_end and s.planned_end>v_day_start
  );
end $function$;

create or replace function public.mise_driver_is_dispatch_eligible(
  p_driver_id uuid,
  p_tenant_id uuid,
  p_location_id uuid,
  p_at timestamptz default now()
) returns boolean
language sql stable security definer set search_path=public,pg_temp as $function$
  select exists(
    select 1
    from public.mise_drivers d
    join public.mise_driver_tenants membership
      on membership.driver_id=d.id and membership.tenant_id=p_tenant_id and membership.status='active'
    where d.id=p_driver_id
      and d.active
      and d.approved_at is not null
      and not d.rejected
      and d.state in ('idle','assigned','at_restaurant','en_route','returning')
      and d.shift_started_at is not null
      and d.shift_started_at<=p_at
      and d.shift_started_at>=p_at-interval '16 hours'
      and (d.shift_started_at at time zone 'Europe/Berlin')::date=(p_at at time zone 'Europe/Berlin')::date
      and d.last_position_at is not null
      and d.last_position_at>=p_at-interval '15 minutes'
      and d.last_lat is not null
      and d.last_lng is not null
      and (d.excluded_until is null or d.excluded_until<=p_at)
      and d.push_enabled
      and (nullif(trim(d.expo_push_token),'') is not null or nullif(trim(d.voip_push_token),'') is not null)
      and public.mise_driver_has_current_shift(d.id,p_location_id,p_at)
      and (
        d.auth_user_id is null
        or exists(
          select 1 from public.employees e
          where e.auth_user_id=d.auth_user_id and e.tenant_id=p_tenant_id
            and e.location_id=p_location_id
            and e.status::text in ('aktiv','in_training','in_probe')
        )
      )
  )
$function$;

create or replace function public.get_eligible_delivery_drivers(
  p_tenant_id uuid,
  p_location_id uuid
) returns table(
  id uuid,
  auth_user_id uuid,
  employee_id uuid,
  vehicle text,
  max_radius_km numeric,
  last_lat numeric,
  last_lng numeric,
  current_capacity integer,
  max_capacity integer,
  total_deliveries integer,
  state text,
  active boolean,
  shift_started_at timestamptz
)
language sql stable security definer set search_path=public,pg_temp as $function$
  select d.id,d.auth_user_id,e.id,d.vehicle,d.max_radius_km,d.last_lat,d.last_lng,
         d.current_capacity,d.max_capacity,d.total_deliveries,d.state,d.active,d.shift_started_at
  from public.mise_drivers d
  left join public.employees e
    on e.auth_user_id=d.auth_user_id and e.tenant_id=p_tenant_id and e.location_id=p_location_id
  where exists(select 1 from public.locations l where l.id=p_location_id and l.tenant_id=p_tenant_id and l.aktiv)
    and public.mise_driver_is_dispatch_eligible(d.id,p_tenant_id,p_location_id,now())
  order by d.last_position_at desc,d.id
$function$;

create or replace function public.raise_delivery_dispatch_alert(
  p_order_id uuid,
  p_reason text,
  p_batch_id uuid default null
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_order public.customer_orders%rowtype; v_id uuid;
begin
  select * into strict v_order from public.customer_orders where id=p_order_id;
  if v_order.location_id is null or v_order.typ::text<>'lieferung' then raise exception 'delivery order not found'; end if;
  select id into v_id from public.delivery_alerts
  where location_id=v_order.location_id::text and alert_type='dispatch_order_attention'
    and resolved_at is null and details->>'order_id'=v_order.id::text
  order by created_at desc limit 1;
  if v_id is null then
    insert into public.delivery_alerts(location_id,alert_type,severity,message,details,auto_resolve)
    values(v_order.location_id::text,'dispatch_order_attention','critical',
      'Lieferbestellung benötigt Disposition: '||coalesce(v_order.bestellnummer,v_order.id::text),
      jsonb_build_object('order_id',v_order.id,'batch_id',p_batch_id,'reason',left(coalesce(p_reason,'unknown'),500)),false)
    returning id into v_id;
  else
    update public.delivery_alerts set details=coalesce(details,'{}'::jsonb)||jsonb_build_object(
      'batch_id',p_batch_id,'reason',left(coalesce(p_reason,'unknown'),500),'last_seen_at',now()) where id=v_id;
  end if;
  return v_id;
exception when no_data_found then raise exception 'delivery order not found';
end $function$;

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
begin
  select * into strict v_order from public.customer_orders where id=p_order_id for update;
  if v_order.typ::text<>'lieferung' or v_order.status::text not in ('neu','in_zubereitung','fertig')
     or v_order.mise_batch_id is not null or v_order.mise_driver_id is not null
     or v_order.location_id is null then
    raise exception 'order is not claimable';
  end if;
  select * into strict v_location from public.locations where id=v_order.location_id and aktiv;

  -- When bundling, lock the target batch before the driver. Accept/requeue use
  -- the same batch -> driver lock order, which avoids a cross-endpoint deadlock.
  if p_bundle_batch_id is not null then
    select * into strict v_batch from public.mise_delivery_batches
    where id=p_bundle_batch_id for update;
    if v_batch.driver_id<>p_driver_id or v_batch.location_id is distinct from v_location.id
       or v_batch.state not in ('pending_acceptance','assigned','at_restaurant') then
      raise exception 'bundle is no longer claimable';
    end if;
  end if;

  -- Serialise all claims for one driver. Two concurrent orders must never create
  -- two independent active batches for the same otherwise-idle driver.
  perform 1 from public.mise_drivers where id=p_driver_id for update;
  if not public.mise_driver_is_dispatch_eligible(p_driver_id,v_location.tenant_id,v_location.id,now()) then
    raise exception 'driver is not eligible for tenant, location, shift, GPS or push';
  end if;
  if p_bundle_batch_id is null and exists(
    select 1 from public.mise_delivery_batches
    where driver_id=p_driver_id and state not in ('completed','cancelled')
  ) then
    raise exception 'driver already has an active delivery batch';
  end if;
  v_restaurant_address:=coalesce(nullif(concat_ws(', ',v_location.adresse,v_location.plz,v_location.stadt),''),v_location.name);

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
    v_batch_id:=v_batch.id; v_outcome:='bundled';
    update public.mise_delivery_batches set stop_count=(select count(*) from public.mise_delivery_batch_stops where batch_id=v_batch.id),updated_at=now() where id=v_batch.id;
  else
    insert into public.mise_delivery_batches(driver_id,location_id,state,zone,dispatch_score,stop_count,offer_expires_at)
    values(p_driver_id,v_location.id,'pending_acceptance',p_zone,p_dispatch_score,2,now()+interval '3 minutes')
    returning * into v_batch;
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
  update public.delivery_alerts set resolved_at=now(),resolved_by='auto-redispatched'
  where location_id=v_location.id::text and alert_type='dispatch_order_attention'
    and resolved_at is null and details->>'order_id'=v_order.id::text;
  return jsonb_build_object('batch_id',v_batch_id,'driver_id',p_driver_id,'outcome',v_outcome);
exception when no_data_found then raise exception 'order, location or batch not found';
end $function$;

create or replace function public.accept_delivery_batch(p_batch_id uuid,p_driver_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_batch public.mise_delivery_batches%rowtype; v_location public.locations%rowtype;
begin
  select * into strict v_batch from public.mise_delivery_batches
  where id=p_batch_id and driver_id=p_driver_id and state='pending_acceptance' for update;
  select * into strict v_location from public.locations where id=v_batch.location_id;
  if coalesce(v_batch.offer_expires_at,v_batch.created_at+interval '3 minutes')<=now() then
    perform public.requeue_delivery_batch(v_batch.id,'offer_expired_before_acceptance',10);
    return false;
  end if;
  if exists(
    select 1 from public.mise_delivery_batches
    where driver_id=p_driver_id and id<>p_batch_id and state not in ('completed','cancelled')
  ) then
    return false;
  end if;
  if not public.mise_driver_is_dispatch_eligible(p_driver_id,v_location.tenant_id,v_location.id,now()) then
    raise exception 'driver is no longer eligible';
  end if;
  update public.mise_delivery_batches set state='assigned',accepted_at=now(),updated_at=now()
  where id=p_batch_id and driver_id=p_driver_id and state='pending_acceptance';
  if not found then return false; end if;
  update public.mise_drivers set state='assigned',updated_at=now() where id=p_driver_id;
  return true;
exception when no_data_found then return false;
end $function$;

create or replace function public.requeue_delivery_batch(
  p_batch_id uuid,
  p_reason text,
  p_exclude_minutes integer default 10
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_batch public.mise_delivery_batches%rowtype; v_order_id uuid; v_orders uuid[]:='{}'::uuid[];
begin
  select * into strict v_batch from public.mise_delivery_batches where id=p_batch_id for update;
  if v_batch.state in ('cancelled','completed') then
    return jsonb_build_object('requeued',0,'order_ids','[]'::jsonb,'state',v_batch.state);
  end if;
  update public.mise_delivery_batches set state='cancelled',cancelled_at=now(),updated_at=now(),
    cancellation_reason=left(coalesce(p_reason,'dispatch requeue'),500) where id=v_batch.id;
  update public.mise_delivery_batch_stops set cancelled=true where batch_id=v_batch.id and completed_at is null;
  for v_order_id in
    update public.customer_orders set mise_batch_id=null,mise_driver_id=null,
      recovery_count=coalesce(recovery_count,0)+1,last_recovery_at=now(),
      dispatch_attempts=coalesce(dispatch_attempts,0)+1,last_dispatch_attempt_at=now(),updated_at=now()
    where mise_batch_id=v_batch.id and status::text not in ('geliefert','storniert','abgeschlossen')
    returning id
  loop
    v_orders:=array_append(v_orders,v_order_id);
    perform public.raise_delivery_dispatch_alert(v_order_id,p_reason,v_batch.id);
  end loop;
  if v_batch.driver_id is not null then
    update public.mise_drivers set state='idle',excluded_until=greatest(coalesce(excluded_until,now()),now()+make_interval(mins=>greatest(coalesce(p_exclude_minutes,10),0))),updated_at=now()
    where id=v_batch.driver_id;
  end if;
  insert into public.mise_frank_decisions(type,driver_id,order_ids,reason_text)
  values('cancel',v_batch.driver_id,v_orders,left(coalesce(p_reason,'dispatch requeue'),500));
  return jsonb_build_object('requeued',cardinality(v_orders),'order_ids',to_jsonb(v_orders),'state','cancelled');
exception when no_data_found then return jsonb_build_object('requeued',0,'order_ids','[]'::jsonb,'state','missing');
end $function$;

create or replace function public.decline_delivery_batch(p_batch_id uuid,p_driver_id uuid,p_reason text default 'driver_declined')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_batch public.mise_delivery_batches%rowtype;
begin
  select * into strict v_batch from public.mise_delivery_batches
  where id=p_batch_id and driver_id=p_driver_id for update;
  if v_batch.state<>'pending_acceptance' then return jsonb_build_object('ok',false,'state',v_batch.state,'requeued',0); end if;
  return jsonb_build_object('ok',true,'result',public.requeue_delivery_batch(v_batch.id,coalesce(nullif(trim(p_reason),''),'driver_declined'),10));
exception when no_data_found then return jsonb_build_object('ok',false,'state','missing','requeued',0);
end $function$;

-- Preserve the existing cron API names, but route every release through the
-- same row-locking transaction used by hard push failures and driver declines.
create or replace function public.fn_auto_cancel_unaccepted_batches()
returns integer language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_batch record; v_count integer:=0;
begin
  for v_batch in
    select id from public.mise_delivery_batches
    where state='pending_acceptance' and coalesce(offer_expires_at,created_at+interval '3 minutes')<=now()
    order by created_at for update skip locked
  loop
    perform public.requeue_delivery_batch(v_batch.id,'offer_expired_without_acceptance',10);
    v_count:=v_count+1;
  end loop;
  return v_count;
end $function$;

create or replace function public.fn_recover_abandoned_tours()
returns integer language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_batch record; v_order_id uuid; v_count integer:=0;
begin
  for v_batch in
    select b.id,b.driver_id,b.state from public.mise_delivery_batches b join public.mise_drivers d on d.id=b.driver_id
    where b.state in ('assigned','at_restaurant','picked_up','in_progress')
      and b.created_at<now()-interval '10 minutes'
      and (d.last_position_at is null or d.last_position_at<now()-interval '10 minutes')
    order by b.created_at for update of b skip locked
  loop
    if v_batch.state in ('assigned','at_restaurant') then
      -- No customer order is in driver custody yet: safe atomic release/retry.
      perform public.requeue_delivery_batch(v_batch.id,'driver_abandoned_before_pickup',15);
    else
      -- Once food was picked up, automatic reassignment can create a duplicate
      -- delivery. Keep custody intact and raise a deduplicated per-order critical
      -- alert for immediate operator intervention instead.
      for v_order_id in
        select distinct o.id from public.customer_orders o
        where o.mise_batch_id=v_batch.id and o.status::text not in ('geliefert','storniert','abgeschlossen')
      loop
        perform public.raise_delivery_dispatch_alert(v_order_id,'driver_stale_after_pickup_manual_intervention',v_batch.id);
      end loop;
      update public.mise_drivers set excluded_until=greatest(coalesce(excluded_until,now()),now()+interval '15 minutes'),updated_at=now()
      where id=v_batch.driver_id;
    end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end $function$;

create or replace function public.start_driver_dispatch_session(
  p_driver_id uuid,
  p_location_id uuid,
  p_vehicle text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_driver public.mise_drivers%rowtype; v_location public.locations%rowtype; v_shift public.driver_shifts%rowtype; v_planned boolean;
begin
  select * into strict v_driver from public.mise_drivers where id=p_driver_id for update;
  select * into strict v_location from public.locations where id=p_location_id and aktiv;
  if v_driver.approved_at is null or v_driver.rejected then raise exception 'driver is not approved'; end if;
  if not exists(select 1 from public.mise_driver_tenants where driver_id=v_driver.id and tenant_id=v_location.tenant_id and status='active') then raise exception 'driver has no active tenant membership'; end if;
  if not v_driver.push_enabled or (nullif(trim(v_driver.expo_push_token),'') is null and nullif(trim(v_driver.voip_push_token),'') is null) then raise exception 'driver push channel is not ready'; end if;
  if v_driver.auth_user_id is not null and not exists(
    select 1 from public.employees e where e.auth_user_id=v_driver.auth_user_id and e.tenant_id=v_location.tenant_id
      and e.location_id=v_location.id and e.status::text in ('aktiv','in_training','in_probe')
  ) then raise exception 'driver employee is inactive or outside location'; end if;
  select * into v_shift from public.driver_shifts s
  where s.driver_id=v_driver.id and s.location_id=v_location.id and s.status in ('scheduled','active')
    and s.planned_start<=now()+interval '30 minutes' and s.planned_end>now()
  order by s.planned_start limit 1 for update;
  v_planned:=v_shift.id is not null;
  if v_planned then
    update public.driver_shifts set status='active',actual_start=coalesce(actual_start,now()),actual_end=null where id=v_shift.id;
  elsif not public.mise_driver_has_current_shift(v_driver.id,v_location.id,now()) then
    raise exception 'no current approved driver shift';
  end if;
  update public.mise_drivers set active=true,state='idle',shift_started_at=now(),
    vehicle=case when p_vehicle in ('bike','car') then p_vehicle else vehicle end,updated_at=now()
  where id=v_driver.id;
  return jsonb_build_object('ok',true,'tenant_id',v_location.tenant_id,'location_id',v_location.id,'shift_id',v_shift.id,'fallback',not v_planned);
exception when no_data_found then raise exception 'driver or location not found';
end $function$;

create or replace function public.end_driver_dispatch_session(p_driver_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $function$
begin
  perform 1 from public.mise_drivers where id=p_driver_id for update;
  if not found then return false; end if;
  if exists(select 1 from public.mise_delivery_batches where driver_id=p_driver_id and state not in ('completed','cancelled')) then raise exception 'driver has an active delivery batch'; end if;
  update public.driver_shifts set status='completed',actual_end=now()
  where driver_id=p_driver_id and status='active' and actual_end is null;
  update public.mise_drivers set active=false,state='offline',shift_started_at=null,updated_at=now() where id=p_driver_id;
  return true;
end $function$;

revoke all on function public.mise_driver_has_current_shift(uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.mise_driver_is_dispatch_eligible(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.get_eligible_delivery_drivers(uuid,uuid) from public,anon,authenticated;
revoke all on function public.raise_delivery_dispatch_alert(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.claim_delivery_order(uuid,uuid,text,numeric,uuid) from public,anon,authenticated;
revoke all on function public.accept_delivery_batch(uuid,uuid) from public,anon,authenticated;
revoke all on function public.requeue_delivery_batch(uuid,text,integer) from public,anon,authenticated;
revoke all on function public.decline_delivery_batch(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.start_driver_dispatch_session(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.end_driver_dispatch_session(uuid) from public,anon,authenticated;
revoke all on function public.fn_auto_cancel_unaccepted_batches() from public,anon,authenticated;
revoke all on function public.fn_recover_abandoned_tours() from public,anon,authenticated;
-- Superseded by the authenticated HTTP route + accept_delivery_batch CAS. The
-- historical RPC was SECURITY DEFINER and accepted a caller-supplied employee
-- id, so leaving it callable would bypass the new ownership/eligibility checks.
revoke all on function public.claim_mise_delivery_batch(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mise_driver_has_current_shift(uuid,uuid,timestamptz) to service_role;
grant execute on function public.mise_driver_is_dispatch_eligible(uuid,uuid,uuid,timestamptz) to service_role;
grant execute on function public.get_eligible_delivery_drivers(uuid,uuid) to service_role;
grant execute on function public.raise_delivery_dispatch_alert(uuid,text,uuid) to service_role;
grant execute on function public.claim_delivery_order(uuid,uuid,text,numeric,uuid) to service_role;
grant execute on function public.accept_delivery_batch(uuid,uuid) to service_role;
grant execute on function public.requeue_delivery_batch(uuid,text,integer) to service_role;
grant execute on function public.decline_delivery_batch(uuid,uuid,text) to service_role;
grant execute on function public.start_driver_dispatch_session(uuid,uuid,text) to service_role;
grant execute on function public.end_driver_dispatch_session(uuid) to service_role;
grant execute on function public.fn_auto_cancel_unaccepted_batches() to service_role;
grant execute on function public.fn_recover_abandoned_tours() to service_role;

commit;
