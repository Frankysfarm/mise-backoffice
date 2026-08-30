-- Daily clarity automation: bounded task escalation, per-location morning
-- briefings, and manager-confirmed weekly schedule suggestions.

begin;

alter table public.operational_tasks
  add column if not exists escalation_owner_employee_id uuid
    references public.employees(id) on delete set null;

create index if not exists operational_tasks_escalation_sweep_idx
  on public.operational_tasks(due_at,last_escalated_at,escalation_level)
  where status in ('offen','angenommen','in_arbeit','wartet_auf_pruefung','blockiert')
    and due_at is not null and escalation_level < 3;

drop function if exists public.process_operational_escalations(timestamptz);
create function public.process_operational_escalations(
  p_now timestamptz default now(),
  p_interval interval default interval '4 hours'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_task public.operational_tasks%rowtype;
  v_level smallint;
  v_owner uuid;
  v_count integer:=0;
begin
  if p_interval < interval '15 minutes' or p_interval > interval '7 days' then
    raise exception 'escalation interval must be between 15 minutes and 7 days';
  end if;

  for v_task in
    select t.*
    from public.operational_tasks t
    where t.due_at < p_now
      and t.status in ('offen','angenommen','in_arbeit','wartet_auf_pruefung','blockiert')
      and t.escalation_level < 3
      and (t.last_escalated_at is null or t.last_escalated_at <= p_now-p_interval)
    order by t.due_at,t.id
    for update skip locked
  loop
    v_level:=least(v_task.escalation_level+1,3)::smallint;
    v_owner:=case
      when v_level>=2 then coalesce(v_task.controller_employee_id,v_task.accountable_employee_id)
      else v_task.accountable_employee_id
    end;

    update public.operational_tasks
    set escalation_level=v_level,
        escalation_owner_employee_id=v_owner,
        last_escalated_at=p_now,
        updated_at=p_now
    where id=v_task.id;

    insert into public.audit_log(
      tenant_id,employee_id,action,entity_type,entity_id,payload_before,payload_after
    ) values (
      v_task.tenant_id,null,'operational_task_escalated','operational_tasks',v_task.id,
      jsonb_build_object(
        'escalation_level',v_task.escalation_level,
        'escalation_owner_employee_id',v_task.escalation_owner_employee_id,
        'last_escalated_at',v_task.last_escalated_at
      ),
      jsonb_build_object(
        'escalation_level',v_level,
        'escalation_owner_employee_id',v_owner,
        'last_escalated_at',p_now,
        'interval_seconds',extract(epoch from p_interval)::bigint
      )
    );

    if v_owner is not null then
      insert into public.notifications(employee_id,typ,titel,nachricht,link)
      values(
        v_owner,
        case when v_level=1 then 'warnung' else 'dringend' end,
        case when v_level=1 then 'Überfällige Aufgabe: Verantwortung klären' else 'Überfällige Aufgabe: Kontrolle erforderlich' end,
        v_task.title,
        case when v_level=1 then '/mitarbeiter#verantwortung' else '/neo/app/mitarbeiter?tab=aufgaben' end
      );
    end if;

    v_count:=v_count+1;
  end loop;

  return v_count;
end
$function$;

revoke all on function public.process_operational_escalations(timestamptz,interval)
  from public,anon,authenticated;
grant execute on function public.process_operational_escalations(timestamptz,interval)
  to service_role;

create table if not exists public.operational_daily_briefings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  briefing_date date not null,
  shifts jsonb not null default '[]'::jsonb,
  task_counts jsonb not null default '[]'::jsonb,
  coverage_gaps jsonb not null default '[]'::jsonb,
  absences jsonb not null default '[]'::jsonb,
  escalated_tasks jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,location_id,briefing_date)
);

create index if not exists operational_daily_briefings_location_date_idx
  on public.operational_daily_briefings(tenant_id,location_id,briefing_date desc);

