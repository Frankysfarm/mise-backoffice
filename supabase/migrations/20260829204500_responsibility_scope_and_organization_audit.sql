-- Close organization/responsibility gaps found during the independent release
-- review: Berlin shift coverage, cross-location references, cycle safety and
-- atomic audit trails for reporting-line changes.

begin;

create or replace function public.responsibility_assignment_active_at(
  p_valid_from date,
  p_valid_until date,
  p_weekday_scope smallint[],
  p_shift_start time,
  p_shift_end time,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $function$
  with moment as (
    select
      (p_at at time zone 'Europe/Berlin')::date as local_date,
      (p_at at time zone 'Europe/Berlin')::time as local_time
  ), duty as (
    select
      local_time,
      case
        when p_shift_start is not null and p_shift_end is not null
          and p_shift_start > p_shift_end and local_time <= p_shift_end
        then local_date - 1
        else local_date
      end as duty_date
    from moment
  )
  select
    duty_date >= p_valid_from
    and (p_valid_until is null or duty_date <= p_valid_until)
    and extract(isodow from duty_date)::smallint = any(p_weekday_scope)
    and case
      when p_shift_start is null and p_shift_end is null then true
      when p_shift_start is not null and p_shift_end is null then local_time >= p_shift_start
      when p_shift_start is null and p_shift_end is not null then local_time <= p_shift_end
      when p_shift_start <= p_shift_end then local_time between p_shift_start and p_shift_end
      else local_time >= p_shift_start or local_time <= p_shift_end
    end
  from duty
$function$;

create or replace view public.v_responsibility_coverage
with (security_invoker=true)
as
select
  d.id as department_id,d.tenant_id,d.location_id,d.name,d.prioritaet,
  d.hauptverantwortung_erforderlich,d.stellvertretung_erforderlich,
  primary_assignment.employee_id as hauptverantwortlicher_id,
  deputy_assignment.employee_id as stellvertretung_id,
  coalesce(
    case when primary_absence.employee_id is null then primary_assignment.employee_id end,
    deputy_assignment.employee_id
  ) as aktuell_zustaendig_id,
  (primary_absence.employee_id is not null) as hauptverantwortlicher_abwesend,
  case
    when d.hauptverantwortung_erforderlich and primary_assignment.employee_id is null then 'hauptverantwortung_fehlt'
    when d.stellvertretung_erforderlich and deputy_assignment.employee_id is null then 'stellvertretung_fehlt'
    when primary_absence.employee_id is not null and deputy_assignment.employee_id is null then 'vertretung_waehrend_abwesenheit_fehlt'
    when primary_absence.employee_id is not null then 'aktive_vertretung'
    else 'abgedeckt'
  end as abdeckungsstatus
from public.departments d
left join lateral (
  select a.employee_id from public.department_responsibility_assignments a
  where a.department_id=d.id and a.responsibility_role='hauptverantwortung' and a.aktiv
    and public.responsibility_assignment_active_at(
      a.valid_from,a.valid_until,a.weekday_scope,a.shift_start,a.shift_end,now()
    )
  order by a.valid_from desc,a.created_at desc limit 1
) primary_assignment on true
left join lateral (
  select primary_assignment.employee_id
  where primary_assignment.employee_id is not null and (
    exists(
      select 1 from public.employees e
      where e.id=primary_assignment.employee_id and e.status::text in ('krank','urlaub','inaktiv')
    )
    or exists(
      select 1 from public.vacation_requests v
      where v.employee_id=primary_assignment.employee_id
        and v.status::text in ('genehmigt','approved')
        and (now() at time zone 'Europe/Berlin')::date between v.von_datum and v.bis_datum
    )
    or exists(
      select 1 from public.availability_exceptions x
      where x.employee_id=primary_assignment.employee_id
        and x.datum=(now() at time zone 'Europe/Berlin')::date
        and x.typ::text in ('gesperrt','nicht_verfuegbar','krank','abwesend','unavailable','sick')
    )
  )
) primary_absence on true
left join lateral (
  select a.employee_id from public.department_responsibility_assignments a
  where a.department_id=d.id and a.responsibility_role='stellvertretung' and a.aktiv
    and public.responsibility_assignment_active_at(
      a.valid_from,a.valid_until,a.weekday_scope,a.shift_start,a.shift_end,now()
    )
  order by a.valid_from desc,a.created_at desc limit 1
) deputy_assignment on true
where d.aktiv;

create or replace function public.unified_validate_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_row jsonb:=to_jsonb(new);
  v_tenant_id uuid:=nullif(v_row->>'tenant_id','')::uuid;
  v_location_id uuid;
  v_department_id uuid;
  v_position_id uuid;
  v_task_id uuid;
  v_location_tenant uuid;
  v_department_tenant uuid;
  v_department_location uuid;
  v_employee_id uuid;
begin
  v_location_id:=nullif(v_row->>'location_id','')::uuid;
  v_department_id:=coalesce(
    nullif(v_row->>'department_id','')::uuid,
    nullif(v_row->>'assigned_department_id','')::uuid
  );
  v_position_id:=nullif(v_row->>'position_id','')::uuid;
  v_task_id:=nullif(v_row->>'task_id','')::uuid;

  if v_location_id is not null then
    select tenant_id into v_location_tenant from public.locations where id=v_location_id;
    if v_location_tenant is distinct from v_tenant_id then
      raise exception 'location is outside tenant';
    end if;
  end if;
  if v_department_id is not null then
    select coalesce(d.tenant_id,l.tenant_id),d.location_id
      into v_department_tenant,v_department_location
    from public.departments d join public.locations l on l.id=d.location_id
    where d.id=v_department_id;
    if v_department_tenant is distinct from v_tenant_id then
      raise exception 'department is outside tenant';
    end if;
    if v_location_id is not null and v_department_location is distinct from v_location_id then
      raise exception 'department is outside location';
    end if;
  end if;
  if v_position_id is not null and not exists(
    select 1 from public.organization_positions p
    where p.id=v_position_id and p.tenant_id=v_tenant_id
  ) then
    raise exception 'position is outside tenant';
  end if;
  if v_task_id is not null and not exists(
    select 1 from public.operational_tasks t
    where t.id=v_task_id and t.tenant_id=v_tenant_id
  ) then
    raise exception 'task is outside tenant';
  end if;
  foreach v_employee_id in array array_remove(array[
    nullif(v_row->>'employee_id','')::uuid,
    nullif(v_row->>'assigned_to','')::uuid,
    nullif(v_row->>'accountable_employee_id','')::uuid,
    nullif(v_row->>'controller_employee_id','')::uuid,
    nullif(v_row->>'created_by','')::uuid,
    nullif(v_row->>'from_employee_id','')::uuid,
    nullif(v_row->>'to_employee_id','')::uuid,
    nullif(v_row->>'submitted_by','')::uuid,
    nullif(v_row->>'verified_by','')::uuid
  ]::uuid[],null) loop
    if v_employee_id is not null and not exists(
      select 1 from public.employees e where e.id=v_employee_id and e.tenant_id=v_tenant_id
    ) then
      raise exception 'employee is outside tenant';
    end if;
  end loop;
  if v_location_id is not null then
    foreach v_employee_id in array array_remove(array[
      nullif(v_row->>'employee_id','')::uuid,
      nullif(v_row->>'assigned_to','')::uuid,
      nullif(v_row->>'accountable_employee_id','')::uuid,
      nullif(v_row->>'controller_employee_id','')::uuid,
      nullif(v_row->>'from_employee_id','')::uuid,
      nullif(v_row->>'to_employee_id','')::uuid
    ]::uuid[],null) loop
      if v_employee_id is not null and not exists(
        select 1 from public.employees e
        where e.id=v_employee_id and e.tenant_id=v_tenant_id and e.location_id=v_location_id
      ) then
        raise exception 'employee is outside location';
      end if;
    end loop;
  end if;
  return new;
end
$function$;

create or replace function public.validate_employee_reporting_line()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.reports_to_employee_id is null then return new; end if;
  if not exists(
    select 1 from public.employees manager
    where manager.id=new.reports_to_employee_id
      and manager.tenant_id=new.tenant_id
      and manager.location_id is not distinct from new.location_id
  ) then
    raise exception 'manager is outside employee scope';
  end if;
  if exists(
    with recursive ancestors(id,reports_to_employee_id) as (
      select e.id,e.reports_to_employee_id from public.employees e where e.id=new.reports_to_employee_id
      union
      select e.id,e.reports_to_employee_id
      from public.employees e join ancestors a on e.id=a.reports_to_employee_id
    )
    select 1 from ancestors where id=new.id
  ) then
    raise exception 'reporting line cycle';
  end if;
  return new;
end
$function$;

drop trigger if exists employees_reporting_line_validate on public.employees;
create trigger employees_reporting_line_validate
before update of reports_to_employee_id on public.employees
for each row when (old.reports_to_employee_id is distinct from new.reports_to_employee_id)
execute function public.validate_employee_reporting_line();

create or replace function public.audit_employee_organization_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
begin
  begin
    v_actor:=nullif(current_setting('app.audit_employee_id',true),'')::uuid;
  exception when others then
    v_actor:=null;
  end;
  v_actor:=coalesce(v_actor,public.current_employee_id());
  insert into public.audit_log(
    tenant_id,employee_id,action,entity_type,entity_id,payload_before,payload_after
  ) values (
    new.tenant_id,v_actor,'organization_update','employees',new.id,
    jsonb_build_object('reports_to_employee_id',old.reports_to_employee_id,'position_title',old.position_title),
    jsonb_build_object('reports_to_employee_id',new.reports_to_employee_id,'position_title',new.position_title)
  );
  return new;
end
$function$;

drop trigger if exists employees_organization_audit on public.employees;
create trigger employees_organization_audit
after update of reports_to_employee_id,position_title on public.employees
for each row when (
  old.reports_to_employee_id is distinct from new.reports_to_employee_id
  or old.position_title is distinct from new.position_title
)
execute function public.audit_employee_organization_change();

create or replace function public.move_employee_in_organization(
  p_tenant_id uuid,
  p_location_id uuid,
  p_employee_id uuid,
  p_reports_to_employee_id uuid,
  p_position_title text,
  p_update_position boolean,
  p_actor_id uuid
)
returns table(id uuid,reports_to_employee_id uuid,position_title text)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor record;
begin
  select e.tenant_id,e.location_id,e.rolle::text as rolle into v_actor
  from public.employees e where e.id=p_actor_id and e.tenant_id=p_tenant_id;
  if not found or v_actor.rolle not in ('manager','backoffice','admin') then
    raise exception 'actor is not allowed to manage organization';
  end if;
  if v_actor.rolle='manager' and v_actor.location_id is distinct from p_location_id then
    raise exception 'actor is outside location';
  end if;
  if not exists(
    select 1 from public.employees e
    where e.id=p_employee_id and e.tenant_id=p_tenant_id and e.location_id=p_location_id
      and e.status::text in ('aktiv','in_training','in_probe')
  ) then
    raise exception 'employee is outside location';
  end if;
  if p_reports_to_employee_id is not null and not exists(
    select 1 from public.employees e
    where e.id=p_reports_to_employee_id and e.tenant_id=p_tenant_id and e.location_id=p_location_id
      and e.status::text in ('aktiv','in_training','in_probe')
  ) then
    raise exception 'manager is outside location';
  end if;
  if p_reports_to_employee_id=p_employee_id or exists(
    with recursive ancestors(id,reports_to_employee_id) as (
      select e.id,e.reports_to_employee_id from public.employees e where e.id=p_reports_to_employee_id
      union
      select e.id,e.reports_to_employee_id
      from public.employees e join ancestors a on e.id=a.reports_to_employee_id
    )
    select 1 from ancestors where ancestors.id=p_employee_id
  ) then
    raise exception 'reporting line cycle';
  end if;
  perform set_config('app.audit_employee_id',p_actor_id::text,true);
  return query
  update public.employees e set
    reports_to_employee_id=p_reports_to_employee_id,
    position_title=case when p_update_position then coalesce(nullif(trim(p_position_title),''),'Mitarbeiter') else e.position_title end
  where e.id=p_employee_id and e.tenant_id=p_tenant_id and e.location_id=p_location_id
  returning e.id,e.reports_to_employee_id,e.position_title;
end
$function$;

revoke all on function public.responsibility_assignment_active_at(date,date,smallint[],time,time,timestamptz) from public;
grant execute on function public.responsibility_assignment_active_at(date,date,smallint[],time,time,timestamptz) to authenticated,service_role;
revoke all on function public.validate_employee_reporting_line(),public.audit_employee_organization_change() from public;
revoke all on function public.move_employee_in_organization(uuid,uuid,uuid,uuid,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.move_employee_in_organization(uuid,uuid,uuid,uuid,text,boolean,uuid) to service_role;

commit;
