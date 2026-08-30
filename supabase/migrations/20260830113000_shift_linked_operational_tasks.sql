-- Shift-linked operational workflows.
-- Additive: one-off operational tasks remain valid and shift_id stays optional.

begin;

alter table public.operational_task_templates
  add column if not exists trigger_type text not null default 'manual',
  add column if not exists shift_phase text not null default 'start',
  add column if not exists due_offset_minutes integer not null default 30,
  add column if not exists assignment_mode text not null default 'shift_employee',
  add column if not exists assigned_employee_id uuid references public.employees(id) on delete set null,
  add column if not exists accountable_employee_id uuid references public.employees(id) on delete set null,
  add column if not exists controller_employee_id uuid references public.employees(id) on delete set null;

do $constraints$
begin
  if not exists(select 1 from pg_constraint where conname='operational_task_templates_trigger_type_check') then
    alter table public.operational_task_templates add constraint operational_task_templates_trigger_type_check
      check(trigger_type in ('manual','shift'));
  end if;
  if not exists(select 1 from pg_constraint where conname='operational_task_templates_shift_phase_check') then
    alter table public.operational_task_templates add constraint operational_task_templates_shift_phase_check
      check(shift_phase in ('start','end'));
  end if;
  if not exists(select 1 from pg_constraint where conname='operational_task_templates_due_offset_check') then
    alter table public.operational_task_templates add constraint operational_task_templates_due_offset_check
      check(due_offset_minutes between -720 and 1440);
  end if;
  if not exists(select 1 from pg_constraint where conname='operational_task_templates_assignment_mode_check') then
    alter table public.operational_task_templates add constraint operational_task_templates_assignment_mode_check
      check(assignment_mode in ('shift_employee','fixed_employee','responsibility_primary'));
  end if;
  if not exists(select 1 from pg_constraint where conname='operational_task_templates_fixed_employee_check') then
    alter table public.operational_task_templates add constraint operational_task_templates_fixed_employee_check
      check(assignment_mode<>'fixed_employee' or assigned_employee_id is not null);
  end if;
end
$constraints$;

alter table public.operational_tasks
  add column if not exists shift_id uuid references public.shifts(id) on delete set null;

create index if not exists operational_task_templates_shift_idx
  on public.operational_task_templates(tenant_id,location_id,department_id,trigger_type,aktiv)
  where trigger_type='shift' and aktiv;
create index if not exists operational_tasks_shift_idx
  on public.operational_tasks(tenant_id,location_id,shift_id,status)
  where shift_id is not null;