alter table public.operational_daily_briefings enable row level security;
drop policy if exists operational_daily_briefing_service on public.operational_daily_briefings;
drop policy if exists operational_daily_briefing_manager_read on public.operational_daily_briefings;
create policy operational_daily_briefing_service on public.operational_daily_briefings
for all to service_role using (true) with check (true);
create policy operational_daily_briefing_manager_read on public.operational_daily_briefings
for select to authenticated using (
  tenant_id=public.current_tenant_id()
  and public.can_manage_operational_location(tenant_id,location_id)
);

drop trigger if exists operational_daily_briefing_audit on public.operational_daily_briefings;
create trigger operational_daily_briefing_audit
after insert or update or delete on public.operational_daily_briefings
for each row execute function public.unified_audit_change();

create function public.materialize_operational_daily_briefings(
  p_local_date date default null,
  p_generated_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_location record;
  v_date date:=coalesce(p_local_date,(p_generated_at at time zone 'Europe/Berlin')::date);
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_shifts jsonb;
  v_task_counts jsonb;
  v_coverage_gaps jsonb;
  v_absences jsonb;
  v_escalated_tasks jsonb;
  v_count integer:=0;
begin
  v_day_start:=v_date::timestamp at time zone 'Europe/Berlin';
  v_day_end:=(v_date+1)::timestamp at time zone 'Europe/Berlin';

  for v_location in
    select l.id,l.tenant_id from public.locations l order by l.tenant_id,l.id
  loop
    select coalesce(jsonb_agg(row_data order by row_data->>'start_at'),'[]'::jsonb)
    into v_shifts
    from (
      select jsonb_build_object(
        'id',s.id,'employee_id',e.id,
        'employee_name',nullif(trim(concat_ws(' ',e.vorname,e.nachname)),''),
        'department_id',d.id,'department_name',d.name,
        'start_at',s.start_zeit,'end_at',s.end_zeit,'position',s.position
      ) as row_data
      from public.shifts s
      left join public.employees e on e.id=s.employee_id and e.tenant_id=s.tenant_id
      left join public.departments d on d.id=s.department_id and d.tenant_id=s.tenant_id
      where s.tenant_id=v_location.tenant_id and s.location_id=v_location.id
        and s.start_zeit>=v_day_start and s.start_zeit<v_day_end
        and s.status::text not in ('abgesagt','storniert')
        and coalesce(s.typ::text,'')<>'probe'
    ) rows_for_day;

    select coalesce(jsonb_agg(row_data order by row_data->>'department_name'),'[]'::jsonb)
    into v_task_counts
    from (
      select jsonb_build_object(
        'department_id',t.department_id,
        'department_name',coalesce(d.name,'Standortweit'),
        'open_count',count(*),
        'overdue_count',count(*) filter(where t.due_at<p_generated_at)
      ) as row_data
      from public.operational_tasks t
      left join public.departments d on d.id=t.department_id and d.tenant_id=t.tenant_id
      where t.tenant_id=v_location.tenant_id and t.location_id=v_location.id
        and t.status in ('offen','angenommen','in_arbeit','wartet_auf_pruefung','blockiert')
      group by t.department_id,d.name
    ) task_groups;

    select coalesce(jsonb_agg(row_data order by row_data->>'department_name'),'[]'::jsonb)
    into v_coverage_gaps
    from (
      select jsonb_build_object(
        'department_id',c.department_id,'department_name',c.name,
        'status',c.abdeckungsstatus,
        'responsible_employee_id',c.aktuell_zustaendig_id
      ) as row_data
      from public.v_responsibility_coverage c
      where c.tenant_id=v_location.tenant_id and c.location_id=v_location.id
        and c.abdeckungsstatus<>'abgedeckt'
    ) gap_rows;

    select coalesce(jsonb_agg(row_data order by row_data->>'employee_name'),'[]'::jsonb)
    into v_absences
    from (
      select jsonb_build_object(
        'employee_id',e.id,
        'employee_name',nullif(trim(concat_ws(' ',e.vorname,e.nachname)),''),
        'type',x.typ
      ) as row_data
      from public.availability_exceptions x
      join public.employees e on e.id=x.employee_id and e.tenant_id=x.tenant_id
      where x.tenant_id=v_location.tenant_id and e.location_id=v_location.id
        and x.datum=v_date and x.typ='gesperrt'
    ) absence_rows;

    select coalesce(jsonb_agg(row_data order by (row_data->>'escalation_level')::integer desc,row_data->>'due_at'),'[]'::jsonb)
    into v_escalated_tasks
    from (
      select jsonb_build_object(
        'id',t.id,'title',t.title,'department_id',t.department_id,
        'due_at',t.due_at,'escalation_level',t.escalation_level,
        'owner_employee_id',t.escalation_owner_employee_id,
        'owner_name',nullif(trim(concat_ws(' ',owner.vorname,owner.nachname)),'')
      ) as row_data
      from public.operational_tasks t
      left join public.employees owner
        on owner.id=t.escalation_owner_employee_id and owner.tenant_id=t.tenant_id
      where t.tenant_id=v_location.tenant_id and t.location_id=v_location.id
        and t.status in ('offen','angenommen','in_arbeit','wartet_auf_pruefung','blockiert')
        and t.escalation_level>0
    ) escalated_rows;

    insert into public.operational_daily_briefings(
      tenant_id,location_id,briefing_date,shifts,task_counts,coverage_gaps,
      absences,escalated_tasks,generated_at,updated_at
    ) values (
      v_location.tenant_id,v_location.id,v_date,v_shifts,v_task_counts,v_coverage_gaps,
      v_absences,v_escalated_tasks,p_generated_at,p_generated_at
    )
    on conflict(tenant_id,location_id,briefing_date) do update set
      shifts=excluded.shifts,task_counts=excluded.task_counts,
      coverage_gaps=excluded.coverage_gaps,absences=excluded.absences,
      escalated_tasks=excluded.escalated_tasks,generated_at=excluded.generated_at,
      updated_at=excluded.updated_at;
    v_count:=v_count+1;
  end loop;

  return v_count;
end
$function$;

revoke all on table public.operational_daily_briefings from public,anon,authenticated;
grant select on table public.operational_daily_briefings to authenticated;
grant all on table public.operational_daily_briefings to service_role;
revoke all on function public.materialize_operational_daily_briefings(date,timestamptz)
  from public,anon,authenticated;
grant execute on function public.materialize_operational_daily_briefings(date,timestamptz)
  to service_role;

create table if not exists public.weekly_shift_assignment_suggestions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  week_start date not null,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  score integer not null,
  reason text not null check(length(reason) between 2 and 500),
  status text not null default 'draft' check(status in ('draft','confirmed','obsolete')),
  generated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(shift_id)
);

