begin;

create table if not exists public.schedule_templates (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade, name text not null check(length(name) between 2 and 120),
  description text, aktiv boolean not null default true, created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.schedule_template_slots (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  template_id uuid not null references public.schedule_templates(id) on delete cascade,
  weekday smallint not null check(weekday between 0 and 6), name text not null, department_id uuid references public.departments(id) on delete restrict,
  position text, start_time time not null, end_time time not null, pause_minutes integer not null default 0 check(pause_minutes between 0 and 240),
  headcount integer not null default 1 check(headcount between 1 and 50), sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.shifts add column if not exists schedule_template_instance_key text;
create unique index if not exists shifts_schedule_template_instance_uidx on public.shifts(tenant_id,location_id,schedule_template_instance_key) where schedule_template_instance_key is not null;

create table if not exists public.schedule_weeks (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade, week_start date not null check(extract(isodow from week_start)=1),
  availability_deadline timestamptz, status text not null default 'draft' check(status in ('draft','published')),
  published_at timestamptz, published_by uuid references public.employees(id) on delete set null,
  created_by uuid references public.employees(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(tenant_id,location_id,week_start)
);
create table if not exists public.shift_availability_responses (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade, schedule_week_id uuid not null references public.schedule_weeks(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade, employee_id uuid not null references public.employees(id) on delete cascade,
  state text not null check(state in ('kann','moechte','kann_nicht')), applied boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(shift_id,employee_id)
);
create table if not exists public.schedule_publication_changes (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade, schedule_week_id uuid not null references public.schedule_weeks(id) on delete cascade,
  shift_id uuid references public.shifts(id) on delete set null, employee_id uuid references public.employees(id) on delete set null,
  change_type text not null check(change_type in ('published','assignment_changed','time_changed','cancelled')),
  summary text not null, changed_by uuid references public.employees(id) on delete set null, changed_at timestamptz not null default now()
);
create index if not exists schedule_changes_employee_idx on public.schedule_publication_changes(tenant_id,employee_id,changed_at desc);

alter table public.schedule_templates enable row level security; alter table public.schedule_template_slots enable row level security;
alter table public.schedule_weeks enable row level security; alter table public.shift_availability_responses enable row level security;
alter table public.schedule_publication_changes enable row level security;
drop policy if exists schedule_templates_service on public.schedule_templates;
drop policy if exists schedule_template_slots_service on public.schedule_template_slots;
drop policy if exists schedule_weeks_service on public.schedule_weeks;
drop policy if exists shift_availability_service on public.shift_availability_responses;
drop policy if exists schedule_changes_service on public.schedule_publication_changes;
drop policy if exists schedule_templates_manager_read on public.schedule_templates;
drop policy if exists schedule_template_slots_manager_read on public.schedule_template_slots;
drop policy if exists schedule_weeks_member_read on public.schedule_weeks;
drop policy if exists shift_availability_own_read on public.shift_availability_responses;
drop policy if exists shift_availability_manager_read on public.shift_availability_responses;
drop policy if exists schedule_changes_own_read on public.schedule_publication_changes;
create policy schedule_templates_service on public.schedule_templates for all to service_role using(true) with check(true);
create policy schedule_template_slots_service on public.schedule_template_slots for all to service_role using(true) with check(true);
create policy schedule_weeks_service on public.schedule_weeks for all to service_role using(true) with check(true);
create policy shift_availability_service on public.shift_availability_responses for all to service_role using(true) with check(true);
create policy schedule_changes_service on public.schedule_publication_changes for all to service_role using(true) with check(true);
create policy schedule_templates_manager_read on public.schedule_templates for select to authenticated using(tenant_id=public.current_tenant_id() and public.can_manage_operational_location(tenant_id,location_id));
create policy schedule_template_slots_manager_read on public.schedule_template_slots for select to authenticated using(exists(select 1 from public.schedule_templates t where t.id=template_id and t.tenant_id=public.current_tenant_id() and public.can_manage_operational_location(t.tenant_id,t.location_id)));
create policy schedule_weeks_member_read on public.schedule_weeks for select to authenticated using(tenant_id=public.current_tenant_id() and public.can_access_operational_location(tenant_id,location_id));
create policy shift_availability_own_read on public.shift_availability_responses for select to authenticated using(tenant_id=public.current_tenant_id() and employee_id=public.current_employee_id());
create policy shift_availability_manager_read on public.shift_availability_responses for select to authenticated using(tenant_id=public.current_tenant_id() and public.can_manage_operational_location(tenant_id,location_id));
create policy schedule_changes_own_read on public.schedule_publication_changes for select to authenticated using(tenant_id=public.current_tenant_id() and (employee_id=public.current_employee_id() or public.can_manage_operational_location(tenant_id,location_id)));

create or replace function public.manage_schedule_template(p_tenant_id uuid,p_location_id uuid,p_actor_id uuid,p_action text,p_template_id uuid,p_name text default null,p_description text default null,p_slots jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_id uuid:=p_template_id; v_slot jsonb; v_copy public.schedule_templates%rowtype;
begin
  if not exists(select 1 from public.employees e where e.id=p_actor_id and e.tenant_id=p_tenant_id and e.status::text in ('aktiv','in_training','in_probe') and e.rolle::text in ('manager','backoffice','admin') and (e.rolle::text in ('backoffice','admin') or e.location_id=p_location_id)) then raise exception 'actor is not allowed'; end if;
  if not exists(select 1 from public.locations l where l.id=p_location_id and l.tenant_id=p_tenant_id) then raise exception 'location is outside tenant'; end if;
  if p_action='delete' then delete from public.schedule_templates where id=p_template_id and tenant_id=p_tenant_id and location_id=p_location_id; return p_template_id;
  elsif p_action='copy' then
    select * into v_copy from public.schedule_templates where id=p_template_id and tenant_id=p_tenant_id and location_id=p_location_id;
    if not found then raise exception 'template not found'; end if;
    insert into public.schedule_templates(tenant_id,location_id,name,description,created_by) values(p_tenant_id,p_location_id,v_copy.name||' (Kopie)',v_copy.description,p_actor_id) returning id into v_id;
    insert into public.schedule_template_slots(tenant_id,template_id,weekday,name,department_id,position,start_time,end_time,pause_minutes,headcount,sort_order) select p_tenant_id,v_id,weekday,name,department_id,position,start_time,end_time,pause_minutes,headcount,sort_order from public.schedule_template_slots where template_id=p_template_id;
    return v_id;
  end if;
  if p_action='create' then insert into public.schedule_templates(tenant_id,location_id,name,description,created_by) values(p_tenant_id,p_location_id,p_name,p_description,p_actor_id) returning id into v_id;
  elsif p_action='update' then update public.schedule_templates set name=p_name,description=p_description,updated_at=now() where id=p_template_id and tenant_id=p_tenant_id and location_id=p_location_id; if not found then raise exception 'template not found'; end if; delete from public.schedule_template_slots where template_id=v_id;
  else raise exception 'unknown action'; end if;
  for v_slot in select value from jsonb_array_elements(coalesce(p_slots,'[]'::jsonb)) loop
    insert into public.schedule_template_slots(tenant_id,template_id,weekday,name,department_id,position,start_time,end_time,pause_minutes,headcount,sort_order) values(p_tenant_id,v_id,(v_slot->>'weekday')::smallint,v_slot->>'name',nullif(v_slot->>'departmentId','')::uuid,nullif(v_slot->>'position',''),(v_slot->>'startTime')::time,(v_slot->>'endTime')::time,coalesce((v_slot->>'pauseMinutes')::integer,0),coalesce((v_slot->>'headcount')::integer,1),coalesce((v_slot->>'sortOrder')::integer,0));
  end loop; return v_id;
end $function$;

create or replace function public.open_schedule_week(p_tenant_id uuid,p_location_id uuid,p_actor_id uuid,p_week_start date,p_deadline timestamptz)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_id uuid;
begin
  if extract(isodow from p_week_start)<>1 then raise exception 'week_start must be Monday'; end if;
  if p_deadline is null then raise exception 'availability deadline is required'; end if;
  if not exists(select 1 from public.employees e where e.id=p_actor_id and e.tenant_id=p_tenant_id and e.status::text in ('aktiv','in_training','in_probe') and e.rolle::text in ('manager','backoffice','admin') and (e.rolle::text in ('backoffice','admin') or e.location_id=p_location_id)) then raise exception 'actor is not allowed'; end if;
  if not exists(select 1 from public.locations l where l.id=p_location_id and l.tenant_id=p_tenant_id) then raise exception 'location is outside tenant'; end if;
  insert into public.schedule_weeks(tenant_id,location_id,week_start,availability_deadline,created_by)
  values(p_tenant_id,p_location_id,p_week_start,p_deadline,p_actor_id)
  on conflict(tenant_id,location_id,week_start) do update set availability_deadline=excluded.availability_deadline,updated_at=now()
  where schedule_weeks.status='draft' returning id into v_id;
  if v_id is null then raise exception 'published schedule cannot be reopened'; end if;
  return v_id;
end $function$;

create or replace function public.apply_schedule_template(p_tenant_id uuid,p_location_id uuid,p_actor_id uuid,p_template_id uuid,p_week_start date,p_deadline timestamptz default null)
returns integer language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_slot record; v_n integer; v_date date; v_start timestamptz; v_end timestamptz; v_count integer:=0; v_week_id uuid;
begin
  if extract(isodow from p_week_start)<>1 then raise exception 'week_start must be Monday'; end if;
  if not exists(select 1 from public.employees e where e.id=p_actor_id and e.tenant_id=p_tenant_id and e.status::text in ('aktiv','in_training','in_probe') and e.rolle::text in ('manager','backoffice','admin') and (e.rolle::text in ('backoffice','admin') or e.location_id=p_location_id)) then raise exception 'actor is not allowed'; end if;
  if not exists(select 1 from public.schedule_templates t where t.id=p_template_id and t.tenant_id=p_tenant_id and t.location_id=p_location_id) then raise exception 'template outside location'; end if;
  if exists(select 1 from public.schedule_weeks where tenant_id=p_tenant_id and location_id=p_location_id and week_start=p_week_start and status='published') then raise exception 'published schedule cannot apply template'; end if;
  insert into public.schedule_weeks(tenant_id,location_id,week_start,availability_deadline,created_by) values(p_tenant_id,p_location_id,p_week_start,p_deadline,p_actor_id) on conflict(tenant_id,location_id,week_start) do update set availability_deadline=coalesce(excluded.availability_deadline,schedule_weeks.availability_deadline),updated_at=now() returning id into v_week_id;
  for v_slot in select * from public.schedule_template_slots where template_id=p_template_id order by weekday,sort_order,id loop
    v_date:=p_week_start+v_slot.weekday; v_start:=(v_date+v_slot.start_time) at time zone 'Europe/Berlin'; v_end:=((case when v_slot.end_time<=v_slot.start_time then v_date+1 else v_date end)+v_slot.end_time) at time zone 'Europe/Berlin';
    for v_n in 1..v_slot.headcount loop
      insert into public.shifts(tenant_id,location_id,department_id,start_zeit,end_zeit,status,position,notiz,pause_minuten,employee_id,offen_fuer_bewerbung,schedule_template_instance_key)
      values(p_tenant_id,p_location_id,v_slot.department_id,v_start,v_end,'geplant',v_slot.position,v_slot.name,v_slot.pause_minutes,null,true,p_template_id::text||':'||v_slot.weekday::text||':'||v_slot.start_time::text||':'||v_slot.end_time::text||':'||v_slot.name||':'||coalesce(v_slot.position,'')||':'||v_n::text||':'||p_week_start::text)
      on conflict(tenant_id,location_id,schedule_template_instance_key) where schedule_template_instance_key is not null do nothing;
      if found then v_count:=v_count+1; end if;
    end loop;
  end loop; return v_count;
end $function$;

create or replace function public.publish_schedule_week(p_tenant_id uuid,p_location_id uuid,p_actor_id uuid,p_week_start date)
returns integer language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_week public.schedule_weeks%rowtype; v_employee record; v_count integer:=0;
begin
  if not exists(select 1 from public.employees e where e.id=p_actor_id and e.tenant_id=p_tenant_id and e.status::text in ('aktiv','in_training','in_probe') and e.rolle::text in ('manager','backoffice','admin') and (e.rolle::text in ('backoffice','admin') or e.location_id=p_location_id)) then raise exception 'actor is not allowed'; end if;
  select * into v_week from public.schedule_weeks where tenant_id=p_tenant_id and location_id=p_location_id and week_start=p_week_start for update;
  if not found then raise exception 'schedule week not found'; end if;
  if v_week.status='published' then return 0; end if;
  update public.schedule_weeks set status='published',published_at=now(),published_by=p_actor_id,updated_at=now() where id=v_week.id;
  insert into public.schedule_publication_changes(tenant_id,location_id,schedule_week_id,shift_id,employee_id,change_type,summary,changed_by)
  select p_tenant_id,p_location_id,v_week.id,s.id,s.employee_id,'published','Dienstplan veröffentlicht',p_actor_id from public.shifts s where s.tenant_id=p_tenant_id and s.location_id=p_location_id and s.employee_id is not null and s.start_zeit>=p_week_start::timestamp at time zone 'Europe/Berlin' and s.start_zeit<(p_week_start+7)::timestamp at time zone 'Europe/Berlin';
  for v_employee in select distinct e.id,e.email from public.shifts s join public.employees e on e.id=s.employee_id where s.tenant_id=p_tenant_id and s.location_id=p_location_id and s.start_zeit>=p_week_start::timestamp at time zone 'Europe/Berlin' and s.start_zeit<(p_week_start+7)::timestamp at time zone 'Europe/Berlin' loop
    insert into public.notifications(employee_id,typ,titel,nachricht,link) values(v_employee.id,'info','Dienstplan veröffentlicht','Deine Schichten für die kommende Woche sind jetzt verbindlich.','/mitarbeiter#dienstplan');
    if v_employee.email is not null then insert into public.email_outbox(tenant_id,to_email,subject,html,template,template_data) values(p_tenant_id,v_employee.email,'Dein Dienstplan wurde veröffentlicht',null,'schedule_published',jsonb_build_object('employee_id',v_employee.id,'week_start',p_week_start)); end if;
    v_count:=v_count+1;
  end loop; return v_count;
end $function$;

-- Preserve and extend the proven deterministic assistant instead of creating a parallel engine.
do $rename$
begin
  if to_regprocedure('public.generate_weekly_shift_assignment_suggestions_core(uuid,uuid,date,uuid)') is null then
    alter function public.generate_weekly_shift_assignment_suggestions(uuid,uuid,date,uuid) rename to generate_weekly_shift_assignment_suggestions_core;
  end if;
end $rename$;

create or replace function public.generate_weekly_shift_assignment_suggestions_v1(p_tenant_id uuid,p_location_id uuid,p_week_start date,p_actor_id uuid)
returns setof public.weekly_shift_assignment_suggestions language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_shift record; v_candidate record; v_week_start_at timestamptz; v_week_end_at timestamptz;
begin
  perform public.generate_weekly_shift_assignment_suggestions_core(p_tenant_id,p_location_id,p_week_start,p_actor_id);
  v_week_start_at:=p_week_start::timestamp at time zone 'Europe/Berlin';
  v_week_end_at:=(p_week_start+7)::timestamp at time zone 'Europe/Berlin';
  -- Only reconsider shifts with concrete answers. All other shifts keep the
  -- proven core engine's result and filters.
  for v_shift in select s.* from public.shifts s where s.tenant_id=p_tenant_id and s.location_id=p_location_id and s.start_zeit>=v_week_start_at and s.start_zeit<v_week_end_at and s.employee_id is null and s.status::text not in ('abgesagt','storniert') and exists(select 1 from public.shift_availability_responses response where response.shift_id=s.id) loop
    select ranked.* into v_candidate from (
      select e.id,e.vorname,e.nachname,response.state,
        (case response.state when 'moechte' then 165 when 'kann' then 120 else 0 end
         + case when v_shift.department_id is null then 10 else 40 end
         - ceil(coalesce(hours.assigned_hours,0)*2)::integer) as final_score,
        coalesce(hours.assigned_hours,0) as assigned_hours
      from public.employees e
      left join public.shift_availability_responses response on response.shift_id=v_shift.id and response.employee_id=e.id
      left join lateral (
        select coalesce((select sum(extract(epoch from (assigned.end_zeit-assigned.start_zeit))/3600) from public.shifts assigned where assigned.tenant_id=p_tenant_id and assigned.employee_id=e.id and assigned.start_zeit>=v_week_start_at and assigned.start_zeit<v_week_end_at and assigned.status::text not in ('abgesagt','storniert')),0)
          + coalesce((select sum(extract(epoch from (suggested_shift.end_zeit-suggested_shift.start_zeit))/3600) from public.weekly_shift_assignment_suggestions suggested join public.shifts suggested_shift on suggested_shift.id=suggested.shift_id where suggested.tenant_id=p_tenant_id and suggested.location_id=p_location_id and suggested.week_start=p_week_start and suggested.employee_id=e.id and suggested.status='draft' and suggested.shift_id<>v_shift.id),0) assigned_hours
      ) hours on true
      where e.tenant_id=p_tenant_id and e.location_id=p_location_id and e.status::text='aktiv'
        and coalesce(response.state,'kann')<>'kann_nicht'
        and (v_shift.department_id is null or e.department_id=v_shift.department_id or exists(select 1 from public.department_responsibility_assignments responsibility where responsibility.tenant_id=p_tenant_id and responsibility.location_id=p_location_id and responsibility.department_id=v_shift.department_id and responsibility.employee_id=e.id and responsibility.aktiv and public.responsibility_assignment_active_at(responsibility.valid_from,responsibility.valid_until,responsibility.weekday_scope,responsibility.shift_start,responsibility.shift_end,v_shift.start_zeit)))
        and (v_shift.position is null or lower(coalesce(e.position_title,e.rolle::text))=lower(v_shift.position))
        and not exists(select 1 from public.availability_exceptions x where x.tenant_id=p_tenant_id and x.employee_id=e.id and x.datum=(v_shift.start_zeit at time zone 'Europe/Berlin')::date and x.typ::text in ('gesperrt','nicht_verfuegbar','krank','urlaub','abwesend','unavailable','sick'))
        and not exists(select 1 from public.employee_availability blocked where blocked.employee_id=e.id and blocked.weekday=extract(isodow from v_shift.start_zeit at time zone 'Europe/Berlin')::integer-1 and blocked.typ='gesperrt' and blocked.start_time<(v_shift.end_zeit at time zone 'Europe/Berlin')::time and blocked.end_time>(v_shift.start_zeit at time zone 'Europe/Berlin')::time)
        and not exists(select 1 from public.shifts other where other.tenant_id=p_tenant_id and other.employee_id=e.id and other.id<>v_shift.id and other.status::text not in ('abgesagt','storniert') and tstzrange(other.start_zeit,other.end_zeit,'[)') && tstzrange(v_shift.start_zeit,v_shift.end_zeit,'[)'))
        and not exists(select 1 from public.weekly_shift_assignment_suggestions other_suggestion join public.shifts other_shift on other_shift.id=other_suggestion.shift_id where other_suggestion.tenant_id=p_tenant_id and other_suggestion.employee_id=e.id and other_suggestion.status='draft' and other_suggestion.shift_id<>v_shift.id and tstzrange(other_shift.start_zeit,other_shift.end_zeit,'[)') && tstzrange(v_shift.start_zeit,v_shift.end_zeit,'[)'))
    ) ranked order by ranked.final_score desc,ranked.assigned_hours,ranked.id limit 1;
    if found then
      insert into public.weekly_shift_assignment_suggestions(tenant_id,location_id,week_start,shift_id,employee_id,score,reason,status,generated_at,updated_at)
      values(p_tenant_id,p_location_id,p_week_start,v_shift.id,v_candidate.id,v_candidate.final_score,
        case v_candidate.state when 'moechte' then 'Wunschschicht · konkrete Bewerbung' when 'kann' then 'Für diese Schicht verfügbar' else 'Keine konkrete Sperre eingetragen' end||format(' · bisher %s Std. in dieser Woche',round(v_candidate.assigned_hours::numeric,1)),'draft',now(),now())
      on conflict(shift_id) do update set employee_id=excluded.employee_id,score=excluded.score,reason=excluded.reason,status='draft',generated_at=now(),updated_at=now() where weekly_shift_assignment_suggestions.status<>'confirmed';
    else
      update public.weekly_shift_assignment_suggestions set status='obsolete',updated_at=now() where shift_id=v_shift.id and status='draft';
    end if;
  end loop;
  return query select suggestion.* from public.weekly_shift_assignment_suggestions suggestion where suggestion.tenant_id=p_tenant_id and suggestion.location_id=p_location_id and suggestion.week_start=p_week_start and suggestion.status='draft' order by suggestion.score desc,suggestion.shift_id;
end $function$;

create or replace function public.generate_weekly_shift_assignment_suggestions(p_tenant_id uuid,p_location_id uuid,p_week_start date,p_actor_id uuid)
returns setof public.weekly_shift_assignment_suggestions language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_week public.schedule_weeks%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||p_location_id::text||':'||p_week_start::text,0));
  select * into v_week from public.schedule_weeks where tenant_id=p_tenant_id and location_id=p_location_id and week_start=p_week_start;
  if found and v_week.availability_deadline is null then raise exception 'availability deadline is required'; end if;
  if found and now()<v_week.availability_deadline then raise exception 'availability deadline has not passed'; end if;
  return query select * from public.generate_weekly_shift_assignment_suggestions_v1(p_tenant_id,p_location_id,p_week_start,p_actor_id);
end $function$;

create or replace function public.record_published_schedule_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_week public.schedule_weeks%rowtype; v_employee uuid;
begin
  select * into v_week from public.schedule_weeks w where w.tenant_id=new.tenant_id and w.location_id=new.location_id and w.status='published' and (new.start_zeit at time zone 'Europe/Berlin')::date>=w.week_start and (new.start_zeit at time zone 'Europe/Berlin')::date<w.week_start+7;
  if not found or (old.employee_id is not distinct from new.employee_id and old.start_zeit=new.start_zeit and old.end_zeit=new.end_zeit and old.status::text=new.status::text) then return new; end if;
  foreach v_employee in array array[old.employee_id,new.employee_id] loop
    if v_employee is not null and not exists(select 1 from public.schedule_publication_changes c where c.schedule_week_id=v_week.id and c.shift_id=new.id and c.employee_id=v_employee and c.changed_at>now()-interval '2 seconds') then
      insert into public.schedule_publication_changes(tenant_id,location_id,schedule_week_id,shift_id,employee_id,change_type,summary,changed_by) values(new.tenant_id,new.location_id,v_week.id,new.id,v_employee,case when old.employee_id is distinct from new.employee_id then 'assignment_changed' when old.status::text is distinct from new.status::text then 'cancelled' else 'time_changed' end,'Geändert seit Veröffentlichung',nullif(current_setting('app.audit_employee_id',true),'')::uuid);
      insert into public.notifications(employee_id,typ,titel,nachricht,link) values(v_employee,'info','Dienstplan geändert','Eine veröffentlichte Schicht wurde geändert. Bitte prüfe deinen Dienstplan.','/mitarbeiter#dienstplan');
    end if;
  end loop; return new;
end $function$;
drop trigger if exists shifts_published_schedule_change on public.shifts;
create trigger shifts_published_schedule_change after update of employee_id,start_zeit,end_zeit,status on public.shifts for each row execute function public.record_published_schedule_change();

drop trigger if exists schedule_templates_audit on public.schedule_templates;
create trigger schedule_templates_audit after insert or update or delete on public.schedule_templates for each row execute function public.unified_audit_change();
drop trigger if exists schedule_template_slots_audit on public.schedule_template_slots;
create trigger schedule_template_slots_audit after insert or update or delete on public.schedule_template_slots for each row execute function public.unified_audit_change();
drop trigger if exists schedule_weeks_audit on public.schedule_weeks;
create trigger schedule_weeks_audit after insert or update or delete on public.schedule_weeks for each row execute function public.unified_audit_change();
drop trigger if exists shift_availability_responses_audit on public.shift_availability_responses;
create trigger shift_availability_responses_audit after insert or update or delete on public.shift_availability_responses for each row execute function public.unified_audit_change();
drop trigger if exists schedule_publication_changes_audit on public.schedule_publication_changes;
create trigger schedule_publication_changes_audit after insert or update or delete on public.schedule_publication_changes for each row execute function public.unified_audit_change();

revoke all on function public.manage_schedule_template(uuid,uuid,uuid,text,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.open_schedule_week(uuid,uuid,uuid,date,timestamptz) from public,anon,authenticated;
revoke all on function public.apply_schedule_template(uuid,uuid,uuid,uuid,date,timestamptz) from public,anon,authenticated;
revoke all on function public.publish_schedule_week(uuid,uuid,uuid,date) from public,anon,authenticated;
revoke all on function public.generate_weekly_shift_assignment_suggestions(uuid,uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.manage_schedule_template(uuid,uuid,uuid,text,uuid,text,text,jsonb) to service_role;
grant execute on function public.open_schedule_week(uuid,uuid,uuid,date,timestamptz) to service_role;
grant execute on function public.apply_schedule_template(uuid,uuid,uuid,uuid,date,timestamptz) to service_role;
grant execute on function public.publish_schedule_week(uuid,uuid,uuid,date) to service_role;
grant execute on function public.generate_weekly_shift_assignment_suggestions(uuid,uuid,date,uuid) to service_role;
revoke all on function public.generate_weekly_shift_assignment_suggestions_v1(uuid,uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.generate_weekly_shift_assignment_suggestions_v1(uuid,uuid,date,uuid) to service_role;
revoke all on function public.generate_weekly_shift_assignment_suggestions_core(uuid,uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.generate_weekly_shift_assignment_suggestions_core(uuid,uuid,date,uuid) to service_role;
grant all on public.schedule_templates,public.schedule_template_slots,public.schedule_weeks,public.shift_availability_responses,public.schedule_publication_changes to service_role;

commit;
