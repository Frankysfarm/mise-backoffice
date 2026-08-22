-- 065: Expliziter Fahrer-Dienststatus.
--
-- Auth-Login und operative Zuweisbarkeit sind absichtlich getrennt:
--   off_duty  = eingeloggt moeglich, aber keine aktive Schicht
--   available = aktive, aktuelle Schicht und fuer Dispatch freigegeben
--   paused    = Schicht bleibt erhalten, aber keine neue Zuweisung
--
-- Laufende Touren werden weder durch Pause noch Cutoff abgebrochen. Eine
-- Admin-Pause kann neue Zuweisungen sofort sperren und die bestehende Tour
-- auslaufen lassen. Der Fahrer selbst darf nur ohne aktive Tour pausieren.

begin;

alter table public.mise_drivers
  add column if not exists dispatch_availability text not null default 'off_duty',
  add column if not exists availability_reason text,
  add column if not exists availability_changed_at timestamptz not null default now();

alter table public.mise_drivers drop constraint if exists mise_drivers_dispatch_availability_check;
alter table public.mise_drivers add constraint mise_drivers_dispatch_availability_check
  check (dispatch_availability in ('off_duty','available','paused'));
alter table public.mise_drivers drop constraint if exists mise_drivers_availability_reason_check;
alter table public.mise_drivers add constraint mise_drivers_availability_reason_check
  check (availability_reason is null or availability_reason in ('manual','inactivity','admin','cutoff','push_unreachable'));

update public.mise_drivers
set dispatch_availability=case
      when active and shift_started_at is not null and state<>'offline' then 'available'
      when active and shift_started_at is not null then 'paused'
      else 'off_duty'
    end,
    availability_reason=case
      when active and shift_started_at is not null and state='offline' then 'inactivity'
      else null
    end,
    availability_changed_at=coalesce(updated_at,now());

create index if not exists idx_mise_drivers_dispatch_availability
  on public.mise_drivers(dispatch_availability,last_position_at desc)
  where active;

insert into public.delivery_setting_defaults
  (key,default_value,description,min_value,max_value,category)
values
  ('driver_inactivity_pause_minutes','30',
   'Automatische Sicherheitspause ohne GPS oder App-Lebenszeichen; laufende Touren sind ausgenommen',
   10,180,'driver')
on conflict (key) do update set
  default_value=excluded.default_value,
  description=excluded.description,
  min_value=excluded.min_value,
  max_value=excluded.max_value,
  category=excluded.category;