create index if not exists weekly_shift_suggestions_location_week_idx
  on public.weekly_shift_assignment_suggestions(tenant_id,location_id,week_start,status);

create function public.validate_weekly_shift_suggestion_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if extract(isodow from new.week_start)<>1 then raise exception 'week_start must be a Monday'; end if;
  if not exists(
    select 1 from public.locations l
    where l.id=new.location_id and l.tenant_id=new.tenant_id
  ) then raise exception 'suggestion location is outside tenant'; end if;
  if not exists(
    select 1 from public.shifts s
    where s.id=new.shift_id and s.tenant_id=new.tenant_id and s.location_id=new.location_id
      and (s.start_zeit at time zone 'Europe/Berlin')::date>=new.week_start
      and (s.start_zeit at time zone 'Europe/Berlin')::date<new.week_start+7
  ) then raise exception 'suggestion shift is outside week or location'; end if;
  if not exists(
    select 1 from public.employees e
    where e.id=new.employee_id and e.tenant_id=new.tenant_id and e.location_id=new.location_id
  ) then raise exception 'suggested employee is outside location'; end if;
  if new.confirmed_by is not null and not exists(
    select 1 from public.employees e
    where e.id=new.confirmed_by and e.tenant_id=new.tenant_id
      and e.rolle::text in ('manager','backoffice','admin')
      and (e.rolle::text in ('backoffice','admin') or e.location_id=new.location_id)
  ) then raise exception 'confirming actor is outside location'; end if;
  return new;
