\set ON_ERROR_STOP on

insert into public.operational_task_templates(
  id,tenant_id,location_id,department_id,title,description,task_kind,trigger_type,
  shift_phase,due_offset_minutes,assignment_mode,accountable_employee_id,
  controller_employee_id,evidence_requirements,priority,created_by,source_type,source_id
) values (
  '60000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001','Küchenabschluss','Reinigen und dokumentieren',
  'reinigung','shift','end',15,'shift_employee',
  '40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',
  '["foto","kommentar"]',90,'40000000-0000-0000-0000-000000000001','test','kitchen-close'
);

insert into public.departments(id,tenant_id,location_id,name)
values(
  '30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001','Backbereich'
);
insert into public.employees(id,tenant_id,location_id,rolle,status)
values(
  '40000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001','manager','aktiv'
);

insert into public.shifts(
  id,employee_id,department_id,location_id,start_zeit,end_zeit,status
) values (
  '70000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '2026-09-01 08:00:00+00','2026-09-01 16:00:00+00','geplant'
);

do $$
declare v_task public.operational_tasks%rowtype; v_count integer;
begin
  select * into strict v_task from public.operational_tasks
  where template_id='60000000-0000-0000-0000-000000000001'
    and shift_id='70000000-0000-0000-0000-000000000001';
  if v_task.assigned_to<>'40000000-0000-0000-0000-000000000002' then
    raise exception 'shift task was not assigned to scheduled employee';
  end if;
  if v_task.accountable_employee_id<>'40000000-0000-0000-0000-000000000001' then
    raise exception 'shift task accountability is wrong';
  end if;
  if v_task.due_at<>'2026-09-01 16:15:00+00'::timestamptz then
    raise exception 'shift task deadline is %, expected shift end +15',v_task.due_at;
  end if;
  select count(*) into v_count from public.operational_tasks
  where template_id=v_task.template_id and shift_id=v_task.shift_id;
  if v_count<>1 then raise exception 'shift template generated % tasks, expected one',v_count; end if;

  update public.shifts set employee_id='40000000-0000-0000-0000-000000000001'
  where id='70000000-0000-0000-0000-000000000001';
  select * into strict v_task from public.operational_tasks where id=v_task.id;
  if v_task.assigned_to<>'40000000-0000-0000-0000-000000000001' then
    raise exception 'open task did not follow shift reassignment';
  end if;

  update public.operational_tasks set status='in_arbeit' where id=v_task.id;
  update public.shifts set employee_id='40000000-0000-0000-0000-000000000002'
  where id='70000000-0000-0000-0000-000000000001';
  select * into strict v_task from public.operational_tasks where id=v_task.id;
  if v_task.assigned_to<>'40000000-0000-0000-0000-000000000001' then
    raise exception 'progressed task was silently reassigned';
  end if;
end $$;

insert into public.shifts(
  id,employee_id,department_id,location_id,start_zeit,end_zeit,status
) values (
  '70000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '2026-09-02 08:00:00+00','2026-09-02 16:00:00+00','geplant'
);
update public.operational_tasks
set status='angenommen',accepted_at='2026-08-30 08:00:00+00'
where shift_id='70000000-0000-0000-0000-000000000002';
update public.shifts set status='abgesagt' where id='70000000-0000-0000-0000-000000000002';

do $$
begin
  if not exists(
    select 1 from public.operational_tasks
    where shift_id='70000000-0000-0000-0000-000000000002' and status='storniert'
  ) then raise exception 'canceled shift did not cancel its open task'; end if;
  if exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='materialize_shift_operational_tasks'
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
  ) then raise exception 'authenticated can execute privileged materializer'; end if;
end $$;

-- Reviving a canceled shift also revives its task. Even when the assignee did
-- not change, the old acceptance must not carry into the new open lifecycle.
update public.shifts set status='geplant' where id='70000000-0000-0000-0000-000000000002';

do $$
begin
  if not exists(
    select 1 from public.operational_tasks
    where shift_id='70000000-0000-0000-0000-000000000002'
      and status='offen' and accepted_at is null
  ) then raise exception 'revived task retained stale acceptance'; end if;
end $$;