create or replace function public.mise_driver_inactivity_pause_minutes(p_location_id uuid)
returns integer
language sql stable security definer set search_path=public,pg_temp as $function$
  select greatest(10,least(180,coalesce(
    (select (ds.value #>> '{}')::numeric::integer
     from public.delivery_settings ds
     where ds.location_id=p_location_id and ds.key='driver_inactivity_pause_minutes'),
    (select (d.default_value #>> '{}')::numeric::integer
     from public.delivery_setting_defaults d
     where d.key='driver_inactivity_pause_minutes'),
    30
  )))
$function$;

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
      and d.dispatch_availability='available'
      and d.approved_at is not null
      and not d.rejected
      and d.state in ('idle','assigned','at_restaurant','en_route','returning')
      and d.shift_started_at is not null
      and d.shift_started_at<=p_at
      and d.shift_started_at>=public.mise_driver_workday_start(p_location_id,p_at)
      and d.shift_started_at>=p_at-make_interval(hours=>public.mise_driver_session_max_hours(p_location_id))
      and d.last_position_at is not null
      and d.last_position_at>=p_at-interval '15 minutes'
      and d.last_lat is not null
      and d.last_lng is not null
      and (d.excluded_until is null or d.excluded_until<=p_at)
      and (
        (d.push_enabled and (nullif(trim(d.expo_push_token),'') is not null or nullif(trim(d.voip_push_token),'') is not null))
        or exists(
          select 1
          from public.employees web_employee
          join public.driver_push_subscriptions web_subscription
            on web_subscription.employee_id=web_employee.id
          where web_employee.auth_user_id=d.auth_user_id
            and web_employee.tenant_id=p_tenant_id
            and web_employee.location_id=p_location_id
            and web_employee.kann_ausliefern
            and web_employee.status::text in ('aktiv','in_training','in_probe')
        )
      )
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

create or replace function public.start_driver_dispatch_session(
  p_driver_id uuid,
  p_location_id uuid,
  p_vehicle text default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_driver public.mise_drivers%rowtype;
  v_location public.locations%rowtype;
  v_shift public.driver_shifts%rowtype;
  v_planned boolean;
  v_resumed boolean:=false;
begin
  select * into strict v_driver from public.mise_drivers where id=p_driver_id for update;
  select * into strict v_location from public.locations where id=p_location_id and aktiv;
  if v_driver.approved_at is null or v_driver.rejected then raise exception 'driver is not approved'; end if;
  if not exists(select 1 from public.mise_driver_tenants where driver_id=v_driver.id and tenant_id=v_location.tenant_id and status='active') then
    raise exception 'driver has no active tenant membership';
  end if;
  if not (
    (v_driver.push_enabled and (nullif(trim(v_driver.expo_push_token),'') is not null or nullif(trim(v_driver.voip_push_token),'') is not null))
    or exists(
      select 1 from public.employees web_employee
      join public.driver_push_subscriptions web_subscription on web_subscription.employee_id=web_employee.id
      where web_employee.auth_user_id=v_driver.auth_user_id
        and web_employee.tenant_id=v_location.tenant_id
        and web_employee.location_id=v_location.id
        and web_employee.kann_ausliefern
        and web_employee.status::text in ('aktiv','in_training','in_probe')
    )
  ) then raise exception 'driver push channel is not ready'; end if;
  if v_driver.auth_user_id is not null and not exists(
    select 1 from public.employees e where e.auth_user_id=v_driver.auth_user_id
      and e.tenant_id=v_location.tenant_id and e.location_id=v_location.id
      and e.status::text in ('aktiv','in_training','in_probe')
  ) then raise exception 'driver employee is inactive or outside location'; end if;

  -- Ein zweiter Start innerhalb derselben aktuellen Session setzt die Startzeit
  -- nicht zurueck. Damit kann ein Reload keine Maximaldauer umgehen.
  if v_driver.active and v_driver.shift_started_at is not null
     and v_driver.shift_started_at>=public.mise_driver_workday_start(v_location.id,now())
     and v_driver.shift_started_at>=now()-make_interval(hours=>public.mise_driver_session_max_hours(v_location.id))
     and public.mise_driver_has_current_shift(v_driver.id,v_location.id,now()) then
    v_resumed:=true;
  else
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
  end if;

  update public.mise_drivers set
    active=true,
    dispatch_availability='available',
    availability_reason=null,
    availability_changed_at=now(),
    state=case when exists(
      select 1 from public.mise_delivery_batches b where b.driver_id=p_driver_id and b.state not in ('completed','cancelled')
    ) then state else 'idle' end,
    shift_started_at=case when v_resumed then shift_started_at else now() end,
    vehicle=case when p_vehicle in ('bike','car') then p_vehicle else vehicle end,
    last_active_at=now(),
    updated_at=now()
  where id=v_driver.id;

  update public.driver_status ds set ist_online=true,online_seit=coalesce(online_seit,now())
  from public.employees e
  where e.id=ds.employee_id and e.auth_user_id=v_driver.auth_user_id;

  return jsonb_build_object(
    'ok',true,'tenant_id',v_location.tenant_id,'location_id',v_location.id,
    'shift_id',v_shift.id,'fallback',coalesce(not v_planned,false),'resumed',v_resumed,
    'dispatch_availability','available'
  );
exception when no_data_found then raise exception 'driver or location not found';
end $function$;

create or replace function public.pause_driver_dispatch_session(
  p_driver_id uuid,
  p_reason text default 'manual',
  p_allow_active_batch boolean default false
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_driver public.mise_drivers%rowtype;
  v_has_batch boolean;
  v_reason text;
begin
  select * into strict v_driver from public.mise_drivers where id=p_driver_id for update;
  if not v_driver.active or v_driver.shift_started_at is null then raise exception 'driver is not on duty'; end if;
  select exists(
    select 1 from public.mise_delivery_batches b
    where b.driver_id=p_driver_id and b.state not in ('completed','cancelled')
  ) into v_has_batch;
  if v_has_batch and not p_allow_active_batch then raise exception 'driver has an active delivery batch'; end if;
  v_reason:=case when p_reason in ('manual','inactivity','admin','cutoff','push_unreachable') then p_reason else 'manual' end;

  update public.mise_drivers set
    dispatch_availability='paused',availability_reason=v_reason,availability_changed_at=now(),
    state=case when v_has_batch then state else 'offline' end,updated_at=now()
  where id=p_driver_id;
  update public.driver_status ds set ist_online=v_has_batch,online_seit=case when v_has_batch then online_seit else null end
  from public.employees e
  where e.id=ds.employee_id and e.auth_user_id=v_driver.auth_user_id;
  return jsonb_build_object('ok',true,'dispatch_availability','paused','reason',v_reason,'active_batch',v_has_batch);
exception when no_data_found then raise exception 'driver not found';
end $function$;

create or replace function public.resume_driver_dispatch_session(
  p_driver_id uuid,
  p_location_id uuid
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_driver public.mise_drivers%rowtype;
  v_location public.locations%rowtype;
  v_has_batch boolean;
begin
  select * into strict v_driver from public.mise_drivers where id=p_driver_id for update;
  select * into strict v_location from public.locations where id=p_location_id and aktiv;
  if not v_driver.active or v_driver.shift_started_at is null
     or v_driver.shift_started_at<public.mise_driver_workday_start(v_location.id,now())
     or v_driver.shift_started_at<now()-make_interval(hours=>public.mise_driver_session_max_hours(v_location.id))
     or not public.mise_driver_has_current_shift(v_driver.id,v_location.id,now()) then
    raise exception 'driver session expired; start a new shift';
  end if;
  if not exists(select 1 from public.mise_driver_tenants where driver_id=v_driver.id and tenant_id=v_location.tenant_id and status='active') then
    raise exception 'driver has no active tenant membership';
  end if;
  if not (
    (v_driver.push_enabled and (nullif(trim(v_driver.expo_push_token),'') is not null or nullif(trim(v_driver.voip_push_token),'') is not null))
    or exists(
      select 1 from public.employees web_employee
      join public.driver_push_subscriptions web_subscription on web_subscription.employee_id=web_employee.id
      where web_employee.auth_user_id=v_driver.auth_user_id
        and web_employee.tenant_id=v_location.tenant_id and web_employee.location_id=v_location.id
        and web_employee.kann_ausliefern and web_employee.status::text in ('aktiv','in_training','in_probe')
    )
  ) then raise exception 'driver push channel is not ready'; end if;

  select exists(
    select 1 from public.mise_delivery_batches b
    where b.driver_id=p_driver_id and b.state not in ('completed','cancelled')
  ) into v_has_batch;
  update public.mise_drivers set
    dispatch_availability='available',availability_reason=null,availability_changed_at=now(),
    state=case when v_has_batch then state else 'idle' end,last_active_at=now(),updated_at=now()
  where id=p_driver_id;
  update public.driver_status ds set ist_online=true,online_seit=coalesce(online_seit,now())
  from public.employees e
  where e.id=ds.employee_id and e.auth_user_id=v_driver.auth_user_id;
  return jsonb_build_object('ok',true,'dispatch_availability','available','active_batch',v_has_batch);
exception when no_data_found then raise exception 'driver or location not found';
end $function$;

create or replace function public.end_driver_dispatch_session(p_driver_id uuid)
returns boolean
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_auth_user_id uuid;
begin
  select auth_user_id into v_auth_user_id from public.mise_drivers where id=p_driver_id for update;
  if not found then return false; end if;
  if exists(select 1 from public.mise_delivery_batches where driver_id=p_driver_id and state not in ('completed','cancelled')) then
    raise exception 'driver has an active delivery batch';
  end if;
  update public.driver_shifts set status='completed',actual_end=coalesce(actual_end,now())
  where driver_id=p_driver_id and status='active' and actual_end is null;
  update public.mise_drivers set
    active=false,state='offline',shift_started_at=null,
    dispatch_availability='off_duty',availability_reason=null,availability_changed_at=now(),updated_at=now()
  where id=p_driver_id;
  update public.driver_status ds set ist_online=false,online_seit=null,aktueller_batch_id=null
  from public.employees e
  where e.id=ds.employee_id and e.auth_user_id=v_auth_user_id;
  return true;
end $function$;

create or replace function public.mark_stale_drivers_offline()
returns integer
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_row record;
  v_count integer:=0;
begin
  for v_row in
    select d.id,d.auth_user_id
    from public.mise_drivers d
    cross join lateral (
      select coalesce(
        (select s.location_id from public.driver_shifts s
         where s.driver_id=d.id and s.status='active' and s.actual_end is null
         order by s.planned_start desc limit 1),
        (select e.location_id from public.employees e
         where e.auth_user_id=d.auth_user_id and e.location_id is not null limit 1)
      ) as location_id
    ) scope
    where d.active and d.dispatch_availability='available' and d.state<>'offline'
      and coalesce(greatest(d.last_position_at,d.last_active_at),d.last_position_at,d.last_active_at,d.updated_at,d.created_at)
        < now()-make_interval(mins=>public.mise_driver_inactivity_pause_minutes(scope.location_id))
      and coalesce(d.shift_started_at,'-infinity'::timestamptz)<now()-interval '10 minutes'
      and not exists(
        select 1 from public.mise_delivery_batches b
        where b.driver_id=d.id and b.state not in ('completed','cancelled')
      )
    for update of d skip locked
  loop
    update public.mise_drivers set
      state='offline',dispatch_availability='paused',availability_reason='inactivity',
      availability_changed_at=now(),updated_at=now()
    where id=v_row.id;
    update public.driver_status ds set ist_online=false,online_seit=null
    from public.employees e
    where e.id=ds.employee_id and e.auth_user_id=v_row.auth_user_id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end $function$;

create or replace function public.close_expired_driver_sessions()
returns integer
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_row record;
  v_count integer:=0;
begin
  -- Aktive Tour darf auslaufen, wird aber sofort fuer weitere Zuweisungen gesperrt.
  for v_row in
    select d.id,scope.location_id
    from public.mise_drivers d
    cross join lateral (
      select coalesce(
        (select s.location_id from public.driver_shifts s where s.driver_id=d.id and s.status='active' and s.actual_end is null order by s.planned_start desc limit 1),
        (select b.location_id from public.mise_delivery_batches b where b.driver_id=d.id and b.state not in ('completed','cancelled') order by b.created_at desc limit 1),
        (select e.location_id from public.employees e where e.auth_user_id=d.auth_user_id and e.location_id is not null limit 1)
      ) as location_id
    ) scope
    where d.active and d.dispatch_availability='available' and d.shift_started_at is not null
      and (d.shift_started_at<public.mise_driver_workday_start(scope.location_id,now())
        or d.shift_started_at<now()-make_interval(hours=>public.mise_driver_session_max_hours(scope.location_id)))
      and exists(select 1 from public.mise_delivery_batches b where b.driver_id=d.id and b.state not in ('completed','cancelled'))
    for update of d skip locked
  loop
    update public.mise_drivers set
      dispatch_availability='paused',availability_reason='cutoff',availability_changed_at=now(),updated_at=now()
    where id=v_row.id;
  end loop;

  for v_row in
    select d.id,d.auth_user_id,scope.location_id
    from public.mise_drivers d
    cross join lateral (
      select coalesce(
        (select s.location_id from public.driver_shifts s where s.driver_id=d.id and s.status='active' and s.actual_end is null order by s.planned_start desc limit 1),
        (select e.location_id from public.employees e where e.auth_user_id=d.auth_user_id and e.location_id is not null limit 1)
      ) as location_id
    ) scope
    where d.active and d.shift_started_at is not null
      and (d.shift_started_at<public.mise_driver_workday_start(scope.location_id,now())
        or d.shift_started_at<now()-make_interval(hours=>public.mise_driver_session_max_hours(scope.location_id)))
      and not exists(select 1 from public.mise_delivery_batches b where b.driver_id=d.id and b.state not in ('completed','cancelled'))
    for update of d skip locked
  loop
    update public.driver_shifts set status='completed',actual_end=coalesce(actual_end,now())
    where driver_id=v_row.id and status='active' and actual_end is null;
    update public.driver_status ds set ist_online=false,online_seit=null,aktueller_batch_id=null
    from public.employees e where e.id=ds.employee_id and e.auth_user_id=v_row.auth_user_id;
    update public.mise_drivers set
      active=false,state='offline',shift_started_at=null,dispatch_availability='off_duty',
      availability_reason=null,availability_changed_at=now(),updated_at=now()
    where id=v_row.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end $function$;

create or replace function public.ingest_native_driver_gps(
  p_driver_id uuid,p_location_id uuid,p_action_id uuid,p_installation_id uuid,p_session_id uuid,
  p_sequence bigint,p_captured_at timestamptz,p_latitude double precision,p_longitude double precision,
  p_accuracy_m double precision,p_speed_mps double precision default null,p_heading_deg double precision default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_driver public.mise_drivers%rowtype;
  v_receipt_id bigint;
  v_batch_id uuid;
begin
  if p_sequence<0 or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
     or p_accuracy_m<0 or p_accuracy_m>10000
     or p_captured_at<now()-interval '24 hours' or p_captured_at>now()+interval '1 minute' then
    raise exception 'invalid native gps event';
  end if;
  select * into strict v_driver from public.mise_drivers where id=p_driver_id for update;
  select b.id into v_batch_id from public.mise_delivery_batches b
  where b.driver_id=p_driver_id and b.state not in ('completed','cancelled')
  order by b.created_at desc limit 1;
  if not v_driver.active or v_driver.shift_started_at is null
     or v_driver.shift_started_at<public.mise_driver_workday_start(p_location_id,now())
     or v_driver.shift_started_at<now()-make_interval(hours=>public.mise_driver_session_max_hours(p_location_id))
     or (v_driver.dispatch_availability<>'available' and v_batch_id is null) then
    raise exception 'driver session is not gps-enabled';
  end if;
  insert into public.mise_driver_gps_receipts(
    driver_id,location_id,action_id,installation_id,session_id,sequence,captured_at,metadata
  ) values (
    p_driver_id,p_location_id,p_action_id,p_installation_id,p_session_id,p_sequence,p_captured_at,coalesce(p_metadata,'{}'::jsonb)
  ) on conflict do nothing returning id into v_receipt_id;
  if v_receipt_id is null then return jsonb_build_object('duplicate',true,'accepted',true); end if;
  insert into public.mise_driver_locations(driver_id,lat,lng,accuracy_m,heading,speed_kmh,batch_id,recorded_at)
  values(p_driver_id,p_latitude,p_longitude,p_accuracy_m,p_heading_deg,
    case when p_speed_mps is null then null else greatest(0,p_speed_mps)*3.6 end,v_batch_id,p_captured_at);
  update public.mise_drivers set
    last_lat=case when last_position_at is null or p_captured_at>=last_position_at then p_latitude else last_lat end,
    last_lng=case when last_position_at is null or p_captured_at>=last_position_at then p_longitude else last_lng end,
    last_position_at=greatest(coalesce(last_position_at,p_captured_at),p_captured_at),last_active_at=now(),
    last_foreground_at=case when coalesce(p_metadata->>'app_state','unknown')='foreground' then now() else last_foreground_at end,
    updated_at=now()
  where id=p_driver_id;
  update public.driver_status ds set
    last_lat=case when ds.last_update is null or p_captured_at>=ds.last_update then p_latitude else ds.last_lat end,
    last_lng=case when ds.last_update is null or p_captured_at>=ds.last_update then p_longitude else ds.last_lng end,
    last_update=greatest(coalesce(ds.last_update,p_captured_at),p_captured_at)
  from public.employees e where ds.employee_id=e.id and e.auth_user_id=v_driver.auth_user_id;
  return jsonb_build_object('duplicate',false,'accepted',true,'receipt_id',v_receipt_id);
exception when no_data_found then raise exception 'driver not found';
end $function$;

revoke all on function public.mise_driver_inactivity_pause_minutes(uuid) from public,anon,authenticated;
revoke all on function public.mise_driver_is_dispatch_eligible(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.start_driver_dispatch_session(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.pause_driver_dispatch_session(uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.resume_driver_dispatch_session(uuid,uuid) from public,anon,authenticated;
revoke all on function public.end_driver_dispatch_session(uuid) from public,anon,authenticated;
revoke all on function public.mark_stale_drivers_offline() from public,anon,authenticated;
revoke all on function public.close_expired_driver_sessions() from public,anon,authenticated;
revoke all on function public.ingest_native_driver_gps(uuid,uuid,uuid,uuid,uuid,bigint,timestamptz,double precision,double precision,double precision,double precision,double precision,jsonb) from public,anon,authenticated;
grant execute on function public.mise_driver_inactivity_pause_minutes(uuid) to service_role;
grant execute on function public.mise_driver_is_dispatch_eligible(uuid,uuid,uuid,timestamptz) to service_role;
grant execute on function public.start_driver_dispatch_session(uuid,uuid,text) to service_role;
grant execute on function public.pause_driver_dispatch_session(uuid,text,boolean) to service_role;
grant execute on function public.resume_driver_dispatch_session(uuid,uuid) to service_role;
grant execute on function public.end_driver_dispatch_session(uuid) to service_role;
grant execute on function public.mark_stale_drivers_offline() to service_role;
grant execute on function public.close_expired_driver_sessions() to service_role;
grant execute on function public.ingest_native_driver_gps(uuid,uuid,uuid,uuid,uuid,bigint,timestamptz,double precision,double precision,double precision,double precision,double precision,jsonb) to service_role;

commit;
