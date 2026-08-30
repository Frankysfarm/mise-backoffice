-- Close the final pre-deploy operational-task and schedule-assistant findings.
-- Historical imports remain inert once their shift ended more than 12 hours ago;
-- the grace window allows delayed same-day syncs without backfilling old work.

begin;

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
  v_participant:=coalesce(
    v_actor.id in (v_task.assigned_to,v_task.accountable_employee_id,v_task.controller_employee_id),
    false
  );
  if p_status in ('erledigt','nicht_bestanden','storniert') then
    if not v_manages and not coalesce(
      v_actor.id in (v_task.accountable_employee_id,v_task.controller_employee_id),
      false
    ) then
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

create or replace function public.unified_materialize_shift_tasks_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  -- Historical imports and corrections do not create stale operational work.
  -- Twelve hours covers delayed same-day syncs and matches template rematerialization.
  if new.end_zeit < now()-interval '12 hours' then
    return new;
  end if;

  perform public.materialize_shift_operational_tasks(new.id,null);
  return new;
end
$function$;

comment on function public.unified_materialize_shift_tasks_trigger() is
  'Materializes tasks only for shifts ending within the last 12 hours or later; older historical imports and updates stay inert.';

create or replace function public.confirm_weekly_shift_assignment_suggestion(
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

  -- Read the immutable scope needed for the shared first lock without holding a
  -- row lock. Generation takes this same week lock before any suggestion or
  -- shift row, preventing a suggestion -> shift / shift -> suggestion cycle.
  select * into v_suggestion from public.weekly_shift_assignment_suggestions
  where id=p_suggestion_id and tenant_id=p_tenant_id and location_id=p_location_id;
  if not found then raise exception 'schedule suggestion not found'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_tenant_id::text||':'||p_location_id::text||':'||v_suggestion.week_start::text,0
  ));

  -- Re-read and validate under the week lock in case generation changed the
  -- suggestion while confirmation waited for serialization.
  select * into v_suggestion from public.weekly_shift_assignment_suggestions
  where id=p_suggestion_id and tenant_id=p_tenant_id and location_id=p_location_id
  for update;
  if not found then raise exception 'schedule suggestion not found'; end if;
  if v_suggestion.status<>'draft' then raise exception 'schedule suggestion is no longer open'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'schedule-employee:'||p_tenant_id::text||':'||v_suggestion.employee_id::text,0
  ));

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
      and x.typ::text in (
        'gesperrt','nicht_verfuegbar','krank','urlaub','abwesend','unavailable','sick'
      )
  ) then raise exception 'suggested employee is no longer available'; end if;
  if exists(
    select 1 from public.employee_availability blocked
    where blocked.employee_id=v_suggestion.employee_id
      and blocked.weekday=extract(isodow from v_shift.start_zeit at time zone 'Europe/Berlin')::integer-1
      and blocked.typ='gesperrt'
      and blocked.start_time<(v_shift.end_zeit at time zone 'Europe/Berlin')::time
      and blocked.end_time>(v_shift.start_zeit at time zone 'Europe/Berlin')::time
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

revoke all on function public.update_operational_task_as_actor(uuid,uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.update_operational_task_as_actor(uuid,uuid,uuid,uuid,text,text)
  to service_role;
revoke all on function public.unified_materialize_shift_tasks_trigger()
  from public,anon,authenticated;
revoke all on function public.confirm_weekly_shift_assignment_suggestion(uuid,uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.confirm_weekly_shift_assignment_suggestion(uuid,uuid,uuid,uuid)
  to service_role;

commit;
