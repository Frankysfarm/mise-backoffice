begin;

alter table public.operational_task_templates
  add column if not exists target_type text not null default 'employee',
  add column if not exists target_role text,
  add column if not exists recurrence_anchor timestamptz,
  add column if not exists paused_at timestamptz,
  add column if not exists deleted_at timestamptz;

do $constraints$
begin
  if not exists(select 1 from pg_constraint where conname='operational_task_templates_target_type_check') then
    alter table public.operational_task_templates add constraint operational_task_templates_target_type_check
      check(target_type in ('employee','role','department','shift','location'));
  end if;
end
$constraints$;

alter table public.responsibility_handovers
  add column if not exists open_task_ids uuid[] not null default '{}'::uuid[],
  add column if not exists incidents text,
  add column if not exists inventory_notes text,
  add column if not exists damage_notes text,
  add column if not exists cleaning_notes text,
  add column if not exists important_notes text,
  add column if not exists read_at timestamptz,
  add column if not exists read_by uuid references public.employees(id) on delete set null,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references public.employees(id) on delete set null;

alter table public.operational_tasks
  add column if not exists recurrence_due_at timestamptz;

create unique index if not exists operational_tasks_recurrence_uidx
  on public.operational_tasks(template_id,recurrence_due_at)
  where template_id is not null and recurrence_due_at is not null;
create index if not exists operational_templates_due_idx
  on public.operational_task_templates(tenant_id,location_id,aktiv,deleted_at,paused_at)
  where trigger_type='manual';
create index if not exists responsibility_handovers_audit_idx
  on public.responsibility_handovers(tenant_id,location_id,created_at desc);

create or replace function public.notify_operational_escalation_recipients()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_recipient uuid;
begin
  if new.last_escalated_at is null or new.last_escalated_at is not distinct from old.last_escalated_at then return new; end if;
  for v_recipient in
    select distinct employee_id from (
      select new.assigned_to as employee_id union all select new.accountable_employee_id union all
      select a.employee_id from public.department_responsibility_assignments a
      where a.tenant_id=new.tenant_id and a.location_id=new.location_id and a.department_id=new.department_id
        and a.responsibility_role='stellvertretung' and a.aktiv
    ) recipients where employee_id is not null
  loop
    insert into public.notifications(employee_id,typ,titel,nachricht,link)
    values(v_recipient,case when new.escalation_level>1 then 'dringend' else 'warnung' end,'Aufgabe überfällig',new.title,'/mitarbeiter#meine-aufgaben');
  end loop;
  return new;
end
$function$;

drop trigger if exists operational_tasks_escalation_notify on public.operational_tasks;
create trigger operational_tasks_escalation_notify after update of last_escalated_at on public.operational_tasks
for each row execute function public.notify_operational_escalation_recipients();

