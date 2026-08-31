\set ON_ERROR_STOP on

-- Escalation is incremental, interval-bound, capped, recipient-specific and
-- audited on every state change.
insert into public.operational_tasks(
  id,tenant_id,location_id,department_id,title,status,priority,created_by,
  assigned_to,accountable_employee_id,controller_employee_id,due_at
) values (
  '81000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001','Überfällige Öffnung','offen',90,
  '40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000004',
  '2026-09-07 06:00:00+00'
);

select public.process_operational_escalations('2026-09-07 08:00:00+00',interval '4 hours');
select public.process_operational_escalations('2026-09-07 10:00:00+00',interval '4 hours');

do $$
declare v_task public.operational_tasks%rowtype;
begin
  select * into strict v_task from public.operational_tasks
  where id='81000000-0000-0000-0000-000000000001';
  if v_task.escalation_level<>1 then
    raise exception 'escalation ignored its configured interval';
  end if;
  if v_task.escalation_owner_employee_id<>'40000000-0000-0000-0000-000000000001' then
    raise exception 'level one escalation did not record accountable owner';
  end if;
end $$;

select public.process_operational_escalations('2026-09-07 12:00:00+00',interval '4 hours');
select public.process_operational_escalations('2026-09-07 16:00:00+00',interval '4 hours');
select public.process_operational_escalations('2026-09-07 20:00:00+00',interval '4 hours');

do $$
declare v_task public.operational_tasks%rowtype; v_audits integer;
begin
  select * into strict v_task from public.operational_tasks
  where id='81000000-0000-0000-0000-000000000001';
  if v_task.escalation_level<>3 then raise exception 'escalation was not capped at level three'; end if;
  if v_task.escalation_owner_employee_id<>'40000000-0000-0000-0000-000000000004' then
    raise exception 'level two escalation did not record controller';
  end if;
  select count(*) into v_audits from public.audit_log
  where entity_id=v_task.id and action='operational_task_escalated';
  if v_audits<>3 then raise exception 'escalation audit count is %, expected three',v_audits; end if;
  if (select count(*) from public.notifications where employee_id='40000000-0000-0000-0000-000000000004')<>2 then
    raise exception 'controller escalation notifications are not idempotent';
  end if;
  if exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='process_operational_escalations'
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
  ) then raise exception 'authenticated can execute escalation sweep'; end if;
end $$;

insert into public.departments(
  id,tenant_id,location_id,name,hauptverantwortung_erforderlich,stellvertretung_erforderlich
) values (
  '30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001','Unbesetzter Testbereich',true,false
);
insert into public.shifts(
  id,employee_id,department_id,location_id,start_zeit,end_zeit,status,position
) values
  ('82000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002',
   '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
   '2026-09-07 05:00:00+00','2026-09-07 13:00:00+00','bestätigt','Service'),
  ('82000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002',
   '30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
   '2026-09-06 20:00:00+00','2026-09-07 00:00:00+00','bestätigt','Nachtdienst');
insert into public.availability_exceptions(tenant_id,employee_id,datum,typ,grund)
values(
  '10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002',
  '2026-09-07','gesperrt','Privater Testgrund darf nicht im Briefing stehen'
);
insert into public.operational_tasks(
  id,tenant_id,location_id,department_id,title,status,priority,created_by,due_at
) values (
  '81000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000005','Erst später fällig','offen',50,
  '40000000-0000-0000-0000-000000000001','2026-09-30 08:00:00+00'
);

select public.materialize_operational_daily_briefings(
  '2026-09-07','2026-09-07 08:00:00+00'
);
select public.materialize_operational_daily_briefings(
  '2026-09-07','2026-09-07 08:05:00+00'
);