-- Shared branch scope for operational RLS. Company-wide roles retain their
-- tenant view, while every other role stays at its assigned location.
create or replace function public.can_access_operational_location(
  p_tenant_id uuid,
  p_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists(
    select 1 from public.employees e
    where e.id=public.current_employee_id()
      and e.tenant_id=p_tenant_id
      and e.status in ('aktiv','in_training','in_probe')
      and (e.rolle in ('backoffice','admin') or e.location_id=p_location_id)
  )
$function$;

-- Operating procedures are manager data. A branch manager stays scoped to the
-- assigned location; backoffice and administration retain the tenant view.
create or replace function public.can_manage_operational_location(
  p_tenant_id uuid,
  p_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists(
    select 1 from public.employees e
    where e.id=public.current_employee_id()
      and e.tenant_id=p_tenant_id
      and e.status in ('aktiv','in_training','in_probe')
      and e.rolle in ('manager','backoffice','admin')
      and public.can_access_operational_location(p_tenant_id,p_location_id)
  )
$function$;

drop policy if exists unified_template_read on public.operational_task_templates;
drop policy if exists unified_template_manage on public.operational_task_templates;
create policy unified_template_read on public.operational_task_templates
for select to authenticated using (
  tenant_id=public.current_tenant_id()
  and public.can_manage_operational_location(tenant_id,location_id)
);
create policy unified_template_manage on public.operational_task_templates
for all to authenticated using (
  tenant_id=public.current_tenant_id()
  and public.can_manage_operational_location(tenant_id,location_id)
) with check (
  tenant_id=public.current_tenant_id()
  and public.can_manage_operational_location(tenant_id,location_id)
);

create or replace function public.can_access_operational_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select exists(
    select 1
    from public.operational_tasks t
    join public.employees actor on actor.id=public.current_employee_id()
    where t.id=p_task_id
      and t.tenant_id=public.current_tenant_id()
      and actor.tenant_id=t.tenant_id
      and actor.status in ('aktiv','in_training','in_probe')
      and (
        (actor.rolle in ('manager','backoffice','admin')
          and public.can_manage_operational_location(t.tenant_id,t.location_id))
        or actor.id in (t.created_by,t.assigned_to,t.accountable_employee_id,t.controller_employee_id)
        or exists(
          select 1 from public.department_responsibility_assignments a
          where a.tenant_id=t.tenant_id and a.location_id=t.location_id
            and a.department_id=t.department_id and a.employee_id=actor.id and a.aktiv
        )
      )
  )
$function$;

drop policy if exists unified_task_insert on public.operational_tasks;
create policy unified_task_insert on public.operational_tasks
for insert to authenticated with check (
  tenant_id=public.current_tenant_id()
  and (
    public.can_manage_operational_location(tenant_id,location_id)
    or (
      created_by=public.current_employee_id()
      and public.can_access_operational_location(tenant_id,location_id)
    )
  )
);

drop policy if exists unified_org_read on public.organization_positions;
drop policy if exists unified_org_manage on public.organization_positions;
create policy unified_org_read on public.organization_positions
for select to authenticated using (
  tenant_id=public.current_tenant_id()
  and (location_id is null or public.can_access_operational_location(tenant_id,location_id))
);
create policy unified_org_manage on public.organization_positions
for all to authenticated using (
  tenant_id=public.current_tenant_id()
  and public.can_manage_operational_location(tenant_id,location_id)
) with check (
  tenant_id=public.current_tenant_id()
  and public.can_manage_operational_location(tenant_id,location_id)
);

drop policy if exists unified_position_assignment_read on public.organization_position_assignments;
drop policy if exists unified_position_assignment_manage on public.organization_position_assignments;
create policy unified_position_assignment_read on public.organization_position_assignments
for select to authenticated using (
  tenant_id=public.current_tenant_id()
  and exists(
    select 1 from public.organization_positions p where p.id=position_id
      and (p.location_id is null or public.can_access_operational_location(p.tenant_id,p.location_id))
  )
);
create policy unified_position_assignment_manage on public.organization_position_assignments
for all to authenticated using (
  tenant_id=public.current_tenant_id()
  and exists(
    select 1 from public.organization_positions p where p.id=position_id
      and public.can_manage_operational_location(p.tenant_id,p.location_id)
  )
) with check (
  tenant_id=public.current_tenant_id()
  and exists(
    select 1 from public.organization_positions p where p.id=position_id
      and public.can_manage_operational_location(p.tenant_id,p.location_id)
  )
);

drop policy if exists unified_responsibility_read on public.department_responsibility_assignments;
drop policy if exists unified_responsibility_manage on public.department_responsibility_assignments;
create policy unified_responsibility_read on public.department_responsibility_assignments
for select to authenticated using (
  tenant_id=public.current_tenant_id()
  and public.can_access_operational_location(tenant_id,location_id)
);
create policy unified_responsibility_manage on public.department_responsibility_assignments
for all to authenticated using (
  tenant_id=public.current_tenant_id()
  and public.can_manage_operational_location(tenant_id,location_id)
) with check (
  tenant_id=public.current_tenant_id()
  and public.can_manage_operational_location(tenant_id,location_id)
);

drop policy if exists unified_handover_read on public.responsibility_handovers;
drop policy if exists unified_handover_write on public.responsibility_handovers;
create policy unified_handover_read on public.responsibility_handovers
for select to authenticated using (
  tenant_id=public.current_tenant_id()
  and (
    public.can_manage_operational_location(tenant_id,location_id)
    or public.current_employee_id() in (from_employee_id,to_employee_id)
  )
);
create policy unified_handover_write on public.responsibility_handovers
for all to authenticated using (
  tenant_id=public.current_tenant_id()
  and (
    public.can_manage_operational_location(tenant_id,location_id)
    or public.current_employee_id() in (from_employee_id,to_employee_id)
  )
) with check (
  tenant_id=public.current_tenant_id()
  and (
    public.can_manage_operational_location(tenant_id,location_id)
    or from_employee_id=public.current_employee_id()
  )
);

-- Scheduling writers historically omit tenant_id and rely on authenticated
-- context. Service-role paths (for example trial shifts) have no JWT context,
-- so derive and validate the canonical scope from the referenced entities.
create or replace function public.unified_prepare_shift_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_tenant uuid;
  v_location uuid;
begin
  if new.location_id is null and new.employee_id is not null then
    select e.location_id into new.location_id from public.employees e where e.id=new.employee_id;
  end if;
  if new.location_id is null and new.department_id is not null then
    select d.location_id into new.location_id from public.departments d where d.id=new.department_id;
  end if;
  if new.tenant_id is null and new.location_id is not null then
    select l.tenant_id into new.tenant_id from public.locations l where l.id=new.location_id;
  end if;
  if new.tenant_id is null and new.employee_id is not null then
    select e.tenant_id into new.tenant_id from public.employees e where e.id=new.employee_id;
  end if;
  if new.tenant_id is null then raise exception 'shift tenant cannot be derived'; end if;

  if new.location_id is not null then
    select l.tenant_id into v_tenant from public.locations l where l.id=new.location_id;
    if v_tenant is distinct from new.tenant_id then raise exception 'shift location is outside tenant'; end if;
  end if;
  if new.employee_id is not null then
    select e.tenant_id,e.location_id into v_tenant,v_location from public.employees e where e.id=new.employee_id;
    if v_tenant is distinct from new.tenant_id then raise exception 'shift employee is outside tenant'; end if;
    if new.location_id is not null and v_location is distinct from new.location_id
      and coalesce(new.typ::text,'')<>'probe' then
      raise exception 'shift employee is outside location';
    end if;
  end if;
  if new.department_id is not null then
    select coalesce(d.tenant_id,l.tenant_id),d.location_id into v_tenant,v_location
    from public.departments d join public.locations l on l.id=d.location_id where d.id=new.department_id;
    if v_tenant is distinct from new.tenant_id then raise exception 'shift department is outside tenant'; end if;
    if new.location_id is not null and v_location is distinct from new.location_id then
      raise exception 'shift department is outside location';
    end if;
  end if;
  return new;
end
$function$;

update public.shifts s
set tenant_id=coalesce(
  (select l.tenant_id from public.locations l where l.id=s.location_id),
  (select e.tenant_id from public.employees e where e.id=s.employee_id)
)
where s.tenant_id is null;

drop trigger if exists shifts_scope_tenant_validate on public.shifts;
create trigger shifts_scope_tenant_validate
before insert or update of tenant_id,location_id,department_id,employee_id on public.shifts
for each row execute function public.unified_prepare_shift_scope();

-- Keep the shared scope trigger authoritative for the added references.
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
  v_shift_id uuid;
  v_location_tenant uuid;
  v_department_tenant uuid;
  v_department_location uuid;
  v_shift_tenant uuid;
  v_shift_location uuid;
  v_shift_department uuid;
  v_employee_id uuid;
begin
  v_location_id:=nullif(v_row->>'location_id','')::uuid;
  v_department_id:=coalesce(
    nullif(v_row->>'department_id','')::uuid,
    nullif(v_row->>'assigned_department_id','')::uuid
  );
  v_position_id:=nullif(v_row->>'position_id','')::uuid;
  v_task_id:=nullif(v_row->>'task_id','')::uuid;
  v_shift_id:=nullif(v_row->>'shift_id','')::uuid;

  if v_location_id is not null then
    select tenant_id into v_location_tenant from public.locations where id=v_location_id;
    if v_location_tenant is distinct from v_tenant_id then raise exception 'location is outside tenant'; end if;
  end if;
  if v_department_id is not null then
    select coalesce(d.tenant_id,l.tenant_id),d.location_id
      into v_department_tenant,v_department_location
    from public.departments d join public.locations l on l.id=d.location_id
    where d.id=v_department_id;
    if v_department_tenant is distinct from v_tenant_id then raise exception 'department is outside tenant'; end if;
    if v_location_id is not null and v_department_location is distinct from v_location_id then
      raise exception 'department is outside location';
    end if;
  end if;
  if v_position_id is not null and not exists(
    select 1 from public.organization_positions p where p.id=v_position_id and p.tenant_id=v_tenant_id
  ) then raise exception 'position is outside tenant'; end if;
  if v_task_id is not null and not exists(
    select 1 from public.operational_tasks t where t.id=v_task_id and t.tenant_id=v_tenant_id
  ) then raise exception 'task is outside tenant'; end if;
  if v_shift_id is not null then
    select s.tenant_id,s.location_id,s.department_id
      into v_shift_tenant,v_shift_location,v_shift_department
    from public.shifts s where s.id=v_shift_id;
    if v_shift_tenant is distinct from v_tenant_id then raise exception 'shift is outside tenant'; end if;
    if v_location_id is not null and v_shift_location is distinct from v_location_id then
      raise exception 'shift is outside location';
    end if;
    if v_department_id is not null and v_shift_department is distinct from v_department_id then
      raise exception 'shift is outside department';
    end if;
  end if;

  foreach v_employee_id in array array_remove(array[
    nullif(v_row->>'employee_id','')::uuid,
    nullif(v_row->>'assigned_employee_id','')::uuid,
    nullif(v_row->>'assigned_to','')::uuid,
    nullif(v_row->>'accountable_employee_id','')::uuid,
    nullif(v_row->>'controller_employee_id','')::uuid,
    nullif(v_row->>'delegated_from_employee_id','')::uuid,
    nullif(v_row->>'created_by','')::uuid,
    nullif(v_row->>'assigned_by','')::uuid,
    nullif(v_row->>'from_employee_id','')::uuid,
    nullif(v_row->>'to_employee_id','')::uuid,
    nullif(v_row->>'submitted_by','')::uuid,
    nullif(v_row->>'verified_by','')::uuid
  ]::uuid[],null) loop
    if not exists(select 1 from public.employees e where e.id=v_employee_id and e.tenant_id=v_tenant_id) then
      raise exception 'employee is outside tenant';
    end if;
  end loop;
  if v_location_id is not null then
    foreach v_employee_id in array array_remove(array[
      nullif(v_row->>'employee_id','')::uuid,
      nullif(v_row->>'assigned_employee_id','')::uuid,
      nullif(v_row->>'assigned_to','')::uuid,
      nullif(v_row->>'accountable_employee_id','')::uuid,
      nullif(v_row->>'controller_employee_id','')::uuid,
      nullif(v_row->>'delegated_from_employee_id','')::uuid,
      nullif(v_row->>'from_employee_id','')::uuid,
      nullif(v_row->>'to_employee_id','')::uuid
    ]::uuid[],null) loop
      if not exists(
        select 1 from public.employees e
        where e.id=v_employee_id and e.tenant_id=v_tenant_id and e.location_id=v_location_id
      ) then raise exception 'employee is outside location'; end if;
    end loop;
  end if;
  return new;
end
$function$;

create or replace function public.unified_audit_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_before jsonb;
  v_after jsonb;
  v_tenant uuid;
  v_entity uuid;
  v_actor uuid;
begin
  v_before:=case when tg_op='INSERT' then null else to_jsonb(old) end;
  v_after:=case when tg_op='DELETE' then null else to_jsonb(new) end;
  v_tenant:=coalesce((v_after->>'tenant_id')::uuid,(v_before->>'tenant_id')::uuid);
  begin v_entity:=coalesce((v_after->>'id')::uuid,(v_before->>'id')::uuid); exception when others then v_entity:=null; end;
  begin v_actor:=nullif(current_setting('app.audit_employee_id',true),'')::uuid; exception when others then v_actor:=null; end;
  v_actor:=coalesce(
    v_actor,public.current_employee_id(),nullif(v_after->>'reviewed_by','')::uuid,
    nullif(v_after->>'verified_by','')::uuid,nullif(v_after->>'submitted_by','')::uuid,
    nullif(v_after->>'accepted_by','')::uuid,nullif(v_after->>'created_by','')::uuid,
    nullif(v_after->>'assigned_by','')::uuid,nullif(v_after->>'from_employee_id','')::uuid,
    nullif(v_before->>'created_by','')::uuid
  );
  insert into public.audit_log(tenant_id,employee_id,action,entity_type,entity_id,payload_before,payload_after)
  values(v_tenant,v_actor,lower(tg_op),tg_table_name,v_entity,v_before,v_after);
  return coalesce(new,old);
end
$function$;

create or replace function public.materialize_shift_operational_tasks(
  p_shift_id uuid,
  p_template_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_shift public.shifts%rowtype;
  v_template public.operational_task_templates%rowtype;
  v_assignee uuid;
  v_responsible uuid;
  v_accountable uuid;
  v_controller uuid;
  v_creator uuid;
  v_due_at timestamptz;
  v_fallback_note text;
  v_escalation_level smallint;
  v_rows integer;
  v_count integer:=0;
begin
  select * into v_shift from public.shifts where id=p_shift_id;
  if not found then raise exception 'shift not found'; end if;

  if coalesce(v_shift.typ::text,'')='probe' then
    update public.operational_tasks
    set status='storniert',review_note='Automatisch storniert: Probeschichten erzeugen keine Betriebsaufgaben.',updated_at=now()
    where shift_id=v_shift.id and source_type='shift_template'
      and status in ('offen','angenommen');
    get diagnostics v_count=row_count;
    return v_count;
  end if;

  if v_shift.status::text in ('abgesagt','storniert') then
    update public.operational_tasks
    set status='storniert',review_note='Automatisch storniert: Schicht wurde abgesagt.',updated_at=now()
    where shift_id=v_shift.id and source_type='shift_template'
      and status in ('offen','angenommen');
    get diagnostics v_count=row_count;
    return v_count;
  end if;
  if v_shift.employee_id is null or v_shift.location_id is null or v_shift.tenant_id is null then return 0; end if;

  for v_template in
    select t.* from public.operational_task_templates t
    where t.tenant_id=v_shift.tenant_id and t.location_id=v_shift.location_id
      and t.trigger_type='shift' and t.aktiv
      and (p_template_id is null or t.id=p_template_id)
      and (t.department_id is null or t.department_id=v_shift.department_id)
    order by t.priority desc,t.created_at,t.id
  loop
    v_responsible:=null;
    if coalesce(v_template.department_id,v_shift.department_id) is not null then
      select a.employee_id into v_responsible
      from public.department_responsibility_assignments a
      where a.tenant_id=v_shift.tenant_id
        and a.location_id=v_shift.location_id
        and a.department_id=coalesce(v_template.department_id,v_shift.department_id)
        and a.responsibility_role='hauptverantwortung' and a.aktiv
        and public.responsibility_assignment_active_at(
          a.valid_from,a.valid_until,a.weekday_scope,a.shift_start,a.shift_end,v_shift.start_zeit
        )
      order by a.valid_from desc,a.created_at desc limit 1;
    end if;

    v_assignee:=case v_template.assignment_mode
      when 'fixed_employee' then v_template.assigned_employee_id
      when 'responsibility_primary' then coalesce(v_responsible,v_shift.employee_id)
      else v_shift.employee_id end;
    v_accountable:=coalesce(v_template.accountable_employee_id,v_responsible,v_assignee);
    v_controller:=coalesce(v_template.controller_employee_id,v_accountable);
    v_creator:=coalesce(v_template.created_by,v_accountable,v_assignee);
    if v_assignee is null or v_accountable is null or v_creator is null then continue; end if;
    v_fallback_note:=case
      when v_template.assignment_mode='responsibility_primary' and v_responsible is null
      then 'Automatisch an die diensthabende Person gegeben: Für den Bereich fehlt eine zeitlich passende Hauptverantwortung.'
      else null end;
    v_escalation_level:=case when v_fallback_note is null then 0 else 1 end;

    v_due_at:=(case when v_template.shift_phase='end' then v_shift.end_zeit else v_shift.start_zeit end)
      + make_interval(mins=>v_template.due_offset_minutes);

    insert into public.operational_tasks(
      tenant_id,location_id,department_id,template_id,shift_id,title,description,status,priority,
      created_by,assigned_to,accountable_employee_id,controller_employee_id,
      delegated_from_employee_id,due_at,evidence_requirements,escalation_policy,
      escalation_level,review_note,source_type,source_id
    ) values(
      v_shift.tenant_id,v_shift.location_id,coalesce(v_template.department_id,v_shift.department_id),
      v_template.id,v_shift.id,v_template.title,v_template.description,'offen',v_template.priority,
      v_creator,v_assignee,v_accountable,v_controller,
      case when v_assignee is distinct from v_accountable then v_accountable end,
      v_due_at,v_template.evidence_requirements,v_template.escalation_policy,v_escalation_level,v_fallback_note,
      'shift_template',v_template.id::text||':'||v_shift.id::text
    )
    on conflict(tenant_id,source_type,source_id)
      where source_type is not null and source_id is not null
    do update set
      shift_id=excluded.shift_id,
      template_id=excluded.template_id,
      department_id=case when operational_tasks.status in ('offen','angenommen','storniert') then excluded.department_id else operational_tasks.department_id end,
      title=case when operational_tasks.status in ('offen','angenommen','storniert') then excluded.title else operational_tasks.title end,
      description=case when operational_tasks.status in ('offen','angenommen','storniert') then excluded.description else operational_tasks.description end,
      priority=case when operational_tasks.status in ('offen','angenommen','storniert') then excluded.priority else operational_tasks.priority end,
      assigned_to=case when operational_tasks.status in ('offen','angenommen','storniert') then excluded.assigned_to else operational_tasks.assigned_to end,
      accountable_employee_id=case when operational_tasks.status in ('offen','angenommen','storniert') then excluded.accountable_employee_id else operational_tasks.accountable_employee_id end,
      controller_employee_id=case when operational_tasks.status in ('offen','angenommen','storniert') then excluded.controller_employee_id else operational_tasks.controller_employee_id end,
      delegated_from_employee_id=case when operational_tasks.status in ('offen','angenommen','storniert') then excluded.delegated_from_employee_id else operational_tasks.delegated_from_employee_id end,
      due_at=case when operational_tasks.status in ('offen','angenommen','storniert') then excluded.due_at else operational_tasks.due_at end,
      evidence_requirements=case when operational_tasks.status in ('offen','angenommen','storniert') then excluded.evidence_requirements else operational_tasks.evidence_requirements end,
      escalation_policy=case when operational_tasks.status in ('offen','angenommen','storniert') then excluded.escalation_policy else operational_tasks.escalation_policy end,
      escalation_level=case when operational_tasks.status in ('offen','angenommen','storniert') then excluded.escalation_level else operational_tasks.escalation_level end,
      status=case
        when operational_tasks.status='storniert' then 'offen'
        when operational_tasks.status='angenommen' and operational_tasks.assigned_to is distinct from excluded.assigned_to then 'offen'
        else operational_tasks.status end,
      accepted_at=case
        when operational_tasks.status='storniert' then null
        when operational_tasks.status='angenommen' and operational_tasks.assigned_to is distinct from excluded.assigned_to then null
        else operational_tasks.accepted_at end,
      review_note=case when operational_tasks.status in ('offen','angenommen','storniert') then excluded.review_note else operational_tasks.review_note end,
      updated_at=now();
    get diagnostics v_rows=row_count;
    v_count:=v_count+v_rows;
  end loop;
  return v_count;
end
$function$;

create or replace function public.unified_materialize_shift_tasks_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.materialize_shift_operational_tasks(new.id,null);
  return new;
end
$function$;

create or replace function public.unified_retire_changed_shift_tasks_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.employee_id is null
    or new.tenant_id is distinct from old.tenant_id
    or new.location_id is distinct from old.location_id
    or new.department_id is distinct from old.department_id
    or coalesce(new.typ::text,'')='probe' then
    update public.operational_tasks
    set status='storniert',review_note='Automatisch storniert: Die Schichtzuordnung wurde geändert.',updated_at=now()
    where shift_id=old.id and source_type='shift_template'
      and status in ('offen','angenommen');
  end if;
  return new;
end
$function$;

create or replace function public.unified_cancel_deleted_shift_tasks_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  update public.operational_tasks
  set status='storniert',review_note='Automatisch storniert: Schicht wurde entfernt.',updated_at=now()
  where shift_id=old.id and source_type='shift_template'
    and status in ('offen','angenommen');
  return old;
end
$function$;

create or replace function public.unified_materialize_template_tasks_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_shift_id uuid;
begin
  -- Remove open bindings that no longer match after deactivation, location or
  -- department changes. Work already in progress remains with its audit trail.
  update public.operational_tasks t
  set status='storniert',
      review_note=case when not new.aktiv or new.trigger_type<>'shift'
        then 'Automatisch storniert: Schichtablauf wurde deaktiviert.'
        else 'Automatisch storniert: Der Schichtablauf passt nicht mehr zur Schicht.' end,
      updated_at=now()
  where t.template_id=new.id and t.source_type='shift_template'
    and t.status in ('offen','angenommen')
    and (
      not new.aktiv or new.trigger_type<>'shift'
      or not exists(
        select 1 from public.shifts s
        where s.id=t.shift_id
          and s.tenant_id=new.tenant_id
          and s.location_id=new.location_id
          and s.employee_id is not null
          and coalesce(s.typ::text,'')<>'probe'
          and (new.department_id is null or s.department_id=new.department_id)
          and s.status::text not in ('abgesagt','storniert')
      )
    );
  if not new.aktiv or new.trigger_type<>'shift' then return new; end if;
  for v_shift_id in
    select s.id from public.shifts s
    where s.tenant_id=new.tenant_id and s.location_id=new.location_id
      and s.employee_id is not null
      and coalesce(s.typ::text,'')<>'probe'
      and (new.department_id is null or s.department_id=new.department_id)
      and s.end_zeit>=now()-interval '12 hours'
      and s.start_zeit<now()+interval '60 days'
      and s.status::text not in ('abgesagt','storniert')
  loop
    perform public.materialize_shift_operational_tasks(v_shift_id,new.id);
  end loop;
  return new;
end
$function$;

-- Service routes use the service role, so the acting employee must be carried
-- into the same database transaction for a correct, tamper-resistant audit.
create or replace function public.save_shift_operational_template(
  p_id uuid,
  p_tenant_id uuid,
  p_location_id uuid,
  p_department_id uuid,
  p_actor_id uuid,
  p_title text,
  p_description text,
  p_task_kind text,
  p_shift_phase text,
  p_due_offset_minutes integer,
  p_assignment_mode text,
  p_assigned_employee_id uuid,
  p_accountable_employee_id uuid,
  p_controller_employee_id uuid,
  p_evidence_requirements jsonb,
  p_priority smallint,
  p_active boolean
)
returns setof public.operational_task_templates
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_template public.operational_task_templates%rowtype;
  v_employee_id uuid;
begin
  select * into v_actor from public.employees where id=p_actor_id and tenant_id=p_tenant_id;
  if not found or v_actor.status not in ('aktiv','in_training','in_probe')
    or v_actor.rolle not in ('manager','backoffice','admin') then
    raise exception 'actor may not manage shift workflows';
  end if;
  if v_actor.rolle='manager' and v_actor.location_id is distinct from p_location_id then
    raise exception 'manager is outside location';
  end if;
  if not exists(
    select 1 from public.locations l where l.id=p_location_id and l.tenant_id=p_tenant_id
  ) or not exists(
    select 1 from public.departments d
    where d.id=p_department_id and d.tenant_id=p_tenant_id and d.location_id=p_location_id
  ) then raise exception 'workflow scope is invalid'; end if;
  if p_assignment_mode not in ('shift_employee','fixed_employee','responsibility_primary')
    or p_shift_phase not in ('start','end')
    or p_due_offset_minutes not between -720 and 1440
    or p_priority not between 0 and 100 then
    raise exception 'workflow settings are invalid';
  end if;
  if p_assignment_mode='fixed_employee' and p_assigned_employee_id is null then
    raise exception 'fixed workflow requires an employee';
  end if;
  foreach v_employee_id in array array_remove(array[
    p_assigned_employee_id,p_accountable_employee_id,p_controller_employee_id
  ]::uuid[],null) loop
    if not exists(
      select 1 from public.employees e where e.id=v_employee_id
        and e.tenant_id=p_tenant_id and e.location_id=p_location_id
        and e.status in ('aktiv','in_training','in_probe')
    ) then raise exception 'workflow employee is outside location'; end if;
  end loop;

  perform set_config('app.audit_employee_id',p_actor_id::text,true);
  if p_id is null then
    insert into public.operational_task_templates(
      tenant_id,location_id,department_id,title,description,task_kind,trigger_type,
      shift_phase,due_offset_minutes,assignment_mode,assigned_employee_id,
      accountable_employee_id,controller_employee_id,evidence_requirements,
      control_required,priority,aktiv,created_by
    ) values(
      p_tenant_id,p_location_id,p_department_id,p_title,nullif(p_description,''),p_task_kind,'shift',
      p_shift_phase,p_due_offset_minutes,p_assignment_mode,p_assigned_employee_id,
      p_accountable_employee_id,p_controller_employee_id,coalesce(p_evidence_requirements,'[]'::jsonb),
      true,p_priority,p_active,p_actor_id
    ) returning * into v_template;
  else
    update public.operational_task_templates set
      department_id=p_department_id,title=p_title,description=nullif(p_description,''),task_kind=p_task_kind,
      shift_phase=p_shift_phase,due_offset_minutes=p_due_offset_minutes,assignment_mode=p_assignment_mode,
      assigned_employee_id=p_assigned_employee_id,accountable_employee_id=p_accountable_employee_id,
      controller_employee_id=p_controller_employee_id,evidence_requirements=coalesce(p_evidence_requirements,'[]'::jsonb),
      control_required=true,priority=p_priority,aktiv=p_active
    where id=p_id and tenant_id=p_tenant_id and location_id=p_location_id and trigger_type='shift'
    returning * into v_template;
    if not found then raise exception 'shift workflow not found'; end if;
  end if;
  return next v_template;
end
$function$;

create or replace function public.update_operational_task_as_actor(
  p_task_id uuid,
  p_tenant_id uuid,
  p_location_id uuid,
  p_actor_id uuid,
  p_status text,
  p_review_note text default null
)
returns setof public.operational_tasks
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_task public.operational_tasks%rowtype;
  v_manages boolean;
  v_participant boolean;
begin
  if p_status not in ('angenommen','in_arbeit','wartet_auf_pruefung','erledigt','nicht_bestanden','blockiert','storniert') then
    raise exception 'invalid task status';
  end if;
  select * into v_actor from public.employees where id=p_actor_id and tenant_id=p_tenant_id;
  if not found or v_actor.status not in ('aktiv','in_training','in_probe') then raise exception 'actor not found'; end if;
  select * into v_task from public.operational_tasks
  where id=p_task_id and tenant_id=p_tenant_id and location_id=p_location_id for update;
  if not found then raise exception 'task not found'; end if;
  if v_task.status in ('erledigt','nicht_bestanden','storniert') then raise exception 'task is already closed'; end if;

  v_manages:=v_actor.rolle in ('backoffice','admin')
    or (v_actor.rolle='manager' and v_actor.location_id=p_location_id);
  v_participant:=v_actor.id in (v_task.assigned_to,v_task.accountable_employee_id,v_task.controller_employee_id);
  if p_status in ('erledigt','nicht_bestanden','storniert') then
    if not v_manages and v_actor.id not in (v_task.accountable_employee_id,v_task.controller_employee_id) then
      raise exception 'actor may not review or close task';
    end if;
  elsif not v_manages and not v_participant then
    raise exception 'actor may not update task';
  end if;

  if p_status='wartet_auf_pruefung' and exists(
    select 1 from jsonb_array_elements_text(coalesce(v_task.evidence_requirements,'[]'::jsonb)) required(value)
    where not exists(
      select 1 from public.operational_task_evidence e
      where e.task_id=v_task.id and e.tenant_id=v_task.tenant_id and e.evidence_type=required.value
    )
  ) then raise exception 'required evidence is missing'; end if;

  perform set_config('app.audit_employee_id',p_actor_id::text,true);
  update public.operational_tasks set
    status=p_status,
    accepted_at=case when p_status='angenommen' then now() else accepted_at end,
    started_at=case when p_status='in_arbeit' then now() else started_at end,
    reviewed_by=case when p_status in ('erledigt','nicht_bestanden') then p_actor_id else reviewed_by end,
    reviewed_at=case when p_status in ('erledigt','nicht_bestanden') then now() else reviewed_at end,
    review_note=case when p_status in ('erledigt','nicht_bestanden','storniert') then nullif(p_review_note,'') else review_note end
  where id=v_task.id returning * into v_task;

  if p_status in ('erledigt','nicht_bestanden') then
    update public.operational_task_evidence set
      verification_status=case when p_status='erledigt' then 'akzeptiert' else 'abgelehnt' end,
      verified_by=p_actor_id,verified_at=now(),verification_note=nullif(p_review_note,'')
    where task_id=v_task.id and verification_status='offen';
  end if;
  return next v_task;
end
$function$;

drop trigger if exists shifts_operational_tasks_materialize on public.shifts;
create trigger shifts_operational_tasks_materialize
after insert or update of employee_id,department_id,location_id,start_zeit,end_zeit,status,typ on public.shifts
for each row execute function public.unified_materialize_shift_tasks_trigger();

drop trigger if exists shifts_operational_tasks_retire_change on public.shifts;
create trigger shifts_operational_tasks_retire_change
before update of employee_id,department_id,location_id,tenant_id,typ on public.shifts
for each row execute function public.unified_retire_changed_shift_tasks_trigger();

drop trigger if exists shifts_operational_tasks_cancel_delete on public.shifts;
create trigger shifts_operational_tasks_cancel_delete
before delete on public.shifts
for each row execute function public.unified_cancel_deleted_shift_tasks_trigger();

drop trigger if exists task_templates_materialize_shifts on public.operational_task_templates;
create trigger task_templates_materialize_shifts
after insert or update of trigger_type,shift_phase,due_offset_minutes,assignment_mode,
  assigned_employee_id,accountable_employee_id,controller_employee_id,department_id,title,
  description,evidence_requirements,escalation_policy,priority,aktiv
on public.operational_task_templates
for each row execute function public.unified_materialize_template_tasks_trigger();

revoke all on function public.materialize_shift_operational_tasks(uuid,uuid) from public,anon,authenticated;
grant execute on function public.materialize_shift_operational_tasks(uuid,uuid) to service_role;
revoke all on function public.unified_materialize_shift_tasks_trigger() from public,anon,authenticated;
revoke all on function public.unified_retire_changed_shift_tasks_trigger() from public,anon,authenticated;
revoke all on function public.unified_cancel_deleted_shift_tasks_trigger() from public,anon,authenticated;
revoke all on function public.unified_materialize_template_tasks_trigger() from public,anon,authenticated;
revoke all on function public.unified_prepare_shift_scope() from public,anon;
revoke all on function public.unified_audit_change() from public,anon;
revoke all on function public.can_access_operational_location(uuid,uuid) from public,anon;
grant execute on function public.can_access_operational_location(uuid,uuid) to authenticated,service_role;
revoke all on function public.can_manage_operational_location(uuid,uuid) from public,anon;
grant execute on function public.can_manage_operational_location(uuid,uuid) to authenticated,service_role;
revoke all on function public.can_access_operational_task(uuid) from public,anon;
grant execute on function public.can_access_operational_task(uuid) to authenticated,service_role;
revoke all on function public.save_shift_operational_template(
  uuid,uuid,uuid,uuid,uuid,text,text,text,text,integer,text,uuid,uuid,uuid,jsonb,smallint,boolean
) from public,anon,authenticated;
grant execute on function public.save_shift_operational_template(
  uuid,uuid,uuid,uuid,uuid,text,text,text,text,integer,text,uuid,uuid,uuid,jsonb,smallint,boolean
) to service_role;
revoke all on function public.update_operational_task_as_actor(uuid,uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.update_operational_task_as_actor(uuid,uuid,uuid,uuid,text,text)
  to service_role;

commit;
