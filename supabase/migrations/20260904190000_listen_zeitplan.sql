-- Listen-Builder v2 (Owner-Auftrag 04.09. abends):
-- Direkt zugewiesene Listen bekommen einen Zeitplan (Wochentage + Uhrzeit) und
-- eine vierte Zuweisungsart 'bereich' (Gruppe = alle aktiven Mitarbeiter eines
-- Bereichs). Bestehende Rolle/Mitarbeiter-Listen behalten ihr Verhalten
-- (täglich, 18:00), weil beide neuen Felder NULL-Defaults haben.

alter table public.shift_guides
  add column if not exists schedule_weekdays smallint[],
  add column if not exists due_time time,
  add column if not exists assigned_department_id uuid references public.departments(id) on delete set null;

alter table public.shift_guides drop constraint if exists shift_guides_assignment_kind_check;
alter table public.shift_guides drop constraint if exists shift_guides_assigned_role_check;
alter table public.shift_guides drop constraint if exists shift_guides_assigned_department_check;
alter table public.shift_guides drop constraint if exists shift_guides_schedule_weekdays_check;
alter table public.shift_guides
  add constraint shift_guides_assignment_kind_check
    check (assignment_kind in ('schicht','rolle','mitarbeiter','bereich')),
  add constraint shift_guides_assigned_role_check
    check (
      (assignment_kind = 'rolle') = (assigned_role is not null)
      and (assigned_role is null or assigned_role in
        ('mitarbeiter','teamleiter','manager','backoffice','admin','server','bartender','cook','dishwasher'))
    ),
  add constraint shift_guides_assigned_department_check
    check ((assignment_kind = 'bereich') = (assigned_department_id is not null)),
  add constraint shift_guides_schedule_weekdays_check
    check (
      schedule_weekdays is null
      or (array_length(schedule_weekdays, 1) between 1 and 7
        and schedule_weekdays <@ array[1,2,3,4,5,6,7]::smallint[])
    );