end
$function$;

drop trigger if exists weekly_shift_suggestion_scope on public.weekly_shift_assignment_suggestions;
create trigger weekly_shift_suggestion_scope
before insert or update on public.weekly_shift_assignment_suggestions
for each row execute function public.validate_weekly_shift_suggestion_scope();
drop trigger if exists weekly_shift_suggestion_touch on public.weekly_shift_assignment_suggestions;
create trigger weekly_shift_suggestion_touch
before update on public.weekly_shift_assignment_suggestions
for each row execute function public.unified_touch_updated_at();
drop trigger if exists weekly_shift_suggestion_audit on public.weekly_shift_assignment_suggestions;
create trigger weekly_shift_suggestion_audit
after insert or update or delete on public.weekly_shift_assignment_suggestions
for each row execute function public.unified_audit_change();

alter table public.weekly_shift_assignment_suggestions enable row level security;
drop policy if exists weekly_shift_suggestion_service on public.weekly_shift_assignment_suggestions;
drop policy if exists weekly_shift_suggestion_manager_read on public.weekly_shift_assignment_suggestions;
create policy weekly_shift_suggestion_service on public.weekly_shift_assignment_suggestions
for all to service_role using (true) with check (true);
create policy weekly_shift_suggestion_manager_read on public.weekly_shift_assignment_suggestions
for select to authenticated using (
  tenant_id=public.current_tenant_id()
  and public.can_manage_operational_location(tenant_id,location_id)
);

create function public.generate_weekly_shift_assignment_suggestions(
  p_tenant_id uuid,
  p_location_id uuid,
  p_week_start date,
  p_actor_id uuid
)
returns setof public.weekly_shift_assignment_suggestions
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor record;
  v_shift record;
  v_candidate record;
  v_week_start_at timestamptz;
  v_week_end_at timestamptz;
  v_shift_minutes numeric;
  v_reason text;
