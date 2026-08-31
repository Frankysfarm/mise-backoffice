\set ON_ERROR_STOP on

begin;

do $test$
begin
  if public.recurring_template_due_at('{"kind":"monthly_day","day":31,"time":"09:00"}'::jsonb,'2026-09-30')
     is distinct from '2026-09-30 09:00 Europe/Berlin'::timestamptz then
    raise exception 'month-end recurrence did not clamp to the last day';
  end if;
  if public.recurring_template_due_at('{"kind":"weekdays","weekdays":[1,3,5],"time":"09:00"}'::jsonb,'2026-08-31') is null then
    raise exception 'Monday weekday recurrence was not selected';
  end if;
  if public.recurring_template_due_at('{"kind":"weekdays","weekdays":[1,3,5],"time":"09:00"}'::jsonb,'2026-09-01') is not null then
    raise exception 'Tuesday weekday recurrence was unexpectedly selected';
  end if;
  if public.recurring_template_due_at('{"kind":"interval","interval":2,"unit":"days","time":"09:00"}'::jsonb,'2026-09-02','2026-08-31 09:00 Europe/Berlin') is null
     or public.recurring_template_due_at('{"kind":"interval","interval":2,"unit":"days","time":"09:00"}'::jsonb,'2026-09-01','2026-08-31 09:00 Europe/Berlin') is not null then
    raise exception 'interval recurrence does not use the persisted anchor';
  end if;
  if has_function_privilege('authenticated','public.materialize_recurring_operational_tasks(uuid,uuid,timestamptz)','execute') then
    raise exception 'authenticated user can call privileged materializer';
  end if;
  if pg_get_functiondef('public.acknowledge_responsibility_handover(uuid,uuid,text)'::regprocedure) not like '%if p_action=''read'' then%'
     or pg_get_functiondef('public.acknowledge_responsibility_handover(uuid,uuid,text)'::regprocedure) not like '%handover must be read first%' then
    raise exception 'acknowledgement RPC does not preserve the read-before-confirm state machine';
  end if;
end
$test$;

do $escalation_insert_test$
declare
  v_tenant_id constant uuid := 'cc000000-0000-0000-0000-000000000001';
  v_location_id constant uuid := 'cc000000-0000-0000-0000-000000000002';
  v_employee_id constant uuid := 'cc000000-0000-0000-0000-000000000003';
  v_task_id constant uuid := 'cc000000-0000-0000-0000-000000000004';
  v_before bigint;
  v_after bigint;
begin
  insert into public.tenants(id) values (v_tenant_id);
  insert into public.locations(id,tenant_id) values (v_location_id,v_tenant_id);
  insert into public.employees(id,tenant_id,location_id,rolle,status)
    values (v_employee_id,v_tenant_id,v_location_id,'manager','aktiv');
  insert into public.operational_tasks(
    id,tenant_id,location_id,title,created_by,assigned_to,accountable_employee_id
  ) values (
    v_task_id,v_tenant_id,v_location_id,'C-C Eskalationstest',v_employee_id,v_employee_id,v_employee_id
  );
  select count(*) into v_before from public.notifications where employee_id=v_employee_id and link='/mitarbeiter#meine-aufgaben';
  update public.operational_tasks set assigned_to=v_employee_id,accountable_employee_id=v_employee_id,
    escalation_owner_employee_id=null,escalation_level=1,last_escalated_at=clock_timestamp() where id=v_task_id;
  select count(*) into v_after from public.notifications where employee_id=v_employee_id and link='/mitarbeiter#meine-aufgaben';
  if v_after<=v_before then raise exception 'escalation trigger did not insert an enum-typed notification'; end if;
end
$escalation_insert_test$;

rollback;
