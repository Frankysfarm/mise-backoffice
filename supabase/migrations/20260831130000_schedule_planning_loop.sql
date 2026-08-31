begin;

create table if not exists public.schedule_templates (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade, name text not null check(length(name) between 2 and 120),
  description text, aktiv boolean not null default true, created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.schedule_template_slots (
  id uuid primary key default gen_random_uuid(), template_id uuid not null references public.schedule_templates(id) on delete cascade,
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
create policy schedule_templates_service on public.schedule_templates for all to service_role using(true) with check(true);
create policy schedule_template_slots_service on public.schedule_template_slots for all to service_role using(true) with check(true);
create policy schedule_weeks_service on public.schedule_weeks for all to service_role using(true) with check(true);
create policy shift_availability_service on public.shift_availability_responses for all to service_role using(true) with check(true);
create policy schedule_changes_service on public.schedule_publication_changes for all to service_role using(true) with check(true);
create policy schedule_templates_manager_read on public.schedule_templates for select to authenticated using(tenant_id=public.current_tenant_id() and public.can_manage_operational_location(tenant_id,location_id));
create policy schedule_template_slots_manager_read on public.schedule_template_slots for select to authenticated using(exists(select 1 from public.schedule_templates t where t.id=template_id and t.tenant_id=public.current_tenant_id() and public.can_manage_operational_location(t.tenant_id,t.location_id)));
create policy schedule_weeks_member_read on public.schedule_weeks for select to authenticated using(tenant_id=public.current_tenant_id() and public.can_access_operational_location(tenant_id,location_id));
create policy shift_availability_own_read on public.shift_availability_responses for select to authenticated using(tenant_id=public.current_tenant_id() and employee_id=public.current_employee_id());
create policy schedule_changes_own_read on public.schedule_publication_changes for select to authenticated using(tenant_id=public.current_tenant_id() and (employee_id=public.current_employee_id() or public.can_manage_operational_location(tenant_id,location_id)));

create or replace function public.manage_schedule_template(p_tenant_id uuid,p_location_id uuid,p_actor_id uuid,p_action text,p_template_id uuid,p_name text default null,p_description text default null,p_slots jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_id uuid:=p_template_id; v_slot jsonb; v_copy public.schedule_templates%rowtype;
begin
  if not exists(select 1 from public.employees e where e.id=p_actor_id and e.tenant_id=p_tenant_id and e.rolle::text in ('manager','backoffice','admin') and (e.rolle::text in ('backoffice','admin') or e.location_id=p_location_id)) then raise exception 'actor is not allowed'; end if;
  if not exists(select 1 from public.locations l where l.id=p_location_id and l.tenant_id=p_tenant_id) then raise exception 'location is outside tenant'; end if;
  if p_action='delete' then delete from public.schedule_templates where id=p_template_id and tenant_id=p_tenant_id and location_id=p_location_id; return p_template_id;
  elsif p_action='copy' then
    select * into v_copy from public.schedule_templates where id=p_template_id and tenant_id=p_tenant_id and location_id=p_location_id;
    if not found then raise exception 'template not found'; end if;
    insert into public.schedule_templates(tenant_id,location_id,name,description,created_by) values(p_tenant_id,p_location_id,v_copy.name||' (Kopie)',v_copy.description,p_actor_id) returning id into v_id;
    insert into public.schedule_template_slots(template_id,weekday,name,department_id,position,start_time,end_time,pause_minutes,headcount,sort_order) select v_id,weekday,name,department_id,position,start_time,end_time,pause_minutes,headcount,sort_order from public.schedule_template_slots where template_id=p_template_id;
    return v_id;
  end if;
  if p_action='create' then insert into public.schedule_templates(tenant_id,location_id,name,description,created_by) values(p_tenant_id,p_location_id,p_name,p_description,p_actor_id) returning id into v_id;
  elsif p_action='update' then update public.schedule_templates set name=p_name,description=p_description,updated_at=now() where id=p_template_id and tenant_id=p_tenant_id and location_id=p_location_id; if not found then raise exception 'template not found'; end if; delete from public.schedule_template_slots where template_id=v_id;
  else raise exception 'unknown action'; end if;
  for v_slot in select value from jsonb_array_elements(coalesce(p_slots,'[]'::jsonb)) loop
    insert into public.schedule_template_slots(template_id,weekday,name,department_id,position,start_time,end_time,pause_minutes,headcount,sort_order) values(v_id,(v_slot->>'weekday')::smallint,v_slot->>'name',nullif(v_slot->>'departmentId','')::uuid,nullif(v_slot->>'position',''),(v_slot->>'startTime')::time,(v_slot->>'endTime')::time,coalesce((v_slot->>'pauseMinutes')::integer,0),coalesce((v_slot->>'headcount')::integer,1),coalesce((v_slot->>'sortOrder')::integer,0));
  end loop; return v_id;
end $function$;

create or replace function public.apply_schedule_template(p_tenant_id uuid,p_location_id uuid,p_actor_id uuid,p_template_id uuid,p_week_start date,p_deadline timestamptz default null)
returns integer language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_slot record; v_n integer; v_date date; v_start timestamptz; v_end timestamptz; v_count integer:=0; v_week_id uuid;
begin
  if extract(isodow from p_week_start)<>1 then raise exception 'week_start must be Monday'; end if;
  if not exists(select 1 from public.employees e where e.id=p_actor_id and e.tenant_id=p_tenant_id and e.rolle::text in ('manager','backoffice','admin') and (e.rolle::text in ('backoffice','admin') or e.location_id=p_location_id)) then raise exception 'actor is not allowed'; end if;
  if not exists(select 1 from public.schedule_templates t where t.id=p_template_id and t.tenant_id=p_tenant_id and t.location_id=p_location_id) then raise exception 'template outside location'; end if;
  insert into public.schedule_weeks(tenant_id,location_id,week_start,availability_deadline,created_by) values(p_tenant_id,p_location_id,p_week_start,p_deadline,p_actor_id) on conflict(tenant_id,location_id,week_start) do update set availability_deadline=coalesce(excluded.availability_deadline,schedule_weeks.availability_deadline),updated_at=now() returning id into v_week_id;
  for v_slot in select * from public.schedule_template_slots where template_id=p_template_id order by weekday,sort_order,id loop
    v_date:=p_week_start+v_slot.weekday; v_start:=(v_date+v_slot.start_time) at time zone 'Europe/Berlin'; v_end:=((case when v_slot.end_time<=v_slot.start_time then v_date+1 else v_date end)+v_slot.end_time) at time zone 'Europe/Berlin';
    for v_n in 1..v_slot.headcount loop
      insert into public.shifts(tenant_id,location_id,department_id,start_zeit,end_zeit,status,position,pause_minuten,employee_id,offen_fuer_bewerbung,schedule_template_instance_key)
      values(p_tenant_id,p_location_id,v_slot.department_id,v_start,v_end,'geplant',coalesce(v_slot.position,v_slot.name),v_slot.pause_minutes,null,true,v_slot.id::text||':'||p_week_start::text||':'||v_n::text)
      on conflict(tenant_id,location_id,schedule_template_instance_key) where schedule_template_instance_key is not null do nothing;
      if found then v_count:=v_count+1; end if;
    end loop;
  end loop; return v_count;
end $function$;

create or replace function public.publish_schedule_week(p_tenant_id uuid,p_location_id uuid,p_actor_id uuid,p_week_start date)
returns integer language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_week public.schedule_weeks%rowtype; v_shift record; v_count integer:=0;
begin
  if not exists(select 1 from public.employees e where e.id=p_actor_id and e.tenant_id=p_tenant_id and e.rolle::text in ('manager','backoffice','admin') and (e.rolle::text in ('backoffice','admin') or e.location_id=p_location_id)) then raise exception 'actor is not allowed'; end if;
  select * into v_week from public.schedule_weeks where tenant_id=p_tenant_id and location_id=p_location_id and week_start=p_week_start for update;
  if not found then raise exception 'schedule week not found'; end if;
  update public.schedule_weeks set status='published',published_at=now(),published_by=p_actor_id,updated_at=now() where id=v_week.id;
  for v_shift in select s.id,s.employee_id,s.start_zeit,s.end_zeit,e.email from public.shifts s join public.employees e on e.id=s.employee_id where s.tenant_id=p_tenant_id and s.location_id=p_location_id and s.start_zeit>=p_week_start::timestamp at time zone 'Europe/Berlin' and s.start_zeit<(p_week_start+7)::timestamp at time zone 'Europe/Berlin' loop
    insert into public.schedule_publication_changes(tenant_id,location_id,schedule_week_id,shift_id,employee_id,change_type,summary,changed_by) values(p_tenant_id,p_location_id,v_week.id,v_shift.id,v_shift.employee_id,'published','Dienstplan veröffentlicht',p_actor_id);
    insert into public.notifications(employee_id,typ,titel,nachricht,link) values(v_shift.employee_id,'dienstplan','Dienstplan veröffentlicht','Deine Schicht für die kommende Woche ist jetzt verbindlich.','/mitarbeiter#dienstplan');
    if v_shift.email is not null then insert into public.email_outbox(tenant_id,to_email,subject,html,template,template_data) values(p_tenant_id,v_shift.email,'Dein Dienstplan wurde veröffentlicht','<p>Dein Dienstplan wurde veröffentlicht. Öffne die Mitarbeiter-App für deine Schichten.</p>','schedule_published',jsonb_build_object('employee_id',v_shift.employee_id,'week_start',p_week_start)); end if;
    v_count:=v_count+1;
  end loop; return v_count;
end $function$;

-- Preserve and extend the proven deterministic assistant instead of creating a parallel engine.
alter function public.generate_weekly_shift_assignment_suggestions(uuid,uuid,date,uuid)
  rename to generate_weekly_shift_assignment_suggestions_v1;
create function public.generate_weekly_shift_assignment_suggestions(p_tenant_id uuid,p_location_id uuid,p_week_start date,p_actor_id uuid)
returns setof public.weekly_shift_assignment_suggestions language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_deadline timestamptz;
begin
  select availability_deadline into v_deadline from public.schedule_weeks where tenant_id=p_tenant_id and location_id=p_location_id and week_start=p_week_start;
  if v_deadline is null then raise exception 'availability deadline is not set'; end if;
  if now()<v_deadline then raise exception 'availability deadline has not passed'; end if;
  perform public.generate_weekly_shift_assignment_suggestions_v1(p_tenant_id,p_location_id,p_week_start,p_actor_id);
  update public.weekly_shift_assignment_suggestions suggestion set
    score=suggestion.score+case response.state when 'moechte' then 45 when 'kann' then 20 else 0 end,
    reason=case response.state when 'moechte' then 'Wunschschicht · ' when 'kann' then 'Für diese Schicht verfügbar · ' else '' end||suggestion.reason,
    updated_at=now()
  from public.shift_availability_responses response
  where suggestion.shift_id=response.shift_id and suggestion.employee_id=response.employee_id and suggestion.status='draft' and response.state in ('kann','moechte');
  update public.weekly_shift_assignment_suggestions suggestion set status='obsolete',updated_at=now()
  from public.shift_availability_responses response
  where suggestion.shift_id=response.shift_id and suggestion.employee_id=response.employee_id and suggestion.status='draft' and response.state='kann_nicht';
  return query select suggestion.* from public.weekly_shift_assignment_suggestions suggestion where suggestion.tenant_id=p_tenant_id and suggestion.location_id=p_location_id and suggestion.week_start=p_week_start and suggestion.status='draft' order by suggestion.score desc,suggestion.shift_id;
end $function$;

create function public.record_published_schedule_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_week public.schedule_weeks%rowtype; v_employee uuid;
begin
  select * into v_week from public.schedule_weeks w where w.tenant_id=new.tenant_id and w.location_id=new.location_id and w.status='published' and (new.start_zeit at time zone 'Europe/Berlin')::date>=w.week_start and (new.start_zeit at time zone 'Europe/Berlin')::date<w.week_start+7;
  if not found or (old.employee_id is not distinct from new.employee_id and old.start_zeit=new.start_zeit and old.end_zeit=new.end_zeit and old.status::text=new.status::text) then return new; end if;
  foreach v_employee in array array[old.employee_id,new.employee_id] loop
    if v_employee is not null and not exists(select 1 from public.schedule_publication_changes c where c.schedule_week_id=v_week.id and c.shift_id=new.id and c.employee_id=v_employee and c.changed_at>now()-interval '2 seconds') then
      insert into public.schedule_publication_changes(tenant_id,location_id,schedule_week_id,shift_id,employee_id,change_type,summary,changed_by) values(new.tenant_id,new.location_id,v_week.id,new.id,v_employee,case when old.employee_id is distinct from new.employee_id then 'assignment_changed' when old.status::text is distinct from new.status::text then 'cancelled' else 'time_changed' end,'Geändert seit Veröffentlichung',nullif(current_setting('app.audit_employee_id',true),'')::uuid);
      insert into public.notifications(employee_id,typ,titel,nachricht,link) values(v_employee,'dienstplan_geaendert','Dienstplan geändert','Eine veröffentlichte Schicht wurde geändert. Bitte prüfe deinen Dienstplan.','/mitarbeiter#dienstplan');
    end if;
  end loop; return new;
end $function$;
drop trigger if exists shifts_published_schedule_change on public.shifts;
create trigger shifts_published_schedule_change after update of employee_id,start_zeit,end_zeit,status on public.shifts for each row execute function public.record_published_schedule_change();

revoke all on function public.manage_schedule_template(uuid,uuid,uuid,text,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.apply_schedule_template(uuid,uuid,uuid,uuid,date,timestamptz) from public,anon,authenticated;
revoke all on function public.publish_schedule_week(uuid,uuid,uuid,date) from public,anon,authenticated;
revoke all on function public.generate_weekly_shift_assignment_suggestions(uuid,uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.manage_schedule_template(uuid,uuid,uuid,text,uuid,text,text,jsonb) to service_role;
grant execute on function public.apply_schedule_template(uuid,uuid,uuid,uuid,date,timestamptz) to service_role;
grant execute on function public.publish_schedule_week(uuid,uuid,uuid,date) to service_role;
grant execute on function public.generate_weekly_shift_assignment_suggestions(uuid,uuid,date,uuid) to service_role;
revoke all on function public.generate_weekly_shift_assignment_suggestions_v1(uuid,uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.generate_weekly_shift_assignment_suggestions_v1(uuid,uuid,date,uuid) to service_role;
grant all on public.schedule_templates,public.schedule_template_slots,public.schedule_weeks,public.shift_availability_responses,public.schedule_publication_changes to service_role;

commit;