-- Removing an assignee must not leave an old open task on the employee app.
insert into public.shifts(
  id,employee_id,department_id,location_id,start_zeit,end_zeit,status
) values (
  '70000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '2026-09-03 08:00:00+00','2026-09-03 16:00:00+00','geplant'
);
update public.shifts set employee_id=null where id='70000000-0000-0000-0000-000000000003';

do $$
begin
  if not exists(
    select 1 from public.operational_tasks
    where shift_id='70000000-0000-0000-0000-000000000003' and status='storniert'
  ) then raise exception 'unassigned shift left an active task'; end if;
end $$;

insert into public.operational_task_templates(
  id,tenant_id,location_id,department_id,title,task_kind,trigger_type,shift_phase,
  due_offset_minutes,assignment_mode,evidence_requirements,priority,created_by,source_type,source_id
) values (
  '60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004',
  'Backabschluss','reinigung','shift','end',10,'shift_employee','[]',80,
  '40000000-0000-0000-0000-000000000001','test','bakery-close'
);
insert into public.shifts(
  id,employee_id,department_id,location_id,start_zeit,end_zeit,status
) values (
  '70000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '2026-09-04 08:00:00+00','2026-09-04 16:00:00+00','geplant'
);
update public.shifts set department_id='30000000-0000-0000-0000-000000000004'
where id='70000000-0000-0000-0000-000000000004';

do $$
begin
  if not exists(
    select 1 from public.operational_tasks
    where shift_id='70000000-0000-0000-0000-000000000004'
      and template_id='60000000-0000-0000-0000-000000000001' and status='storniert'
  ) then raise exception 'old department task stayed active'; end if;
  if not exists(
    select 1 from public.operational_tasks
    where shift_id='70000000-0000-0000-0000-000000000004'
      and template_id='60000000-0000-0000-0000-000000000002' and status='offen'
  ) then raise exception 'new department task was not created'; end if;
end $$;

-- Missing responsibility escalates visibly but still creates exactly one task.
insert into public.operational_task_templates(
  id,tenant_id,location_id,department_id,title,task_kind,trigger_type,shift_phase,
  due_offset_minutes,assignment_mode,evidence_requirements,priority,created_by,source_type,source_id
) values (
  '60000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004',
  'Verantwortungscheck','kontrolle','shift','start',5,'responsibility_primary','[]',90,
  '40000000-0000-0000-0000-000000000001','test','responsibility-fallback'
);

do $$
declare v_task public.operational_tasks%rowtype;
begin
  select * into strict v_task from public.operational_tasks
  where shift_id='70000000-0000-0000-0000-000000000004'
    and template_id='60000000-0000-0000-0000-000000000003';
  if v_task.assigned_to<>'40000000-0000-0000-0000-000000000002'
    or v_task.escalation_level<>1 or v_task.review_note is null then
    raise exception 'missing responsibility did not create an escalated fallback task';
  end if;
end $$;

-- Recruiting keeps its established two-step branch assignment and never
-- receives normal shift workflows.
insert into public.shifts(
  id,employee_id,department_id,location_id,start_zeit,end_zeit,status,typ
) values (
  '70000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '2026-09-05 08:00:00+00','2026-09-05 12:00:00+00','geplant','probe'
);

do $$
begin
  if exists(
    select 1 from public.operational_tasks where shift_id='70000000-0000-0000-0000-000000000005'
  ) then raise exception 'trial shift received operational tasks'; end if;
  begin
    insert into public.shifts(id,employee_id,department_id,location_id,start_zeit,end_zeit,status,typ)
    values(
      '70000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000003',
      '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
      '2026-09-06 08:00:00+00','2026-09-06 12:00:00+00','geplant','normal'
    );
    raise exception 'cross-location normal shift unexpectedly accepted';
  exception when others then
    if sqlerrm='cross-location normal shift unexpectedly accepted' then raise; end if;
    if position('shift employee is outside location' in sqlerrm)=0 then raise; end if;
  end;
end $$;

-- A template department change must retire bindings to the old department.
insert into public.shifts(
  id,employee_id,department_id,location_id,start_zeit,end_zeit,status
) values (
  '70000000-0000-0000-0000-000000000007','40000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '2026-09-07 08:00:00+00','2026-09-07 16:00:00+00','geplant'
);
update public.operational_task_templates
set department_id='30000000-0000-0000-0000-000000000004'
where id='60000000-0000-0000-0000-000000000001';