create or replace function public.save_recurring_operational_template(
  p_id uuid, p_tenant_id uuid, p_location_id uuid, p_actor_id uuid,
  p_title text, p_description text, p_department_id uuid, p_recurrence_rule jsonb,
  p_target_type text, p_target_employee_id uuid, p_target_role text,
  p_priority smallint, p_active boolean
)
returns setof public.operational_task_templates
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_id uuid; v_kind text;
begin
  if not exists(select 1 from public.employees where id=p_actor_id and tenant_id=p_tenant_id and location_id=p_location_id and rolle in ('manager','backoffice','admin') and status in ('aktiv','in_training','in_probe'))
    and not exists(select 1 from public.employees where id=p_actor_id and tenant_id=p_tenant_id and rolle in ('backoffice','admin') and status in ('aktiv','in_training','in_probe')) then raise exception 'forbidden'; end if;
  if p_department_id is not null and not exists(select 1 from public.departments where id=p_department_id and tenant_id=p_tenant_id and location_id=p_location_id) then raise exception 'department outside location'; end if;
  if p_target_employee_id is not null and not exists(select 1 from public.employees where id=p_target_employee_id and tenant_id=p_tenant_id and location_id=p_location_id) then raise exception 'employee outside location'; end if;
  v_kind:=p_recurrence_rule->>'kind';
  if v_kind not in ('daily','weekdays','weekly','monthly_day','monthly_weekday','shift','opening','closing','interval') then raise exception 'invalid recurrence'; end if;
  if p_target_type not in ('employee','role','department','shift','location') then raise exception 'invalid target'; end if;
  if p_id is not null and not exists(select 1 from public.operational_task_templates where id=p_id and tenant_id=p_tenant_id and location_id=p_location_id) then raise exception 'template outside location'; end if;
  insert into public.operational_task_templates(id,tenant_id,location_id,department_id,title,description,recurrence_rule,trigger_type,shift_phase,assignment_mode,assigned_employee_id,target_type,target_role,priority,aktiv,created_by,recurrence_anchor,paused_at,deleted_at)
  values(coalesce(p_id,gen_random_uuid()),p_tenant_id,p_location_id,p_department_id,p_title,nullif(p_description,''),p_recurrence_rule,
    case when v_kind in ('shift','opening','closing') then 'shift' else 'manual' end,
    case when v_kind='closing' then 'end' else 'start' end,
    case when p_target_type='employee' then 'fixed_employee' when p_target_type='department' then 'responsibility_primary' else 'shift_employee' end,
    p_target_employee_id,p_target_type,nullif(p_target_role,''),p_priority,p_active,p_actor_id,coalesce((p_recurrence_rule->>'anchor')::timestamptz,now()),case when p_active then null else now() end,null)
  on conflict(id) do update set department_id=excluded.department_id,title=excluded.title,description=excluded.description,
    recurrence_rule=excluded.recurrence_rule,trigger_type=excluded.trigger_type,shift_phase=excluded.shift_phase,
    assignment_mode=excluded.assignment_mode,assigned_employee_id=excluded.assigned_employee_id,target_type=excluded.target_type,
    target_role=excluded.target_role,priority=excluded.priority,aktiv=excluded.aktiv,paused_at=excluded.paused_at,deleted_at=null,updated_at=now()
  returning id into v_id;
  return query select * from public.operational_task_templates where id=v_id;
end
$function$;

create or replace function public.recurring_template_due_at(p_rule jsonb,p_day date)
returns timestamptz language plpgsql immutable set search_path=public,pg_temp
as $function$
declare v_time time:=coalesce((p_rule->>'time')::time,'09:00'); v_kind text:=p_rule->>'kind'; v_anchor date:=coalesce((p_rule->>'anchor')::date,p_day); v_match boolean:=false; v_target integer;
begin
  if v_kind='daily' then v_match:=true;
  elsif v_kind='weekdays' then v_match:=extract(isodow from p_day)::integer in (select jsonb_array_elements_text(coalesce(p_rule->'weekdays','[]'))::integer);
  elsif v_kind='weekly' then v_match:=extract(isodow from p_day)::integer=coalesce((p_rule->>'weekday')::integer,extract(isodow from v_anchor)::integer);
  elsif v_kind='monthly_day' then v_target:=least((p_rule->>'day')::integer,extract(day from (date_trunc('month',p_day)+interval '1 month - 1 day'))::integer); v_match:=extract(day from p_day)::integer=v_target;
  elsif v_kind='monthly_weekday' then v_match:=extract(isodow from p_day)::integer=(p_rule->>'weekday')::integer and ceil(extract(day from p_day)/7.0)::integer=(p_rule->>'ordinal')::integer;
  elsif v_kind='interval' then v_match:=(p_day-v_anchor)%((p_rule->>'interval')::integer*case when p_rule->>'unit'='weeks' then 7 else 1 end)=0;
  end if;
  if not v_match then return null; end if;
  return (p_day+v_time) at time zone 'Europe/Berlin';
end
$function$;

