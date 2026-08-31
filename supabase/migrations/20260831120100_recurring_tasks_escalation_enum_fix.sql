begin;

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
    ) recipients where employee_id is not null and employee_id is distinct from new.escalation_owner_employee_id
  loop
    insert into public.notifications(employee_id,typ,titel,nachricht,link)
    values(v_recipient,(case when new.escalation_level>1 then 'dringend' else 'warnung' end)::public.notification_type,'Aufgabe überfällig',new.title,'/mitarbeiter#meine-aufgaben');
  end loop;
  return new;
end
$function$;

create or replace function public.process_operational_escalations(
  p_now timestamptz default now(), p_interval interval default interval '4 hours'
)
returns integer language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_task public.operational_tasks%rowtype; v_level smallint; v_owner uuid; v_count integer:=0;
begin
  if p_interval < interval '15 minutes' or p_interval > interval '7 days' then raise exception 'escalation interval must be between 15 minutes and 7 days'; end if;
  for v_task in select t.* from public.operational_tasks t
    where t.due_at<p_now and t.status in ('offen','angenommen','in_arbeit','wartet_auf_pruefung','blockiert') and t.escalation_level<3
      and (t.last_escalated_at is null or t.last_escalated_at<=p_now-p_interval)
    order by t.due_at,t.id for update skip locked
  loop
    v_level:=least(v_task.escalation_level+1,3)::smallint;
    v_owner:=case when v_level>=2 then coalesce(v_task.controller_employee_id,v_task.accountable_employee_id) else v_task.accountable_employee_id end;
    update public.operational_tasks set escalation_level=v_level,escalation_owner_employee_id=v_owner,last_escalated_at=p_now,updated_at=p_now where id=v_task.id;
    insert into public.audit_log(tenant_id,employee_id,action,entity_type,entity_id,payload_before,payload_after)
    values(v_task.tenant_id,null,'operational_task_escalated','operational_tasks',v_task.id,
      jsonb_build_object('escalation_level',v_task.escalation_level,'escalation_owner_employee_id',v_task.escalation_owner_employee_id,'last_escalated_at',v_task.last_escalated_at),
      jsonb_build_object('escalation_level',v_level,'escalation_owner_employee_id',v_owner,'last_escalated_at',p_now,'interval_seconds',extract(epoch from p_interval)::bigint));
    if v_owner is not null then
      insert into public.notifications(employee_id,typ,titel,nachricht,link)
      values(v_owner,(case when v_level=1 then 'warnung' else 'dringend' end)::public.notification_type,
        case when v_level=1 then 'Überfällige Aufgabe: Verantwortung klären' else 'Überfällige Aufgabe: Kontrolle erforderlich' end,
        v_task.title,case when v_level=1 then '/mitarbeiter#verantwortung' else '/neo/app/mitarbeiter?tab=aufgaben' end);
    end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end
$function$;

create or replace function public.active_recurring_operational_scopes()
returns table(tenant_id uuid,location_id uuid)
language sql stable security definer set search_path=public,pg_temp
as $function$
  select distinct t.tenant_id,t.location_id from public.operational_task_templates t
  where t.trigger_type='manual' and t.aktiv and t.paused_at is null and t.deleted_at is null
$function$;
revoke all on function public.active_recurring_operational_scopes() from public,anon,authenticated;
grant execute on function public.active_recurring_operational_scopes() to service_role;

commit;