do $$
begin
  if not exists(
    select 1 from public.operational_tasks
    where shift_id='70000000-0000-0000-0000-000000000007'
      and template_id='60000000-0000-0000-0000-000000000001' and status='storniert'
  ) then raise exception 'template department change left an old task active'; end if;
end $$;

-- Service-role mutations preserve the actual employee in the audit trail.
set role service_role;
select * from public.save_shift_operational_template(
  '60000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000004',
  'Backabschluss geprüft','Sauber übergeben','reinigung','end',10,'shift_employee',
  null,null,null,'[]'::jsonb,80::smallint,true
);
select * from public.update_operational_task_as_actor(
  (select id from public.operational_tasks
    where shift_id='70000000-0000-0000-0000-000000000004'
      and template_id='60000000-0000-0000-0000-000000000003'),
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000002','angenommen',null
);
reset role;

do $$
begin
  if not exists(
    select 1 from public.audit_log
    where entity_type='operational_task_templates'
      and entity_id='60000000-0000-0000-0000-000000000002'
      and employee_id='40000000-0000-0000-0000-000000000004' and action='update'
  ) then raise exception 'template audit did not record acting manager'; end if;
  if not exists(
    select 1 from public.audit_log a
    join public.operational_tasks t on t.id=a.entity_id
    where a.entity_type='operational_tasks'
      and t.shift_id='70000000-0000-0000-0000-000000000004'
      and t.template_id='60000000-0000-0000-0000-000000000003'
      and a.employee_id='40000000-0000-0000-0000-000000000002'
      and a.payload_after->>'status'='angenommen'
  ) then raise exception 'task audit did not record acting employee'; end if;
end $$;

-- RLS: branch managers cannot read or mutate another branch's workflows/tasks;
-- normal employees do not receive the manager-only template catalogue.
insert into public.operational_task_templates(
  id,tenant_id,location_id,department_id,title,task_kind,trigger_type,shift_phase,
  due_offset_minutes,assignment_mode,evidence_requirements,priority,created_by,source_type,source_id
) values (
  '60000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002',
  'Fremde Filiale','kontrolle','shift','start',5,'shift_employee','[]',50,
  '40000000-0000-0000-0000-000000000003','test','foreign-location'
);
insert into public.operational_tasks(
  id,tenant_id,location_id,department_id,title,created_by,assigned_to,accountable_employee_id
) values(
  '80000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002',
  'Fremde Aufgabe','40000000-0000-0000-0000-000000000003',
  '40000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003'
);

create or replace function public.current_employee_id()
returns uuid language sql stable as $function$
  select nullif(current_setting('app.test_employee_id',true),'')::uuid
$function$;
create or replace function public.current_tenant_id()
returns uuid language sql stable as $function$
  select nullif(current_setting('app.test_tenant_id',true),'')::uuid
$function$;

select set_config('app.test_tenant_id','10000000-0000-0000-0000-000000000001',false);
select set_config('app.test_employee_id','40000000-0000-0000-0000-000000000001',false);
set role authenticated;
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.operational_task_templates
  where location_id='20000000-0000-0000-0000-000000000001';
  if v_count=0 then raise exception 'manager cannot read own-location templates'; end if;
  if exists(
    select 1 from public.operational_task_templates where id='60000000-0000-0000-0000-000000000004'
  ) then raise exception 'manager can read foreign-location template'; end if;
  if exists(
    select 1 from public.operational_tasks where id='80000000-0000-0000-0000-000000000004'
  ) then raise exception 'manager can read foreign-location task'; end if;
  update public.operational_task_templates set title='Nicht erlaubt'
  where id='60000000-0000-0000-0000-000000000004';
  get diagnostics v_count=row_count;
  if v_count<>0 then raise exception 'manager updated foreign-location template'; end if;
end $$;
reset role;

select set_config('app.test_employee_id','40000000-0000-0000-0000-000000000002',false);
set role authenticated;
do $$
begin
  if exists(select 1 from public.operational_task_templates) then
    raise exception 'employee can read manager workflow templates';
  end if;
end $$;
reset role;

select 'shift-linked operational task test passed' as result;