begin
  if extract(isodow from p_week_start)<>1 then raise exception 'week_start must be a Monday'; end if;
  select e.tenant_id,e.location_id,e.rolle::text as rolle into v_actor
  from public.employees e
  where e.id=p_actor_id and e.tenant_id=p_tenant_id
    and e.status::text in ('aktiv','in_training','in_probe');
  if not found or v_actor.rolle not in ('manager','backoffice','admin') then
    raise exception 'actor is not allowed to generate schedule suggestions';
  end if;
  if v_actor.rolle='manager' and v_actor.location_id is distinct from p_location_id then
    raise exception 'actor is outside location';
  end if;
  if not exists(
    select 1 from public.locations l where l.id=p_location_id and l.tenant_id=p_tenant_id
  ) then raise exception 'location is outside tenant'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text||':'||p_location_id::text||':'||p_week_start::text,0
  ));
  perform set_config('app.audit_employee_id',p_actor_id::text,true);
  v_week_start_at:=p_week_start::timestamp at time zone 'Europe/Berlin';
  v_week_end_at:=(p_week_start+7)::timestamp at time zone 'Europe/Berlin';

  update public.weekly_shift_assignment_suggestions
  set status='obsolete',updated_at=now()
  where tenant_id=p_tenant_id and location_id=p_location_id
    and week_start=p_week_start and status='draft';

  for v_shift in
    select s.* from public.shifts s
    where s.tenant_id=p_tenant_id and s.location_id=p_location_id
      and s.start_zeit>=v_week_start_at and s.start_zeit<v_week_end_at
      and s.employee_id is null
      and s.status::text not in ('abgesagt','storniert')
      and coalesce(s.typ::text,'')<>'probe'
    order by s.start_zeit,s.id
    for update skip locked
  loop
    v_shift_minutes:=extract(epoch from (v_shift.end_zeit-v_shift.start_zeit))/60;

    select ranked.* into v_candidate
    from (
      select candidate.*,
        (
          case when candidate.exception_available then 120
               when candidate.regular_available then 100 else 35 end
          + case when candidate.preferred then 20 else 0 end
          + case when v_shift.department_id is null then 10 else 40 end
          - ceil(candidate.assigned_hours*2)::integer
        ) as final_score
      from (
        select e.id,e.vorname,e.nachname,
          exists(
            select 1 from public.availability_exceptions x
            where x.tenant_id=p_tenant_id and x.employee_id=e.id
              and x.datum=(v_shift.start_zeit at time zone 'Europe/Berlin')::date
              and x.typ in ('verfügbar','bevorzugt')
          ) as exception_available,
          coalesce(availability.available_minutes,0)>=v_shift_minutes as regular_available,
          coalesce(availability.preferred,false) or exists(
            select 1 from public.availability_exceptions x
            where x.tenant_id=p_tenant_id and x.employee_id=e.id
              and x.datum=(v_shift.start_zeit at time zone 'Europe/Berlin')::date
              and x.typ='bevorzugt'
          ) as preferred,
          coalesce(hours.assigned_hours,0) as assigned_hours
        from public.employees e
        left join lateral (
          select
            coalesce(sum(extract(epoch from (
              least(a.end_time,(v_shift.end_zeit at time zone 'Europe/Berlin')::time)
              - greatest(a.start_time,(v_shift.start_zeit at time zone 'Europe/Berlin')::time)
            ))/60) filter(where a.typ in ('verfügbar','bevorzugt')),0) as available_minutes,
            coalesce(bool_or(a.typ='bevorzugt'),false) as preferred
          from public.employee_availability a
          where a.employee_id=e.id
            and a.weekday=extract(isodow from v_shift.start_zeit at time zone 'Europe/Berlin')::integer-1
            and (v_shift.start_zeit at time zone 'Europe/Berlin')::date
                =(v_shift.end_zeit at time zone 'Europe/Berlin')::date
            and a.start_time<(v_shift.end_zeit at time zone 'Europe/Berlin')::time
            and a.end_time>(v_shift.start_zeit at time zone 'Europe/Berlin')::time
        ) availability on true
        left join lateral (
          select
            coalesce((
              select sum(extract(epoch from (assigned.end_zeit-assigned.start_zeit))/3600)
              from public.shifts assigned
              where assigned.tenant_id=p_tenant_id and assigned.employee_id=e.id
                and assigned.start_zeit>=v_week_start_at and assigned.start_zeit<v_week_end_at
                and assigned.status::text not in ('abgesagt','storniert')
            ),0)
            + coalesce((
              select sum(extract(epoch from (suggested_shift.end_zeit-suggested_shift.start_zeit))/3600)
              from public.weekly_shift_assignment_suggestions suggested
              join public.shifts suggested_shift on suggested_shift.id=suggested.shift_id
              where suggested.tenant_id=p_tenant_id and suggested.location_id=p_location_id
                and suggested.week_start=p_week_start and suggested.employee_id=e.id
                and suggested.status='draft'
            ),0) as assigned_hours
        ) hours on true
        where e.tenant_id=p_tenant_id and e.location_id=p_location_id
          and e.status::text='aktiv'
          and (
            v_shift.department_id is null or e.department_id=v_shift.department_id or exists(
              select 1 from public.department_responsibility_assignments responsibility
              where responsibility.tenant_id=p_tenant_id
                and responsibility.location_id=p_location_id
                and responsibility.department_id=v_shift.department_id
                and responsibility.employee_id=e.id and responsibility.aktiv
                and public.responsibility_assignment_active_at(
                  responsibility.valid_from,responsibility.valid_until,responsibility.weekday_scope,
                  responsibility.shift_start,responsibility.shift_end,v_shift.start_zeit
                )
            )
          )
          and not exists(
            select 1 from public.availability_exceptions x
            where x.tenant_id=p_tenant_id and x.employee_id=e.id
              and x.datum=(v_shift.start_zeit at time zone 'Europe/Berlin')::date
              and x.typ='gesperrt'
          )
          and not exists(
            select 1 from public.employee_availability blocked
            where blocked.employee_id=e.id
              and blocked.weekday=extract(isodow from v_shift.start_zeit at time zone 'Europe/Berlin')::integer-1
              and blocked.typ='gesperrt'
              and blocked.start_time<(v_shift.end_zeit at time zone 'Europe/Berlin')::time
              and blocked.end_time>(v_shift.start_zeit at time zone 'Europe/Berlin')::time
          )
          and not exists(
            select 1 from public.shifts other
            where other.tenant_id=p_tenant_id and other.employee_id=e.id and other.id<>v_shift.id
              and other.status::text not in ('abgesagt','storniert')
              and tstzrange(other.start_zeit,other.end_zeit,'[)')
                  && tstzrange(v_shift.start_zeit,v_shift.end_zeit,'[)')
          )
          and not exists(
            select 1 from public.weekly_shift_assignment_suggestions other_suggestion
            join public.shifts other_shift on other_shift.id=other_suggestion.shift_id
            where other_suggestion.tenant_id=p_tenant_id
              and other_suggestion.employee_id=e.id and other_suggestion.status='draft'
              and tstzrange(other_shift.start_zeit,other_shift.end_zeit,'[)')
                  && tstzrange(v_shift.start_zeit,v_shift.end_zeit,'[)')
          )
      ) candidate
    ) ranked
    order by ranked.final_score desc,ranked.assigned_hours,ranked.id
    limit 1;

    if not found then continue; end if;
    v_reason:=case
      when v_candidate.preferred then 'Bevorzugte Verfügbarkeit passt'
      when v_candidate.exception_available then 'Sonder-Verfügbarkeit passt'
      when v_candidate.regular_available then 'Verfügbarkeit passt'
      else 'Keine Sperre eingetragen'
    end
      ||case when v_shift.department_id is null then ' · standortweit einsetzbar' else ' · Bereichsqualifikation passt' end
      ||format(' · bisher %s Std. in dieser Woche',round(v_candidate.assigned_hours::numeric,1));

    insert into public.weekly_shift_assignment_suggestions(
      tenant_id,location_id,week_start,shift_id,employee_id,score,reason,status,
      generated_at,confirmed_at,confirmed_by,updated_at
    ) values (
      p_tenant_id,p_location_id,p_week_start,v_shift.id,v_candidate.id,
      v_candidate.final_score,v_reason,'draft',now(),null,null,now()
    )
    on conflict(shift_id) do update set
      employee_id=excluded.employee_id,score=excluded.score,reason=excluded.reason,
      status='draft',generated_at=excluded.generated_at,confirmed_at=null,
      confirmed_by=null,updated_at=excluded.updated_at
    where weekly_shift_assignment_suggestions.status<>'confirmed';
  end loop;

  return query
  select suggestion.* from public.weekly_shift_assignment_suggestions suggestion
  where suggestion.tenant_id=p_tenant_id and suggestion.location_id=p_location_id
    and suggestion.week_start=p_week_start and suggestion.status='draft'
  order by suggestion.generated_at,suggestion.shift_id;
