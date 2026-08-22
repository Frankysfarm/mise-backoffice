-- Browser-Push is a first-class, tenant/location-scoped delivery channel.
begin;

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
declare v_driver public.mise_drivers%rowtype; v_location public.locations%rowtype; v_shift public.driver_shifts%rowtype; v_planned boolean;
begin
  select * into strict v_driver from public.mise_drivers where id=p_driver_id for update;
  select * into strict v_location from public.locations where id=p_location_id and aktiv;
  if v_driver.approved_at is null or v_driver.rejected then raise exception 'driver is not approved'; end if;
  if not exists(select 1 from public.mise_driver_tenants where driver_id=v_driver.id and tenant_id=v_location.tenant_id and status='active') then raise exception 'driver has no active tenant membership'; end if;
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

revoke all on function public.mise_driver_is_dispatch_eligible(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.start_driver_dispatch_session(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.mise_driver_is_dispatch_eligible(uuid,uuid,uuid,timestamptz) to service_role;
grant execute on function public.start_driver_dispatch_session(uuid,uuid,text) to service_role;

commit;
