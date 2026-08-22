-- 063: Konfigurierbarer Fahrer-Arbeitstag + sichere automatische Schichtschliessung.
--
-- Standard bleibt 00:00 Europe/Berlin. Ein Standort kann den Cutoff im
-- Backoffice als Minute des Tages verschieben (z. B. 180 = 03:00 Uhr).
-- Laufende Touren werden NIE hart beendet: Nach dem Cutoff gibt es keine neue
-- Zuweisung mehr; die operative Session wird erst ohne aktiven Batch geschlossen.

begin;

insert into public.delivery_setting_defaults
  (key, default_value, description, min_value, max_value, category)
values
  ('driver_shift_cutoff_minute', '0',
   'Automatisches Ende des Fahrer-Arbeitstags in Europe/Berlin (Minuten nach 00:00)',
   0, 1439, 'driver'),
  ('driver_session_max_hours', '16',
   'Maximale Dauer einer ununterbrochenen Fahrer-Session',
   1, 24, 'driver'),
  ('driver_background_gps_enabled', '1',
   'Hintergrund-GPS waehrend einer aktiven Fahrer-Schicht (1=an, 0=aus)',
   0, 1, 'driver')
on conflict (key) do update set
  default_value=excluded.default_value,
  description=excluded.description,
  min_value=excluded.min_value,
  max_value=excluded.max_value,
  category=excluded.category;

create or replace function public.mise_driver_workday_start(
  p_location_id uuid,
  p_at timestamptz default now()
) returns timestamptz
language plpgsql stable security definer set search_path=public,pg_temp as $function$
declare
  v_cutoff integer:=0;
  v_local timestamp;
  v_date date;
begin
  if p_location_id is not null then
    select greatest(0,least(1439,coalesce(
      (select (ds.value #>> '{}')::numeric::integer
       from public.delivery_settings ds
       where ds.location_id=p_location_id and ds.key='driver_shift_cutoff_minute'),
      (select (d.default_value #>> '{}')::numeric::integer
       from public.delivery_setting_defaults d
       where d.key='driver_shift_cutoff_minute'),
      0
    ))) into v_cutoff;
  end if;
  v_local:=p_at at time zone 'Europe/Berlin';
  v_date:=v_local::date;
  if extract(hour from v_local)::integer*60 + extract(minute from v_local)::integer < v_cutoff then
    v_date:=v_date-1;
  end if;
  return (v_date::timestamp + make_interval(mins=>v_cutoff)) at time zone 'Europe/Berlin';
end
$function$;

create or replace function public.mise_driver_session_max_hours(p_location_id uuid)
returns integer
language sql stable security definer set search_path=public,pg_temp as $function$
  select greatest(1,least(24,coalesce(
    (select (ds.value #>> '{}')::numeric::integer
     from public.delivery_settings ds
     where ds.location_id=p_location_id and ds.key='driver_session_max_hours'),
    (select (d.default_value #>> '{}')::numeric::integer
     from public.delivery_setting_defaults d
     where d.key='driver_session_max_hours'),
    16
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

create or replace function public.close_expired_driver_sessions()
returns integer
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_row record;
  v_count integer:=0;
begin
  for v_row in
    select d.id,d.auth_user_id,scope.location_id
    from public.mise_drivers d
    cross join lateral (
      select coalesce(
        (select s.location_id from public.driver_shifts s
         where s.driver_id=d.id and s.status='active' and s.actual_end is null
         order by s.planned_start desc limit 1),
        (select b.location_id from public.mise_delivery_batches b
         where b.driver_id=d.id and b.state not in ('completed','cancelled')
         order by b.created_at desc limit 1),
        (select e.location_id from public.employees e
         where e.auth_user_id=d.auth_user_id and e.location_id is not null limit 1)
      ) as location_id
    ) scope
    where d.active
      and d.shift_started_at is not null
      and (
        d.shift_started_at<public.mise_driver_workday_start(scope.location_id,now())
        or d.shift_started_at<now()-make_interval(hours=>public.mise_driver_session_max_hours(scope.location_id))
      )
      and not exists(
        select 1 from public.mise_delivery_batches b
        where b.driver_id=d.id and b.state not in ('completed','cancelled')
      )
    for update of d skip locked
  loop
    update public.driver_shifts
      set status='completed',actual_end=coalesce(actual_end,now())
      where driver_id=v_row.id and status='active' and actual_end is null;
    update public.driver_status ds
      set ist_online=false,online_seit=null,aktueller_batch_id=null
      from public.employees e
      where e.id=ds.employee_id and e.auth_user_id=v_row.auth_user_id;
    update public.mise_drivers
      set active=false,state='offline',shift_started_at=null,updated_at=now()
      where id=v_row.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end
$function$;

revoke all on function public.mise_driver_workday_start(uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.mise_driver_session_max_hours(uuid) from public,anon,authenticated;
revoke all on function public.close_expired_driver_sessions() from public,anon,authenticated;
revoke all on function public.mise_driver_is_dispatch_eligible(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.mise_driver_workday_start(uuid,timestamptz) to service_role;
grant execute on function public.mise_driver_session_max_hours(uuid) to service_role;
grant execute on function public.close_expired_driver_sessions() to service_role;
grant execute on function public.mise_driver_is_dispatch_eligible(uuid,uuid,uuid,timestamptz) to service_role;

commit;