do $$
declare v_briefing public.operational_daily_briefings%rowtype;
begin
  select * into strict v_briefing from public.operational_daily_briefings
  where tenant_id='10000000-0000-0000-0000-000000000001'
    and location_id='20000000-0000-0000-0000-000000000001'
    and briefing_date='2026-09-07';
  if (select count(*) from public.operational_daily_briefings
      where tenant_id=v_briefing.tenant_id and location_id=v_briefing.location_id
        and briefing_date=v_briefing.briefing_date)<>1 then
    raise exception 'briefing upsert created duplicates';
  end if;
  if jsonb_array_length(v_briefing.shifts)<1 then raise exception 'briefing omitted today shifts'; end if;
  if not v_briefing.shifts @> '[{"id":"82000000-0000-0000-0000-000000000002"}]'::jsonb then
    raise exception 'briefing omitted shift overlapping Berlin midnight';
  end if;
  if jsonb_array_length(v_briefing.task_counts)<1 then raise exception 'briefing omitted task counts'; end if;
  if v_briefing.task_counts @> '[{"department_id":"30000000-0000-0000-0000-000000000005"}]'::jsonb then
    raise exception 'briefing counted a future task as due today';
  end if;
  if jsonb_array_length(v_briefing.coverage_gaps)<1 then raise exception 'briefing omitted coverage gaps'; end if;
  if jsonb_array_length(v_briefing.absences)<>1 then raise exception 'briefing omitted absence'; end if;
  if v_briefing.absences::text like '%Privater Testgrund%' then raise exception 'briefing exposed private absence reason'; end if;
  if jsonb_array_length(v_briefing.escalated_tasks)<1 then raise exception 'briefing omitted escalated tasks'; end if;
  if v_briefing.generated_at<>'2026-09-07 08:05:00+00'::timestamptz then
    raise exception 'briefing was not refreshed idempotently';
  end if;
  if exists(
    select 1 from public.audit_log
    where entity_type='operational_daily_briefings' and action='update'
  ) then raise exception 'briefing refresh flooded the audit log'; end if;
  if exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='materialize_operational_daily_briefings'
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
  ) then raise exception 'authenticated can materialize daily briefings'; end if;
end $$;

select set_config('app.test_tenant_id','10000000-0000-0000-0000-000000000001',false);
select set_config('app.test_employee_id','40000000-0000-0000-0000-000000000001',false);
set role authenticated;
do $$
begin
  if not exists(
    select 1 from public.operational_daily_briefings
    where location_id='20000000-0000-0000-0000-000000000001'
  ) then raise exception 'manager cannot read own-location briefing'; end if;
  if exists(
    select 1 from public.operational_daily_briefings
    where location_id='20000000-0000-0000-0000-000000000002'
  ) then raise exception 'manager can read foreign-location briefing'; end if;
end $$;
reset role;

-- Weekly assistant: availability and department qualification are respected,
-- overlaps are excluded, and lower assigned hours win the fairness tie.
insert into public.employees(
  id,tenant_id,location_id,department_id,vorname,nachname,rolle,status
) values
  ('40000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004',
   'Ada','Früh','mitarbeiter','aktiv'),
  ('40000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004',
   'Berta','Spät','mitarbeiter','aktiv'),
  ('40000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000005',
   'Cora','Fremdbereich','mitarbeiter','aktiv'),
  ('40000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004',
   'Dora','Gesperrt','mitarbeiter','aktiv');
insert into public.employee_availability(employee_id,weekday,start_time,end_time,typ) values
  ('40000000-0000-0000-0000-000000000006',0,'08:00','16:00','verfügbar'),
  ('40000000-0000-0000-0000-000000000007',0,'08:00','16:00','verfügbar'),
  ('40000000-0000-0000-0000-000000000008',0,'08:00','16:00','bevorzugt'),
  ('40000000-0000-0000-0000-000000000009',0,'08:00','16:00','bevorzugt'),
  ('40000000-0000-0000-0000-000000000009',0,'08:00','16:00','gesperrt');

