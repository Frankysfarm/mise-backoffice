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
declare v_task_id uuid; v_employee_id uuid; v_before bigint; v_after bigint;
begin
  select t.id,e.id into v_task_id,v_employee_id
  from public.operational_tasks t
  join public.employees e on e.tenant_id=t.tenant_id and e.location_id=t.location_id
  where e.status in ('aktiv','in_training','in_probe')
  order by t.created_at desc limit 1;
  if v_task_id is null then raise exception 'fixture missing: operational task and employee required'; end if;
  select count(*) into v_before from public.notifications where employee_id=v_employee_id and link='/mitarbeiter#meine-aufgaben';
  update public.operational_tasks set assigned_to=v_employee_id,accountable_employee_id=v_employee_id,
    escalation_owner_employee_id=null,escalation_level=1,last_escalated_at=clock_timestamp() where id=v_task_id;
  select count(*) into v_after from public.notifications where employee_id=v_employee_id and link='/mitarbeiter#meine-aufgaben';
  if v_after<=v_before then raise exception 'escalation trigger did not insert an enum-typed notification'; end if;
end
$escalation_insert_test$;

rollback;