create or replace function public.materialize_direct_guide_tasks(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_guide record; v_employee record; v_due timestamptz; v_location uuid;
  v_controller uuid; v_date text; v_dow smallint; v_count integer := 0;
begin
  v_date := to_char(p_now at time zone 'Europe/Berlin', 'YYYY-MM-DD');
  v_dow := extract(isodow from (p_now at time zone 'Europe/Berlin'))::smallint;

  -- Reconcile: Liste deaktiviert/umgestellt oder Zuordnung entfallen ⇒ offene Aufgabe stornieren.
  begin
    update public.operational_tasks t
      set status = 'storniert',
          review_note = 'Automatisch storniert: Listen-Zuordnung geändert oder Liste deaktiviert.',
          source_id = t.source_id || ':storniert:' || t.id,
          updated_at = p_now
      where t.source_type = 'shift_guide' and t.status in ('offen','angenommen','in_arbeit')
        and t.source_id like 'shift_guide:direkt:%' and t.source_id not like '%:storniert:%'
        and not exists (
          select 1 from public.shift_guides g
          where g.id::text = split_part(t.source_id, ':', 3) and g.aktiv
            and (
              (g.assignment_kind = 'rolle' and exists (
                select 1 from public.employees e
                where e.id = t.assigned_to and e.tenant_id = g.tenant_id
                  and e.status in ('aktiv','in_training','in_probe')
                  and lower(e.rolle::text) = lower(coalesce(g.assigned_role, ''))
                  and (g.location_id is null or e.location_id = g.location_id)
              ))
              or (g.assignment_kind = 'bereich' and exists (
                select 1 from public.employees e
                where e.id = t.assigned_to and e.tenant_id = g.tenant_id
                  and e.status in ('aktiv','in_training','in_probe')
                  and e.department_id = g.assigned_department_id
                  and (g.location_id is null or e.location_id = g.location_id)
              ))
              or (g.assignment_kind = 'mitarbeiter' and exists (
                select 1 from public.shift_guide_assignees a
                join public.employees e on e.id = a.employee_id
                where a.guide_id = g.id and a.employee_id = t.assigned_to
                  and e.status in ('aktiv','in_training','in_probe')
                  and (g.location_id is null or e.location_id = g.location_id)
              ))
            )
        );
  exception when others then
    raise notice 'materialize_direct_guide_tasks: reconcile übersprungen: %', sqlerrm;
  end;

  for v_guide in
    select g.* from public.shift_guides g
    where g.aktiv and g.assignment_kind in ('rolle','mitarbeiter','bereich') and g.tenant_id is not null
      and (g.schedule_weekdays is null or v_dow = any(g.schedule_weekdays))
  loop
    v_due := ((p_now at time zone 'Europe/Berlin')::date::timestamp
      + coalesce(v_guide.due_time, time '18:00')) at time zone 'Europe/Berlin';
    for v_employee in
      select e.* from public.employees e
      where e.tenant_id = v_guide.tenant_id
        and e.status in ('aktiv','in_training','in_probe')
        and (v_guide.location_id is null or e.location_id = v_guide.location_id)
        and (
          (v_guide.assignment_kind = 'rolle' and lower(e.rolle::text) = lower(coalesce(v_guide.assigned_role, '')))
          or (v_guide.assignment_kind = 'bereich' and e.department_id = v_guide.assigned_department_id)
          or (v_guide.assignment_kind = 'mitarbeiter' and exists (
            select 1 from public.shift_guide_assignees a
            where a.guide_id = v_guide.id and a.employee_id = e.id
          ))
        )
    loop
      v_location := coalesce(v_guide.location_id, v_employee.location_id);
      if v_location is null then continue; end if;
      if exists (
        select 1 from public.operational_tasks t
        where t.source_type = 'shift_guide'
          and t.source_id = 'shift_guide:direkt:' || v_guide.id || ':' || v_employee.id || ':' || v_date
          and t.status <> 'storniert'
      ) then continue; end if;
      v_controller := public.resolve_shift_guide_controller(
        v_guide.tenant_id, v_location,
        case when v_guide.location_id is not null then v_guide.department_id else null end,
        v_employee.id, v_due);
      begin
        insert into public.operational_tasks(
          tenant_id, location_id, department_id, shift_id, title, description, status, priority,
          created_by, assigned_to, accountable_employee_id, controller_employee_id,
          due_at, evidence_requirements, source_type, source_id, procedure_content
        ) values (
          v_guide.tenant_id, v_location,
          case when v_guide.location_id is not null then v_guide.department_id else null end,
          null, v_guide.titel,
          'Diese Liste ist dir ' ||
            case v_guide.assignment_kind
              when 'rolle' then 'über deine Rolle'
              when 'bereich' then 'über deinen Bereich'
              else 'persönlich' end ||
            ' zugewiesen und heute (' || to_char(p_now at time zone 'Europe/Berlin', 'DD.MM.') ||
            ') bis ' || to_char(v_due at time zone 'Europe/Berlin', 'HH24:MI') || ' Uhr fällig.',
          'offen', 80,
          v_employee.id, v_employee.id, coalesce(v_controller, v_employee.id), v_controller,
          v_due, '[]'::jsonb, 'shift_guide',
          'shift_guide:direkt:' || v_guide.id || ':' || v_employee.id || ':' || v_date, v_guide.inhalt
        );
        v_count := v_count + 1;
      exception when others then
        raise notice 'materialize_direct_guide_tasks: guide % employee % übersprungen: %', v_guide.id, v_employee.id, sqlerrm;
      end;
    end loop;
  end loop;
  return v_count;
end $$;

revoke all on function public.materialize_direct_guide_tasks(timestamptz) from public, anon, authenticated;
grant execute on function public.materialize_direct_guide_tasks(timestamptz) to service_role;