insert into public.shifts(
  id,employee_id,department_id,location_id,start_zeit,end_zeit,status,position
) values
  ('83000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000006',
   '30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001',
   '2026-09-14 06:00:00+00','2026-09-14 08:00:00+00','bestätigt','Vorbereitung'),
  ('83000000-0000-0000-0000-000000000002',null,
   '30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001',
   '2026-09-14 06:00:00+00','2026-09-14 10:00:00+00','geplant','Frühdienst'),
  ('83000000-0000-0000-0000-000000000003',null,
   '30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001',
   '2026-09-14 10:00:00+00','2026-09-14 14:00:00+00','geplant','Spätdienst');

select * from public.generate_weekly_shift_assignment_suggestions(
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '2026-09-14','40000000-0000-0000-0000-000000000001'
);
select * from public.generate_weekly_shift_assignment_suggestions(
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '2026-09-14','40000000-0000-0000-0000-000000000001'
);

-- Generation and confirmation must take the shared week lock before either
-- suggestion or shift row locks, removing their former inverse lock order.
do $$
declare
  v_generate text;
  v_confirm text;
begin
  select lower(pg_get_functiondef(
    'public.generate_weekly_shift_assignment_suggestions_core(uuid,uuid,date,uuid)'::regprocedure
  )) into strict v_generate;
  select lower(pg_get_functiondef(
    'public.confirm_weekly_shift_assignment_suggestion(uuid,uuid,uuid,uuid)'::regprocedure
  )) into strict v_confirm;

  if position('pg_advisory_xact_lock' in v_generate)=0
    or position('pg_advisory_xact_lock' in v_generate)>position('for update skip locked' in v_generate) then
    raise exception 'generation does not acquire the week lock before row locks';
  end if;
  if position('v_suggestion.week_start::text' in v_confirm)=0
    or position('pg_advisory_xact_lock' in v_confirm)>position('for update;' in v_confirm) then
    raise exception 'confirmation does not acquire the matching week lock before row locks';
  end if;
end $$;

do $$
begin
  if (select count(*) from public.weekly_shift_assignment_suggestions
      where week_start='2026-09-14' and status='draft')<>2 then
    raise exception 'weekly suggestion generation is not idempotent';
  end if;
  if not exists(
    select 1 from public.weekly_shift_assignment_suggestions
    where shift_id='83000000-0000-0000-0000-000000000002'
      and employee_id='40000000-0000-0000-0000-000000000007'
  ) then raise exception 'assistant double-booked the early employee'; end if;
  if not exists(
    select 1 from public.weekly_shift_assignment_suggestions
    where shift_id='83000000-0000-0000-0000-000000000003'
      and employee_id='40000000-0000-0000-0000-000000000006'
  ) then raise exception 'assistant did not balance assigned weekly hours'; end if;
  if exists(
    select 1 from public.weekly_shift_assignment_suggestions
    where employee_id='40000000-0000-0000-0000-000000000008'
  ) then raise exception 'assistant ignored department qualification'; end if;
  if exists(
    select 1 from public.weekly_shift_assignment_suggestions
    where employee_id='40000000-0000-0000-0000-000000000009'
  ) then raise exception 'assistant ignored an overlapping availability block'; end if;
  if exists(
    select 1 from public.weekly_shift_assignment_suggestions
    where reason not like '%Verfügbarkeit%' or reason not like '%Bereichsqualifikation%'
  ) then raise exception 'suggestion reason is not owner-friendly or explainable'; end if;
end $$;

insert into public.employee_availability(employee_id,weekday,start_time,end_time,typ)
values('40000000-0000-0000-0000-000000000007',0,'08:00','09:00','gesperrt');
do $$
begin
  begin
    perform public.confirm_weekly_shift_assignment_suggestion(
      '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
      (select id from public.weekly_shift_assignment_suggestions
       where shift_id='83000000-0000-0000-0000-000000000002'),
      '40000000-0000-0000-0000-000000000001'
    );
    raise exception 'confirmation ignored a new availability block';
  exception when others then
    if sqlerrm='confirmation ignored a new availability block' then raise; end if;
    if position('no longer available' in sqlerrm)=0 then raise; end if;
  end;
end $$;
delete from public.employee_availability
where employee_id='40000000-0000-0000-0000-000000000007' and typ='gesperrt';