create or replace function public.materialize_recurring_operational_tasks(p_until timestamptz default now()+interval '14 days')
returns integer language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_template public.operational_task_templates%rowtype; v_day date; v_due timestamptz; v_assignee uuid; v_accountable uuid; v_creator uuid; v_rows integer; v_count integer:=0;
begin
  for v_template in select * from public.operational_task_templates where trigger_type='manual' and aktiv and paused_at is null and deleted_at is null loop
    for v_day in select generate_series((now() at time zone 'Europe/Berlin')::date,(p_until at time zone 'Europe/Berlin')::date,'1 day')::date loop
      v_due:=public.recurring_template_due_at(v_template.recurrence_rule,v_day); if v_due is null or v_due>p_until then continue; end if;
      v_assignee:=v_template.assigned_employee_id;
      if v_template.target_type='role' then select id into v_assignee from public.employees where tenant_id=v_template.tenant_id and location_id=v_template.location_id and rolle=v_template.target_role and status in ('aktiv','in_training','in_probe') order by id limit 1;
      elsif v_template.target_type='department' then select employee_id into v_assignee from public.department_responsibility_assignments where tenant_id=v_template.tenant_id and location_id=v_template.location_id and department_id=v_template.department_id and responsibility_role='hauptverantwortung' and aktiv order by valid_from desc limit 1;
      elsif v_template.target_type='location' then v_assignee:=v_template.accountable_employee_id;
      end if;
      v_accountable:=coalesce(v_template.accountable_employee_id,v_assignee,v_template.created_by); v_creator:=coalesce(v_template.created_by,v_accountable);
      if v_accountable is null or v_creator is null then continue; end if;
      insert into public.operational_tasks(tenant_id,location_id,department_id,template_id,title,description,priority,created_by,assigned_to,accountable_employee_id,controller_employee_id,due_at,recurrence_due_at,evidence_requirements,escalation_policy,source_type,source_id)
      values(v_template.tenant_id,v_template.location_id,v_template.department_id,v_template.id,v_template.title,v_template.description,v_template.priority,v_creator,v_assignee,v_accountable,coalesce(v_template.controller_employee_id,v_accountable),v_due,v_due,v_template.evidence_requirements,v_template.escalation_policy,'recurring_template',v_template.id::text||':'||v_due::text)
      on conflict(template_id,recurrence_due_at) where template_id is not null and recurrence_due_at is not null do nothing;
      get diagnostics v_rows=row_count; v_count:=v_count+v_rows;
    end loop;
  end loop;
  return v_count;
end
$function$;

create or replace function public.acknowledge_responsibility_handover(p_handover_id uuid,p_actor_id uuid,p_action text)
returns setof public.responsibility_handovers language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_row public.responsibility_handovers%rowtype;
begin
  select * into v_row from public.responsibility_handovers where id=p_handover_id for update;
  if not found or not exists(select 1 from public.employees where id=p_actor_id and tenant_id=v_row.tenant_id and status in ('aktiv','in_training','in_probe')) then raise exception 'forbidden'; end if;
  if p_actor_id<>v_row.to_employee_id and not exists(select 1 from public.employees where id=p_actor_id and tenant_id=v_row.tenant_id and (location_id=v_row.location_id or rolle in ('backoffice','admin')) and rolle in ('manager','backoffice','admin')) then raise exception 'forbidden'; end if;
  if p_action='read' and v_row.read_at is null then update public.responsibility_handovers set read_at=now(),read_by=p_actor_id,status='gelesen',updated_at=now() where id=p_handover_id;
  elsif p_action='confirm' then
    if v_row.read_at is null then raise exception 'handover must be read first'; end if;
    if v_row.confirmed_at is not null then raise exception 'handover already confirmed'; end if;
    update public.responsibility_handovers set confirmed_at=now(),confirmed_by=p_actor_id,accepted_at=now(),accepted_by=p_actor_id,status='angenommen',updated_at=now() where id=p_handover_id;
  else raise exception 'invalid handover action'; end if;
  return query select * from public.responsibility_handovers where id=p_handover_id;
end
$function$;

alter table public.responsibility_handovers drop constraint if exists responsibility_handovers_status_check;
alter table public.responsibility_handovers add constraint responsibility_handovers_status_check check(status in ('offen','gelesen','angenommen','abgeschlossen','storniert'));

revoke all on function public.save_recurring_operational_template(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,text,uuid,text,smallint,boolean) from public,anon;
grant execute on function public.save_recurring_operational_template(uuid,uuid,uuid,uuid,text,text,uuid,jsonb,text,uuid,text,smallint,boolean) to authenticated,service_role;
revoke all on function public.materialize_recurring_operational_tasks(timestamptz) from public,anon,authenticated;
grant execute on function public.materialize_recurring_operational_tasks(timestamptz) to service_role;
revoke all on function public.acknowledge_responsibility_handover(uuid,uuid,text) from public,anon;
grant execute on function public.acknowledge_responsibility_handover(uuid,uuid,text) to authenticated,service_role;

commit;