end
$function$;

create function public.confirm_weekly_shift_assignment_suggestion(
  p_tenant_id uuid,
  p_location_id uuid,
  p_suggestion_id uuid,
  p_actor_id uuid
)
returns setof public.weekly_shift_assignment_suggestions
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor record;
  v_suggestion public.weekly_shift_assignment_suggestions%rowtype;
  v_shift public.shifts%rowtype;
begin
  select e.tenant_id,e.location_id,e.rolle::text as rolle into v_actor
  from public.employees e
  where e.id=p_actor_id and e.tenant_id=p_tenant_id
    and e.status::text in ('aktiv','in_training','in_probe');
  if not found or v_actor.rolle not in ('manager','backoffice','admin') then
    raise exception 'actor is not allowed to confirm schedule suggestions';
  end if;
  if v_actor.rolle='manager' and v_actor.location_id is distinct from p_location_id then
    raise exception 'actor is outside location';
  end if;

  select * into v_suggestion from public.weekly_shift_assignment_suggestions
  where id=p_suggestion_id and tenant_id=p_tenant_id and location_id=p_location_id
  for update;
  if not found then raise exception 'schedule suggestion not found'; end if;
  if v_suggestion.status<>'draft' then raise exception 'schedule suggestion is no longer open'; end if;

  select * into v_shift from public.shifts
  where id=v_suggestion.shift_id and tenant_id=p_tenant_id and location_id=p_location_id
  for update;
  if not found or v_shift.employee_id is not null
    or v_shift.status::text in ('abgesagt','storniert') then
    raise exception 'shift is no longer available for confirmation';
  end if;
  if not exists(
    select 1 from public.employees e
    where e.id=v_suggestion.employee_id and e.tenant_id=p_tenant_id
      and e.location_id=p_location_id and e.status::text='aktiv'
      and (
        v_shift.department_id is null or e.department_id=v_shift.department_id or exists(
          select 1 from public.department_responsibility_assignments responsibility
          where responsibility.tenant_id=p_tenant_id and responsibility.location_id=p_location_id
            and responsibility.department_id=v_shift.department_id
            and responsibility.employee_id=e.id and responsibility.aktiv
            and public.responsibility_assignment_active_at(
              responsibility.valid_from,responsibility.valid_until,responsibility.weekday_scope,
              responsibility.shift_start,responsibility.shift_end,v_shift.start_zeit
            )
        )
      )
  ) then raise exception 'suggested employee is no longer qualified'; end if;
  if exists(
    select 1 from public.availability_exceptions x
    where x.tenant_id=p_tenant_id and x.employee_id=v_suggestion.employee_id
      and x.datum=(v_shift.start_zeit at time zone 'Europe/Berlin')::date
      and x.typ='gesperrt'
  ) then raise exception 'suggested employee is no longer available'; end if;
  if exists(
    select 1 from public.shifts other
    where other.tenant_id=p_tenant_id and other.employee_id=v_suggestion.employee_id
      and other.id<>v_shift.id and other.status::text not in ('abgesagt','storniert')
      and tstzrange(other.start_zeit,other.end_zeit,'[)')
          && tstzrange(v_shift.start_zeit,v_shift.end_zeit,'[)')
  ) then raise exception 'suggested employee is now double-booked'; end if;

  perform set_config('app.audit_employee_id',p_actor_id::text,true);
  update public.shifts
  set employee_id=v_suggestion.employee_id,status='bestätigt'
  where id=v_shift.id;
  update public.weekly_shift_assignment_suggestions
  set status='confirmed',confirmed_at=now(),confirmed_by=p_actor_id,updated_at=now()
  where id=v_suggestion.id
  returning * into v_suggestion;

  insert into public.audit_log(
    tenant_id,employee_id,action,entity_type,entity_id,payload_before,payload_after
  ) values (
    p_tenant_id,p_actor_id,'weekly_shift_suggestion_confirmed','shifts',v_shift.id,
    jsonb_build_object('employee_id',null,'status',v_shift.status),
    jsonb_build_object('employee_id',v_suggestion.employee_id,'status','bestätigt','suggestion_id',v_suggestion.id)
  );

  return next v_suggestion;
end
$function$;

revoke all on table public.weekly_shift_assignment_suggestions from public,anon,authenticated;
grant select on table public.weekly_shift_assignment_suggestions to authenticated;
grant all on table public.weekly_shift_assignment_suggestions to service_role;
revoke all on function public.validate_weekly_shift_suggestion_scope() from public,anon,authenticated;
revoke all on function public.generate_weekly_shift_assignment_suggestions(uuid,uuid,date,uuid)
  from public,anon,authenticated;
grant execute on function public.generate_weekly_shift_assignment_suggestions(uuid,uuid,date,uuid)
  to service_role;
revoke all on function public.confirm_weekly_shift_assignment_suggestion(uuid,uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.confirm_weekly_shift_assignment_suggestion(uuid,uuid,uuid,uuid)
  to service_role;

commit;