select * from public.confirm_weekly_shift_assignment_suggestion(
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  (select id from public.weekly_shift_assignment_suggestions
   where shift_id='83000000-0000-0000-0000-000000000002'),
  '40000000-0000-0000-0000-000000000001'
);

do $$
declare v_suggestion_id uuid;
begin
  if not exists(
    select 1 from public.shifts
    where id='83000000-0000-0000-0000-000000000002'
      and employee_id='40000000-0000-0000-0000-000000000007' and status='bestätigt'
  ) then raise exception 'manager confirmation did not assign normal shift'; end if;
  if not exists(
    select 1 from public.operational_tasks
    where shift_id='83000000-0000-0000-0000-000000000002' and source_type='shift_template'
  ) then raise exception 'confirmed suggestion did not close the shift-task loop'; end if;
  if not exists(
    select 1 from public.audit_log
    where entity_id='83000000-0000-0000-0000-000000000002'
      and action='weekly_shift_suggestion_confirmed'
      and employee_id='40000000-0000-0000-0000-000000000001'
  ) then raise exception 'schedule confirmation audit is missing'; end if;
  select id into strict v_suggestion_id from public.weekly_shift_assignment_suggestions
  where shift_id='83000000-0000-0000-0000-000000000002';
  begin
    perform public.confirm_weekly_shift_assignment_suggestion(
      '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
      v_suggestion_id,'40000000-0000-0000-0000-000000000001'
    );
    raise exception 'confirmed shift was silently overwritten';
  exception when others then
    if sqlerrm='confirmed shift was silently overwritten' then raise; end if;
    if position('no longer open' in sqlerrm)=0 then raise; end if;
  end;
  if exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'generate_weekly_shift_assignment_suggestions',
      'confirm_weekly_shift_assignment_suggestion'
    ) and has_function_privilege('authenticated',p.oid,'EXECUTE')
  ) then raise exception 'authenticated can execute schedule assistant RPC'; end if;
end $$;

update public.shifts
set employee_id=null,status='geplant'
where id='83000000-0000-0000-0000-000000000002';
select * from public.generate_weekly_shift_assignment_suggestions(
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '2026-09-14','40000000-0000-0000-0000-000000000001'
);
do $$
begin
  if not exists(
    select 1 from public.weekly_shift_assignment_suggestions
    where shift_id='83000000-0000-0000-0000-000000000002' and status='draft'
  ) then raise exception 'cleared confirmed shift could not receive a new suggestion'; end if;
end $$;

-- Publishing and a subsequent edit must both commit. This guards the
-- notification enum, non-null outbox HTML and the shared shifts trigger.
update public.employees set email='published-shift@example.test'
where id=(select employee_id from public.shifts where id='83000000-0000-0000-0000-000000000001');
insert into public.schedule_weeks(
  tenant_id,location_id,week_start,availability_deadline,status,created_by
) values (
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '2026-09-14','2026-09-13 12:00:00+00','draft','40000000-0000-0000-0000-000000000001'
) on conflict(tenant_id,location_id,week_start) do update set status='draft',published_at=null,published_by=null;
select public.publish_schedule_week(
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001','2026-09-14'
);
update public.shifts set end_zeit=end_zeit+interval '15 minutes'
where id='83000000-0000-0000-0000-000000000001';
do $$
begin
  if not exists(select 1 from public.schedule_weeks where tenant_id='10000000-0000-0000-0000-000000000001' and location_id='20000000-0000-0000-0000-000000000001' and week_start='2026-09-14' and status='published') then
    raise exception 'schedule publication did not commit';
  end if;
  if not exists(select 1 from public.email_outbox where to_email='published-shift@example.test' and template='schedule_published' and html='') then
    raise exception 'schedule publication mail was not queued with valid html';
  end if;
  if not exists(select 1 from public.schedule_publication_changes where shift_id='83000000-0000-0000-0000-000000000001' and change_type='time_changed') then
    raise exception 'published shift edit did not record a change';
  end if;
end $$;

select 'daily clarity automation test passed' as result;
