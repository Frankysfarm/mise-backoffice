-- Transactional contract test. Run after migration 065 inside a transaction
-- that the caller rolls back.

do $test$
declare
  v_driver_id uuid;
  v_location_id uuid;
  v_tenant_id uuid;
  v_result jsonb;
begin
  select d.id,e.location_id,m.tenant_id into v_driver_id,v_location_id,v_tenant_id
  from public.mise_drivers d
  join public.mise_driver_tenants m on m.driver_id=d.id and m.status='active'
  join public.employees e on e.auth_user_id=d.auth_user_id
    and e.tenant_id=m.tenant_id and e.location_id is not null
    and e.status::text in ('aktiv','in_training','in_probe')
  join public.locations l on l.id=e.location_id and l.tenant_id=m.tenant_id and l.aktiv
  where not exists(
    select 1 from public.mise_delivery_batches b
    where b.driver_id=d.id and b.state not in ('completed','cancelled')
  )
  limit 1;
  if v_driver_id is null then raise exception 'duty-status test fixture unavailable'; end if;

  update public.mise_drivers set
    approved_at=coalesce(approved_at,now()),rejected=false,push_enabled=true,
    expo_push_token=repeat('a',64),active=true,state='idle',dispatch_availability='available',
    availability_reason=null,shift_started_at=now()-interval '1 hour',
    last_position_at=now(),last_active_at=now(),last_lat=50.1,last_lng=8.6,excluded_until=null
  where id=v_driver_id;
  insert into public.driver_shifts(driver_id,location_id,planned_start,planned_end,actual_start,status)
  values(v_driver_id,v_location_id,now()-interval '1 hour',now()+interval '8 hours',now()-interval '1 hour','active');

  if not public.mise_driver_is_dispatch_eligible(v_driver_id,v_tenant_id,v_location_id,now()) then
    raise exception 'available driver is not dispatch eligible';
  end if;

  v_result:=public.pause_driver_dispatch_session(v_driver_id,'manual',false);
  if v_result->>'dispatch_availability'<>'paused'
     or (select dispatch_availability from public.mise_drivers where id=v_driver_id)<>'paused'
     or public.mise_driver_is_dispatch_eligible(v_driver_id,v_tenant_id,v_location_id,now()) then
    raise exception 'manual pause did not block dispatch';
  end if;

  v_result:=public.resume_driver_dispatch_session(v_driver_id,v_location_id);
  if v_result->>'dispatch_availability'<>'available'
     or not public.mise_driver_is_dispatch_eligible(v_driver_id,v_tenant_id,v_location_id,now()) then
    raise exception 'resume did not restore dispatch eligibility';
  end if;

  update public.mise_drivers set last_active_at=now()-interval '45 minutes',last_position_at=now()-interval '45 minutes',updated_at=now()-interval '45 minutes'
  where id=v_driver_id;
  perform public.mark_stale_drivers_offline();
  if not exists(select 1 from public.mise_drivers where id=v_driver_id
    and dispatch_availability='paused' and availability_reason='inactivity' and state='offline') then
    raise exception 'inactivity did not create an explicit safety pause';
  end if;

  perform public.resume_driver_dispatch_session(v_driver_id,v_location_id);
  if not public.end_driver_dispatch_session(v_driver_id) then raise exception 'shift end failed'; end if;
  if not exists(select 1 from public.mise_drivers where id=v_driver_id
    and not active and dispatch_availability='off_duty' and shift_started_at is null) then
    raise exception 'shift end did not set off-duty state';
  end if;

  if has_function_privilege('authenticated','public.pause_driver_dispatch_session(uuid,text,boolean)','EXECUTE')
     or has_function_privilege('authenticated','public.resume_driver_dispatch_session(uuid,uuid)','EXECUTE') then
    raise exception 'authenticated role can execute privileged duty transition directly';
  end if;
end
$test$;

select 'driver_duty_availability_contract_ok' as result;
