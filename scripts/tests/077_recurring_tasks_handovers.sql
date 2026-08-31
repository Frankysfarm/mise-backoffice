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

rollback;
