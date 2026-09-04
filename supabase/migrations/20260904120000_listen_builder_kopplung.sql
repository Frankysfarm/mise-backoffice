-- Listen-Builder (Paket A, Owner-Review 03.09.):
-- Listen (shift_guides) lassen sich zusätzlich an eine Rolle (z. B. alle
-- Filialleiter) oder an konkrete Mitarbeiter koppeln. Direkt gekoppelte Listen
-- werden täglich als Pflichtaufgabe materialisiert und laufen durch dieselbe
-- Pipeline wie Schicht-Checklisten (Ausführen, Ampel, Eskalation, Prüfmodus):
-- source_type bleibt 'shift_guide', source_id = 'shift_guide:direkt:<liste>:<mitarbeiter>:<datum>'
-- (Position 3 = Listen-ID, identisch zum Schicht-Schema — Links und Reconcile bleiben gültig).

-- ---------------------------------------------------------------------------
-- 1. Kopplungsfelder
-- ---------------------------------------------------------------------------
alter table public.shift_guides
  add column if not exists assignment_kind text not null default 'schicht',
  add column if not exists assigned_role text;

do $constraints$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'shift_guides_assignment_kind_check'
  ) then
    alter table public.shift_guides
      add constraint shift_guides_assignment_kind_check
      check (assignment_kind in ('schicht','rolle','mitarbeiter'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'shift_guides_assigned_role_check'
  ) then
    alter table public.shift_guides
      add constraint shift_guides_assigned_role_check
      check (
        (assignment_kind = 'rolle') = (assigned_role is not null)
        and (assigned_role is null or assigned_role in
          ('mitarbeiter','teamleiter','manager','backoffice','admin','server','bartender','cook','dishwasher'))
      );
  end if;
end $constraints$;

create table if not exists public.shift_guide_assignees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  guide_id uuid not null references public.shift_guides(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (guide_id, employee_id)
);

create index if not exists shift_guide_assignees_employee_idx
  on public.shift_guide_assignees(tenant_id, employee_id);

alter table public.shift_guide_assignees enable row level security;
drop policy if exists shift_guide_assignees_read_scoped on public.shift_guide_assignees;
drop policy if exists shift_guide_assignees_manage_scoped on public.shift_guide_assignees;
create policy shift_guide_assignees_read_scoped on public.shift_guide_assignees
  for select to authenticated using (
    shift_guide_assignees.tenant_id = public.current_tenant_id()
  );
create policy shift_guide_assignees_manage_scoped on public.shift_guide_assignees
  for all to authenticated using (
    shift_guide_assignees.tenant_id = public.current_tenant_id()
    and exists (
      select 1 from public.shift_guides g
      where g.id = shift_guide_assignees.guide_id
        and g.tenant_id = shift_guide_assignees.tenant_id
        and public.can_manage_operational_location(g.tenant_id, g.location_id)
    )
  ) with check (
    shift_guide_assignees.tenant_id = public.current_tenant_id()
    and exists (
      select 1 from public.shift_guides g
      where g.id = shift_guide_assignees.guide_id
        and g.tenant_id = shift_guide_assignees.tenant_id
        and public.can_manage_operational_location(g.tenant_id, g.location_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Schicht-Reconcile darf direkt gekoppelte Aufgaben (ohne Schicht) nicht
--    stornieren: identische Funktion, Reconcile zusätzlich auf
--    t.shift_id is not null begrenzt.
-- ---------------------------------------------------------------------------
create or replace function public.materialize_shift_guide_tasks(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_shift record; v_guide record; v_due timestamptz; v_controller uuid; v_department uuid; v_kind text; v_count integer := 0;
begin
  -- Reconcile: Schicht abgesagt/gelöscht/umbesetzt oder Leitfaden deaktiviert ⇒ offene Pflichtaufgabe stornieren.
  -- source_id = 'shift_guide:<shift>:<guide>:<mitarbeiter>' (Unique-Index auf source_type/source_id erlaubt so eine Neuanlage nach Umbesetzung)
  begin
    update public.operational_tasks t
      set status = 'storniert',
          review_note = 'Automatisch storniert: Schicht geändert oder Ablauf deaktiviert.',
          source_id = t.source_id || ':storniert:' || t.id,
          updated_at = p_now
      where t.source_type = 'shift_guide' and t.status in ('offen','angenommen','in_arbeit')
        and t.source_id like 'shift_guide:%' and t.source_id not like '%:storniert:%'
        -- Direkt gekoppelte Listen haben keine Schicht und werden von
        -- materialize_direct_guide_tasks abgeglichen.
        and t.shift_id is not null
        and t.source_id not like 'shift_guide:direkt:%'
        and (
          not exists (select 1 from public.shifts s where s.id = t.shift_id)
          or exists (select 1 from public.shifts s where s.id = t.shift_id and (s.status::text in ('abgesagt','storniert') or s.employee_id is distinct from t.assigned_to))
          or not exists (select 1 from public.shift_guides g where g.id::text = split_part(t.source_id, ':', 3) and g.aktiv)
        );
  exception when others then
    raise notice 'materialize_shift_guide_tasks: reconcile übersprungen: %', sqlerrm;
  end;

  for v_shift in
    select s.* from public.shifts s
    where s.employee_id is not null and s.location_id is not null and s.tenant_id is not null
      and s.status::text not in ('abgesagt','abgeschlossen','storniert')
      and coalesce(s.typ::text, 'normal') <> 'probe'
      and s.start_zeit <= p_now + interval '3 hours'
      and s.end_zeit >= p_now - interval '1 hour'
      and s.start_zeit >= p_now - interval '16 hours'
  loop
    for v_guide in
      select g.* from public.shift_guides g
      where g.tenant_id = v_shift.tenant_id and g.location_id = v_shift.location_id and g.aktiv
        and coalesce(g.assignment_kind, 'schicht') = 'schicht'
        and (g.position_typ is null or lower(g.position_typ) = lower(coalesce(v_shift.position, '')))
        and (g.department_id is null or g.department_id = v_shift.department_id)
    loop
      v_kind := case
        when v_guide.ablauf_typ in ('opening','closing') then v_guide.ablauf_typ
        when v_guide.phase::text in ('opening','closing','midday') then v_guide.phase::text
        else 'midday' end;
      v_due := case v_kind
        when 'opening' then v_shift.start_zeit + interval '60 minutes'
        when 'closing' then v_shift.end_zeit
        else v_shift.start_zeit + (v_shift.end_zeit - v_shift.start_zeit) / 2
      end;
      if exists (select 1 from public.operational_tasks t where t.source_type = 'shift_guide' and t.source_id = 'shift_guide:' || v_shift.id || ':' || v_guide.id || ':' || v_shift.employee_id and t.status <> 'storniert') then
        update public.operational_tasks t set due_at = v_due, updated_at = p_now
          where t.source_type = 'shift_guide' and t.source_id = 'shift_guide:' || v_shift.id || ':' || v_guide.id || ':' || v_shift.employee_id
            and t.status in ('offen','angenommen','in_arbeit') and t.due_at is distinct from v_due;
        continue;
      end if;
      v_department := case
        when v_shift.department_id is not null and exists (select 1 from public.departments d where d.id = v_shift.department_id and d.location_id = v_shift.location_id) then v_shift.department_id
        else null end;
      v_controller := public.resolve_shift_guide_controller(v_shift.tenant_id, v_shift.location_id, v_department, v_shift.employee_id, v_due);
      begin
        insert into public.operational_tasks(
          tenant_id, location_id, department_id, shift_id, title, description, status, priority,
          created_by, assigned_to, accountable_employee_id, controller_employee_id,
          due_at, evidence_requirements, source_type, source_id, procedure_content
        ) values (
          v_shift.tenant_id, v_shift.location_id, v_department, v_shift.id, v_guide.titel,
          'Pflicht-Checkliste für deine Schicht am ' || to_char(v_shift.start_zeit at time zone 'Europe/Berlin', 'DD.MM.') || ' (' ||
            case v_kind when 'opening' then 'Öffnung' when 'closing' then 'Schließung' else 'Schichtmitte' end || ').',
          'offen', 80,
          v_shift.employee_id, v_shift.employee_id, coalesce(v_controller, v_shift.employee_id), v_controller,
          v_due, '[]'::jsonb, 'shift_guide', 'shift_guide:' || v_shift.id || ':' || v_guide.id || ':' || v_shift.employee_id, v_guide.inhalt
        );
        v_count := v_count + 1;
      exception when others then
        raise notice 'materialize_shift_guide_tasks: shift % guide % übersprungen: %', v_shift.id, v_guide.id, sqlerrm;
      end;
    end loop;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Direkt gekoppelte Listen (Rolle / Mitarbeiter) täglich materialisieren
-- ---------------------------------------------------------------------------
create or replace function public.materialize_direct_guide_tasks(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_guide record; v_employee record; v_due timestamptz; v_location uuid;
  v_controller uuid; v_date text; v_count integer := 0;
begin
  v_date := to_char(p_now at time zone 'Europe/Berlin', 'YYYY-MM-DD');
  v_due := ((p_now at time zone 'Europe/Berlin')::date::timestamp + interval '18 hours') at time zone 'Europe/Berlin';

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
    where g.aktiv and g.assignment_kind in ('rolle','mitarbeiter') and g.tenant_id is not null
  loop
    for v_employee in
      select e.* from public.employees e
      where e.tenant_id = v_guide.tenant_id
        and e.status in ('aktiv','in_training','in_probe')
        and (v_guide.location_id is null or e.location_id = v_guide.location_id)
        and (
          (v_guide.assignment_kind = 'rolle' and lower(e.rolle::text) = lower(coalesce(v_guide.assigned_role, '')))
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
            case v_guide.assignment_kind when 'rolle' then 'über deine Rolle' else 'persönlich' end ||
            ' zugewiesen und heute (' || to_char(p_now at time zone 'Europe/Berlin', 'DD.MM.') || ') fällig.',
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
