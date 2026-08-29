-- Unified organization, accountability, operational work and table ordering.
-- Additive by design: existing Neo data remains untouched and can be migrated
-- from Mise OS through legacy_source_id fields before the old writer is retired.

begin;

alter type public.order_status add value if not exists 'teilweise_fertig';
alter type public.order_status add value if not exists 'abholbereit';
alter type public.order_status add value if not exists 'wird_serviert';
alter type public.order_status add value if not exists 'serviert';
alter type public.order_status add value if not exists 'bezahlt';

commit;
begin;

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------------
-- Existing canonical entities: enrich instead of duplicating.
-- -------------------------------------------------------------------------

alter table public.departments
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists aktiv boolean not null default true,
  add column if not exists prioritaet smallint not null default 50,
  add column if not exists hauptverantwortung_erforderlich boolean not null default false,
  add column if not exists stellvertretung_erforderlich boolean not null default false,
  add column if not exists pflichten jsonb not null default '[]'::jsonb,
  add column if not exists geltungsregeln jsonb not null default '{}'::jsonb,
  add column if not exists legacy_source_id text;

update public.departments d
set tenant_id = l.tenant_id
from public.locations l
where d.location_id = l.id and d.tenant_id is null;

alter table public.departments
  drop constraint if exists departments_prioritaet_check;
alter table public.departments
  add constraint departments_prioritaet_check check (prioritaet between 0 and 100);

create unique index if not exists departments_legacy_source_uidx
  on public.departments(tenant_id, legacy_source_id)
  where legacy_source_id is not null;
create index if not exists departments_coverage_idx
  on public.departments(tenant_id, location_id, aktiv, prioritaet);

alter table public.employees
  add column if not exists reports_to_employee_id uuid references public.employees(id) on delete set null,
  add column if not exists position_title text,
  add column if not exists organization_level smallint not null default 50,
  add column if not exists legacy_mise_os_id text;

alter table public.employees
  drop constraint if exists employees_no_self_manager_check;
alter table public.employees
  add constraint employees_no_self_manager_check
  check (reports_to_employee_id is null or reports_to_employee_id <> id);

create unique index if not exists employees_legacy_mise_os_uidx
  on public.employees(tenant_id, legacy_mise_os_id)
  where legacy_mise_os_id is not null;
create index if not exists employees_reports_to_idx
  on public.employees(tenant_id, reports_to_employee_id);

-- Existing native Neo modules remain the canonical destination. Tenant and
-- source markers make their old Mise-OS records safe to import repeatedly.
alter table public.shifts
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists legacy_mise_os_id text;
alter table public.inventory_areas
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists legacy_mise_os_id text;
alter table public.inventory_items
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists legacy_mise_os_id text;
alter table public.inventory_batches
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists legacy_mise_os_id text;
alter table public.training_modules
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists location_id uuid references public.locations(id) on delete set null,
  add column if not exists legacy_mise_os_id text;
alter table public.training_progress
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists legacy_mise_os_id text;
alter table public.recipes
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists location_id uuid references public.locations(id) on delete set null,
  add column if not exists legacy_mise_os_id text;
alter table public.availability_exceptions
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade,
  add column if not exists legacy_mise_os_id text;

update public.shifts s set tenant_id=coalesce(
  (select l.tenant_id from public.locations l where l.id=s.location_id),
  (select e.tenant_id from public.employees e where e.id=s.employee_id)
) where s.tenant_id is null and (s.location_id is not null or s.employee_id is not null);
update public.inventory_areas a set tenant_id=l.tenant_id
from public.locations l where l.id=a.location_id and a.tenant_id is null;
update public.inventory_items i set tenant_id=a.tenant_id
from public.inventory_areas a where a.id=i.area_id and i.tenant_id is null;
update public.inventory_batches b set tenant_id=l.tenant_id
from public.locations l where l.id=b.location_id and b.tenant_id is null;
update public.training_progress p set tenant_id=e.tenant_id
from public.employees e where e.id=p.employee_id and p.tenant_id is null;
update public.training_modules m set tenant_id=x.tenant_id
from (
  select p.module_id,min(p.tenant_id::text)::uuid as tenant_id
  from public.training_progress p where p.tenant_id is not null
  group by p.module_id having count(distinct p.tenant_id)=1
) x where x.module_id=m.id and m.tenant_id is null;
-- Historic Neo seed content was inserted immediately before its tenant row.
-- Preserve that ownership without turning tenantless recipes/trainings into
-- cross-company data: only accept the first tenant created within ten minutes.
do $seed_backfill$
begin
  if (
    select count(*)=3 from information_schema.columns
    where table_schema='public' and column_name='created_at'
      and table_name in ('tenants','training_modules','recipes')
  ) then
    execute $sql$
      update public.training_modules m set tenant_id=(
        select t.id from public.tenants t
        where t.created_at between m.created_at and m.created_at + interval '10 minutes'
        order by t.created_at asc limit 1
      ) where m.tenant_id is null and exists (
        select 1 from public.tenants t
        where t.created_at between m.created_at and m.created_at + interval '10 minutes'
      )
    $sql$;
    execute $sql$
      update public.recipes r set tenant_id=(
        select t.id from public.tenants t
        where t.created_at between r.created_at and r.created_at + interval '10 minutes'
        order by t.created_at asc limit 1
      ) where r.tenant_id is null and exists (
        select 1 from public.tenants t
        where t.created_at between r.created_at and r.created_at + interval '10 minutes'
      )
    $sql$;
  end if;
end
$seed_backfill$;
update public.availability_exceptions x set tenant_id=e.tenant_id
from public.employees e where e.id=x.employee_id and x.tenant_id is null;

create unique index if not exists shifts_mise_os_source_uidx
  on public.shifts(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null;
create unique index if not exists inventory_areas_mise_os_source_uidx
  on public.inventory_areas(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null;
create unique index if not exists inventory_items_mise_os_source_uidx
  on public.inventory_items(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null;
create unique index if not exists inventory_batches_mise_os_source_uidx
  on public.inventory_batches(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null;
create unique index if not exists training_modules_mise_os_source_uidx
  on public.training_modules(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null;
create unique index if not exists training_progress_mise_os_source_uidx
  on public.training_progress(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null;
create unique index if not exists recipes_mise_os_source_uidx
  on public.recipes(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null;
create unique index if not exists availability_exceptions_mise_os_source_uidx
  on public.availability_exceptions(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null;

create or replace function public.unified_default_tenant_scope()
returns trigger language plpgsql set search_path=public,pg_temp as $function$
begin
  if new.tenant_id is null then new.tenant_id:=public.current_tenant_id(); end if;
  return new;
end
$function$;

do $tenant_triggers$
declare v_table text;
begin
  foreach v_table in array array[
    'departments','shifts','inventory_areas','inventory_items','inventory_batches','training_modules',
    'training_progress','recipes','availability_exceptions'
  ] loop
    execute format('drop trigger if exists unified_default_tenant on public.%I',v_table);
    execute format('create trigger unified_default_tenant before insert on public.%I for each row execute function public.unified_default_tenant_scope()',v_table);
  end loop;
end
$tenant_triggers$;

-- -------------------------------------------------------------------------
-- Hierarchy and responsibility coverage.
-- -------------------------------------------------------------------------

create table if not exists public.organization_positions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  parent_position_id uuid references public.organization_positions(id) on delete set null,
  title text not null,
  position_type text not null default 'bereich' check (position_type in (
    'geschaeftsfuehrung','betriebsleitung','filialleitung','schichtleitung','bereich','fachrolle'
  )),
  hierarchy_level smallint not null default 50 check (hierarchy_level between 0 and 100),
  aktiv boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.employees(id) on delete set null,
  legacy_source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, legacy_source_id)
);

create index if not exists organization_positions_tree_idx
  on public.organization_positions(tenant_id, location_id, parent_position_id, sort_order);

create table if not exists public.organization_position_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  position_id uuid not null references public.organization_positions(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  assignment_role text not null default 'inhaber' check (assignment_role in ('inhaber','stellvertretung','mitglied')),
  valid_from date not null default current_date,
  valid_until date,
  weekday_scope smallint[] not null default array[1,2,3,4,5,6,7]::smallint[],
  shift_start time,
  shift_end time,
  aktiv boolean not null default true,
  assigned_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from),
  check (weekday_scope <@ array[1,2,3,4,5,6,7]::smallint[]),
  unique (position_id, employee_id, assignment_role, valid_from)
);

create index if not exists organization_position_assignments_active_idx
  on public.organization_position_assignments(tenant_id, position_id, employee_id)
  where aktiv;

create table if not exists public.department_responsibility_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  responsibility_role text not null check (responsibility_role in ('hauptverantwortung','stellvertretung')),
  valid_from date not null default current_date,
  valid_until date,
  weekday_scope smallint[] not null default array[1,2,3,4,5,6,7]::smallint[],
  shift_start time,
  shift_end time,
  aktiv boolean not null default true,
  assigned_by uuid references public.employees(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from),
  check (weekday_scope <@ array[1,2,3,4,5,6,7]::smallint[]),
  unique (department_id, employee_id, responsibility_role, valid_from)
);

create index if not exists department_responsibility_active_idx
  on public.department_responsibility_assignments(
    tenant_id, location_id, department_id, responsibility_role, valid_from, valid_until
  ) where aktiv;

-- -------------------------------------------------------------------------
-- One operational work model for tasks, checklists and controls.
-- -------------------------------------------------------------------------

create table if not exists public.operational_task_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  title text not null,
  description text,
  task_kind text not null default 'aufgabe' check (task_kind in (
    'aufgabe','checkliste','kontrolle','hygiene','temperatur','lager','reinigung','kasse','training','qualitaet'
  )),
  recurrence_rule jsonb not null default '{}'::jsonb,
  evidence_requirements jsonb not null default '[]'::jsonb,
  control_required boolean not null default true,
  escalation_policy jsonb not null default '{"levels":[15,30,60]}'::jsonb,
  priority smallint not null default 50 check (priority between 0 and 100),
  aktiv boolean not null default true,
  created_by uuid references public.employees(id) on delete set null,
  source_type text,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists operational_task_templates_source_uidx
  on public.operational_task_templates(tenant_id, source_type, source_id)
  where source_type is not null and source_id is not null;

create table if not exists public.operational_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  template_id uuid references public.operational_task_templates(id) on delete set null,
  parent_task_id uuid references public.operational_tasks(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'offen' check (status in (
    'offen','angenommen','in_arbeit','wartet_auf_pruefung','erledigt','nicht_bestanden','blockiert','storniert'
  )),
  priority smallint not null default 50 check (priority between 0 and 100),
  created_by uuid not null references public.employees(id) on delete restrict,
  assigned_to uuid references public.employees(id) on delete set null,
  accountable_employee_id uuid not null references public.employees(id) on delete restrict,
  controller_employee_id uuid references public.employees(id) on delete set null,
  delegated_from_employee_id uuid references public.employees(id) on delete set null,
  due_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.employees(id) on delete set null,
  review_note text,
  evidence_requirements jsonb not null default '[]'::jsonb,
  escalation_policy jsonb not null default '{"levels":[15,30,60]}'::jsonb,
  escalation_level smallint not null default 0 check (escalation_level between 0 and 4),
  last_escalated_at timestamptz,
  source_type text,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_tasks_dashboard_idx
  on public.operational_tasks(tenant_id, location_id, accountable_employee_id, status, due_at);
create index if not exists operational_tasks_assignee_idx
  on public.operational_tasks(tenant_id, assigned_to, status, due_at);
create unique index if not exists operational_tasks_source_uidx
  on public.operational_tasks(tenant_id, source_type, source_id)
  where source_type is not null and source_id is not null;

create table if not exists public.operational_task_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  task_id uuid not null references public.operational_tasks(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('foto','kommentar','dokument','unterschrift','messwert')),
  storage_path text,
  content jsonb not null default '{}'::jsonb,
  submitted_by uuid not null references public.employees(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  verified_by uuid references public.employees(id) on delete set null,
  verified_at timestamptz,
  verification_status text not null default 'offen' check (verification_status in ('offen','akzeptiert','abgelehnt')),
  verification_note text
);

create index if not exists operational_task_evidence_task_idx
  on public.operational_task_evidence(tenant_id, task_id, submitted_at);

create table if not exists public.responsibility_handovers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  from_employee_id uuid not null references public.employees(id) on delete restrict,
  to_employee_id uuid not null references public.employees(id) on delete restrict,
  reason text not null check (reason in ('schichtende','urlaub','krankheit','sonstiges')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  note text,
  evidence jsonb not null default '[]'::jsonb,
  accepted_at timestamptz,
  accepted_by uuid references public.employees(id) on delete set null,
  status text not null default 'offen' check (status in ('offen','angenommen','abgeschlossen','storniert')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (to_employee_id <> from_employee_id),
  check (ends_at is null or ends_at >= starts_at)
);

create index if not exists responsibility_handovers_open_idx
  on public.responsibility_handovers(tenant_id, location_id, to_employee_id, status, starts_at);

-- -------------------------------------------------------------------------
-- Secure table sessions and service requests.
-- -------------------------------------------------------------------------

alter table public.restaurant_tables
  add column if not exists status text not null default 'frei',
  add column if not exists service_department_id uuid references public.departments(id) on delete set null,
  add column if not exists qr_version integer not null default 1,
  add column if not exists qr_disabled_at timestamptz,
  add column if not exists session_ttl_minutes integer not null default 180,
  add column if not exists service_confirmation_required boolean not null default false,
  add column if not exists menu_locale text,
  add column if not exists menu_variant text;

alter table public.restaurant_tables
  drop constraint if exists restaurant_tables_status_check,
  add constraint restaurant_tables_status_check check (status in ('frei','belegt','reserviert','reinigung','gesperrt')),
  drop constraint if exists restaurant_tables_session_ttl_check,
  add constraint restaurant_tables_session_ttl_check check (session_ttl_minutes between 15 and 720);

create table if not exists public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  table_id uuid not null references public.restaurant_tables(id) on delete cascade,
  qr_version integer not null,
  token_hash text not null unique,
  status text not null default 'aktiv' check (status in ('wartet_auf_bestaetigung','aktiv','geschlossen','abgelaufen','gesperrt')),
  expires_at timestamptz not null,
  confirmed_by_employee_id uuid references public.employees(id) on delete set null,
  confirmed_at timestamptz,
  closed_at timestamptz,
  ip_hash text,
  user_agent_hash text,
  order_count integer not null default 0 check (order_count >= 0),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index if not exists table_sessions_active_idx
  on public.table_sessions(table_id, status, expires_at);

alter table public.customer_orders
  add column if not exists table_session_id uuid references public.table_sessions(id) on delete set null;

create index if not exists customer_orders_table_session_idx
  on public.customer_orders(table_session_id, created_at)
  where table_session_id is not null;

create table if not exists public.table_service_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  table_id uuid not null references public.restaurant_tables(id) on delete cascade,
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  order_id uuid references public.customer_orders(id) on delete set null,
  request_type text not null check (request_type in ('service','nachbestellen','rechnung','bezahlen','besteck','problem')),
  message text,
  status text not null default 'offen' check (status in ('offen','angenommen','erledigt','storniert')),
  assigned_department_id uuid references public.departments(id) on delete set null,
  assigned_to uuid references public.employees(id) on delete set null,
  accepted_at timestamptz,
  completed_at timestamptz,
  escalation_level smallint not null default 0 check (escalation_level between 0 and 4),
  last_escalated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists table_service_requests_queue_idx
  on public.table_service_requests(tenant_id, location_id, status, created_at);
create unique index if not exists table_service_requests_no_spam_uidx
  on public.table_service_requests(session_id, request_type)
  where status in ('offen','angenommen');

create table if not exists public.table_order_events (
  id bigint generated by default as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  station_id uuid references public.kitchen_stations(id) on delete set null,
  actor_employee_id uuid references public.employees(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists table_order_events_order_idx
  on public.table_order_events(tenant_id, order_id, created_at);

-- -------------------------------------------------------------------------
-- Validation, automatic accountability, audit and escalation.
-- -------------------------------------------------------------------------

create or replace function public.unified_validate_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_row jsonb:=to_jsonb(new);
  v_location_id uuid;
  v_department_id uuid;
  v_position_id uuid;
  v_task_id uuid;
  v_location_tenant uuid;
  v_department_tenant uuid;
  v_employee_id uuid;
begin
  v_location_id:=nullif(v_row->>'location_id','')::uuid;
  v_department_id:=coalesce(
    nullif(v_row->>'department_id','')::uuid,
    nullif(v_row->>'assigned_department_id','')::uuid
  );
  v_position_id:=nullif(v_row->>'position_id','')::uuid;
  v_task_id:=nullif(v_row->>'task_id','')::uuid;

  if v_location_id is not null then
    select tenant_id into v_location_tenant from public.locations where id=v_location_id;
    if v_location_tenant is distinct from new.tenant_id then
      raise exception 'location is outside tenant';
    end if;
  end if;
  if v_department_id is not null then
    select coalesce(d.tenant_id,l.tenant_id) into v_department_tenant
    from public.departments d join public.locations l on l.id=d.location_id
    where d.id=v_department_id;
    if v_department_tenant is distinct from new.tenant_id then
      raise exception 'department is outside tenant';
    end if;
  end if;
  if v_position_id is not null and not exists(
    select 1 from public.organization_positions p
    where p.id=v_position_id and p.tenant_id=new.tenant_id
  ) then
    raise exception 'position is outside tenant';
  end if;
  if v_task_id is not null and not exists(
    select 1 from public.operational_tasks t
    where t.id=v_task_id and t.tenant_id=new.tenant_id
  ) then
    raise exception 'task is outside tenant';
  end if;
  foreach v_employee_id in array array_remove(array[
    nullif(v_row->>'employee_id','')::uuid,
    nullif(v_row->>'assigned_to','')::uuid,
    nullif(v_row->>'accountable_employee_id','')::uuid,
    nullif(v_row->>'controller_employee_id','')::uuid,
    nullif(v_row->>'created_by','')::uuid,
    nullif(v_row->>'from_employee_id','')::uuid,
    nullif(v_row->>'to_employee_id','')::uuid,
    nullif(v_row->>'submitted_by','')::uuid,
    nullif(v_row->>'verified_by','')::uuid
  ]::uuid[],null) loop
    if v_employee_id is not null and not exists(
      select 1 from public.employees e where e.id=v_employee_id and e.tenant_id=new.tenant_id
    ) then
      raise exception 'employee is outside tenant';
    end if;
  end loop;
  return new;
end
$function$;

create or replace function public.unified_validate_responsibility_overlap()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $function$
begin
  if new.aktiv and exists(
    select 1 from public.department_responsibility_assignments a
    where a.department_id=new.department_id
      and a.responsibility_role=new.responsibility_role
      and a.aktiv and a.id<>new.id
      and daterange(a.valid_from,coalesce(a.valid_until,'infinity'::date),'[]')
          && daterange(new.valid_from,coalesce(new.valid_until,'infinity'::date),'[]')
      and a.weekday_scope && new.weekday_scope
      and (
        a.shift_start is null or a.shift_end is null or new.shift_start is null or new.shift_end is null
        or (a.shift_start<a.shift_end and new.shift_start<new.shift_end
          and a.shift_start<new.shift_end and new.shift_start<a.shift_end)
        or a.shift_start>=a.shift_end or new.shift_start>=new.shift_end
      )
  ) then
    raise exception 'responsibility coverage overlaps an existing assignment';
  end if;
  return new;
end
$function$;

-- The UI replaces one scoped primary/deputy assignment in a single database
-- transaction. If validation or the new insert fails, the previous assignment
-- remains active instead of leaving a required area uncovered.
create or replace function public.replace_department_responsibility(
  p_tenant_id uuid,
  p_location_id uuid,
  p_department_id uuid,
  p_employee_id uuid,
  p_role text,
  p_weekdays smallint[] default array[1,2,3,4,5,6,7]::smallint[],
  p_shift_start time default null,
  p_shift_end time default null,
  p_assigned_by uuid default null
)
returns setof public.department_responsibility_assignments
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
begin
  if p_role not in ('hauptverantwortung','stellvertretung') then
    raise exception 'invalid responsibility role';
  end if;
  if coalesce(cardinality(p_weekdays),0)=0
     or not (p_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]) then
    raise exception 'invalid weekday scope';
  end if;
  if not exists(
    select 1 from public.departments d
    where d.id=p_department_id and d.tenant_id=p_tenant_id and d.location_id=p_location_id
  ) then
    raise exception 'department is outside tenant';
  end if;
  if p_assigned_by is not null and not exists(
    select 1 from public.employees e where e.id=p_assigned_by and e.tenant_id=p_tenant_id
  ) then
    raise exception 'assigner is outside tenant';
  end if;
  if p_employee_id is not null and not exists(
    select 1 from public.employees e
    where e.id=p_employee_id and e.tenant_id=p_tenant_id and e.location_id=p_location_id
      and e.status::text in ('aktiv','in_training','in_probe')
  ) then
    raise exception 'employee is outside tenant';
  end if;
  if p_employee_id is not null and exists(
    select 1 from public.department_responsibility_assignments a
    where a.tenant_id=p_tenant_id and a.department_id=p_department_id
      and a.employee_id=p_employee_id and a.aktiv
      and a.responsibility_role<>p_role
  ) then
    raise exception 'primary and deputy must be different employees';
  end if;

  perform 1 from public.department_responsibility_assignments a
  where a.tenant_id=p_tenant_id and a.department_id=p_department_id
    and a.responsibility_role=p_role and a.aktiv
  for update;

  update public.department_responsibility_assignments
  set aktiv=false,valid_until=greatest(valid_from,current_date),updated_at=now()
  where tenant_id=p_tenant_id and location_id=p_location_id
    and department_id=p_department_id and responsibility_role=p_role and aktiv;

  if p_employee_id is null then return; end if;

  return query
  insert into public.department_responsibility_assignments(
    tenant_id,location_id,department_id,employee_id,responsibility_role,
    valid_from,valid_until,weekday_scope,shift_start,shift_end,aktiv,assigned_by
  ) values(
    p_tenant_id,p_location_id,p_department_id,p_employee_id,p_role,
    current_date,null,p_weekdays,p_shift_start,p_shift_end,true,p_assigned_by
  )
  on conflict(department_id,employee_id,responsibility_role,valid_from) do update set
    location_id=excluded.location_id,tenant_id=excluded.tenant_id,valid_until=null,
    weekday_scope=excluded.weekday_scope,shift_start=excluded.shift_start,
    shift_end=excluded.shift_end,aktiv=true,assigned_by=excluded.assigned_by,updated_at=now()
  returning *;
end
$function$;

revoke all on function public.replace_department_responsibility(uuid,uuid,uuid,uuid,text,smallint[],time,time,uuid) from public,anon,authenticated;
grant execute on function public.replace_department_responsibility(uuid,uuid,uuid,uuid,text,smallint[],time,time,uuid) to service_role;

create or replace function public.unified_prepare_operational_task()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.accountable_employee_id is null and new.department_id is not null then
    select a.employee_id into new.accountable_employee_id
    from public.department_responsibility_assignments a
    where a.department_id=new.department_id
      and a.responsibility_role='hauptverantwortung' and a.aktiv
      and a.valid_from <= current_date
      and (a.valid_until is null or a.valid_until >= current_date)
      and extract(isodow from coalesce(new.due_at,now()))::smallint = any(a.weekday_scope)
    order by a.valid_from desc, a.created_at desc limit 1;
  end if;
  new.accountable_employee_id := coalesce(new.accountable_employee_id,new.assigned_to,new.created_by);
  if tg_op='UPDATE' and old.accountable_employee_id is distinct from new.accountable_employee_id
     and new.delegated_from_employee_id is not null then
    raise exception 'delegation cannot transfer accountability';
  end if;
  if new.status='erledigt' and new.completed_at is null then new.completed_at:=now(); end if;
  if new.status='wartet_auf_pruefung' and new.completed_at is null then new.completed_at:=now(); end if;
  if new.status in ('erledigt','nicht_bestanden') and new.reviewed_at is null and new.reviewed_by is not null then
    new.reviewed_at:=now();
  end if;
  return new;
end
$function$;

create or replace function public.unified_touch_updated_at()
returns trigger language plpgsql set search_path=public,pg_temp as $function$
begin new.updated_at:=now(); return new; end
$function$;

create or replace function public.unified_prepare_restaurant_table()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $function$
begin
  if tg_op='UPDATE' then
    if old.aktiv and not new.aktiv then new.qr_disabled_at:=now(); end if;
    if not old.aktiv and new.aktiv then new.qr_disabled_at:=null; end if;
    if old.qr_token is distinct from new.qr_token then
      new.qr_version:=old.qr_version+1;
      new.qr_disabled_at:=case when new.aktiv then null else now() end;
      update public.table_sessions
      set status='gesperrt',closed_at=now(),last_activity_at=now()
      where table_id=old.id and status in ('aktiv','wartet_auf_bestaetigung');
    end if;
  end if;
  return new;
end
$function$;

create or replace function public.unified_sync_table_order_station_status()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_order public.customer_orders%rowtype;
  v_total integer;
  v_done integer;
  v_started integer;
  v_next public.order_status;
begin
  if new.station_status is not distinct from old.station_status then return new; end if;
  select * into v_order from public.customer_orders where id=new.order_id and typ='vor_ort' and tisch_id is not null;
  if not found or v_order.status in ('storniert','serviert','bezahlt','abgeschlossen') then return new; end if;
  select count(*),count(*) filter(where station_status='fertig'),count(*) filter(where station_status='in_arbeit')
  into v_total,v_done,v_started from public.order_items where order_id=new.order_id;
  v_next:=case
    when v_total>0 and v_done=v_total then 'abholbereit'::public.order_status
    when v_done>0 then 'teilweise_fertig'::public.order_status
    when v_started>0 then 'in_zubereitung'::public.order_status
    else v_order.status end;
  if v_next is distinct from v_order.status then
    update public.customer_orders set status=v_next where id=v_order.id;
    insert into public.table_order_events(tenant_id,order_id,station_id,event_type,from_status,to_status,metadata)
    values(v_order.tenant_id,v_order.id,new.station_id,'station_progress',v_order.status::text,v_next::text,
      jsonb_build_object('itemId',new.id,'stationStatus',new.station_status));
  end if;
  return new;
end
$function$;

create or replace function public.unified_audit_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_before jsonb;
  v_after jsonb;
  v_tenant uuid;
  v_entity uuid;
begin
  v_before:=case when tg_op='INSERT' then null else to_jsonb(old) end;
  v_after:=case when tg_op='DELETE' then null else to_jsonb(new) end;
  v_tenant:=coalesce((v_after->>'tenant_id')::uuid,(v_before->>'tenant_id')::uuid);
  begin v_entity:=coalesce((v_after->>'id')::uuid,(v_before->>'id')::uuid); exception when others then v_entity:=null; end;
  insert into public.audit_log(tenant_id,employee_id,action,entity_type,entity_id,payload_before,payload_after)
  values(v_tenant,public.current_employee_id(),lower(tg_op),tg_table_name,v_entity,v_before,v_after);
  return coalesce(new,old);
end
$function$;

drop trigger if exists operational_tasks_prepare on public.operational_tasks;
create trigger operational_tasks_prepare before insert or update on public.operational_tasks
for each row execute function public.unified_prepare_operational_task();

drop trigger if exists restaurant_tables_unified_prepare on public.restaurant_tables;
create trigger restaurant_tables_unified_prepare before insert or update on public.restaurant_tables
for each row execute function public.unified_prepare_restaurant_table();

drop trigger if exists order_items_sync_table_order_status on public.order_items;
create trigger order_items_sync_table_order_status after update of station_status on public.order_items
for each row execute function public.unified_sync_table_order_station_status();

drop trigger if exists responsibility_overlap_validate on public.department_responsibility_assignments;
create trigger responsibility_overlap_validate before insert or update on public.department_responsibility_assignments
for each row execute function public.unified_validate_responsibility_overlap();

do $triggers$
declare v_table text;
begin
  foreach v_table in array array[
    'organization_positions','organization_position_assignments','department_responsibility_assignments',
    'operational_task_templates','operational_tasks','operational_task_evidence',
    'responsibility_handovers','table_service_requests'
  ] loop
    execute format('drop trigger if exists unified_scope_validate on public.%I',v_table);
    execute format('create trigger unified_scope_validate before insert or update on public.%I for each row execute function public.unified_validate_scope()',v_table);
  end loop;
  foreach v_table in array array[
    'organization_positions','organization_position_assignments','department_responsibility_assignments',
    'operational_task_templates','operational_tasks','responsibility_handovers','table_service_requests'
  ] loop
    execute format('drop trigger if exists unified_updated_at on public.%I',v_table);
    execute format('create trigger unified_updated_at before update on public.%I for each row execute function public.unified_touch_updated_at()',v_table);
  end loop;
  foreach v_table in array array[
    'departments','organization_positions','organization_position_assignments','department_responsibility_assignments',
    'operational_task_templates','operational_tasks','operational_task_evidence','responsibility_handovers',
    'restaurant_tables','table_service_requests'
  ] loop
    execute format('drop trigger if exists unified_audit on public.%I',v_table);
    execute format('create trigger unified_audit after insert or update or delete on public.%I for each row execute function public.unified_audit_change()',v_table);
  end loop;
end
$triggers$;

create or replace function public.process_operational_escalations(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_task record;
  v_level smallint;
  v_count integer:=0;
  v_recipient uuid;
begin
  for v_task in
    select t.* from public.operational_tasks t
    where t.due_at < p_now
      and t.status not in ('erledigt','storniert')
      and t.escalation_level < 4
    for update skip locked
  loop
    v_level:=case
      when p_now >= v_task.due_at + interval '60 minutes' then 4
      when p_now >= v_task.due_at + interval '30 minutes' then 3
      when p_now >= v_task.due_at + interval '15 minutes' then 2
      else 1 end;
    if v_level <= v_task.escalation_level then continue; end if;

    update public.operational_tasks
    set escalation_level=v_level,last_escalated_at=p_now,updated_at=p_now
    where id=v_task.id;

    v_recipient:=case
      when v_level=1 then v_task.assigned_to
      else coalesce(v_task.accountable_employee_id,v_task.controller_employee_id)
    end;
    if v_recipient is not null then
      insert into public.notifications(employee_id,typ,titel,nachricht,link)
      values(v_recipient,case when v_level=1 then 'warnung' else 'dringend' end,
        case when v_level=1 then 'Aufgabe fällig' else 'Aufgabe überfällig' end,
        v_task.title,'/mitarbeiter#verantwortung');
    end if;

    if v_level >= 3 then
      insert into public.notifications(employee_id,typ,titel,nachricht,link)
      select e.id,'dringend','Betriebliche Eskalation',v_task.title,'/neo/app/mitarbeiter?tab=aufgaben'
      from public.employees e
      where e.tenant_id=v_task.tenant_id
        and (
          (v_level=3 and e.location_id=v_task.location_id and e.rolle='manager')
          or (v_level>=4 and e.rolle in ('backoffice','admin'))
        );
    end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end
$function$;

create or replace function public.process_table_service_escalations(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_request record;
  v_level smallint;
  v_count integer:=0;
begin
  update public.table_sessions
  set status='abgelaufen',closed_at=p_now,last_activity_at=p_now
  where status in ('aktiv','wartet_auf_bestaetigung') and expires_at<=p_now;

  for v_request in
    select r.*,t.nummer from public.table_service_requests r
    join public.restaurant_tables t on t.id=r.table_id
    where r.status in ('offen','angenommen') and r.escalation_level<4
      and r.created_at < p_now-interval '3 minutes'
    for update of r skip locked
  loop
    v_level:=case
      when p_now>=v_request.created_at+interval '15 minutes' then 4
      when p_now>=v_request.created_at+interval '10 minutes' then 3
      when p_now>=v_request.created_at+interval '6 minutes' then 2
      else 1 end;
    if v_level<=v_request.escalation_level then continue; end if;
    update public.table_service_requests
    set escalation_level=v_level,last_escalated_at=p_now,updated_at=p_now
    where id=v_request.id;

    insert into public.notifications(employee_id,typ,titel,nachricht,link)
    select distinct e.id,'dringend','Serviceanfrage wartet',
      'Tisch '||v_request.nummer||': '||v_request.request_type,
      '/neo/app/tischbestellung?tab=service'
    from public.employees e
    where e.tenant_id=v_request.tenant_id and (
      e.id=v_request.assigned_to
      or (v_level>=2 and exists(
        select 1 from public.department_responsibility_assignments a
        where a.department_id=v_request.assigned_department_id and a.employee_id=e.id and a.aktiv
      ))
      or (v_level=3 and e.location_id=v_request.location_id and e.rolle='manager')
      or (v_level>=4 and e.rolle in ('backoffice','admin'))
    );
    v_count:=v_count+1;
  end loop;
  return v_count;
end
$function$;

-- -------------------------------------------------------------------------
-- Read models. security_invoker keeps base-table RLS in force.
-- -------------------------------------------------------------------------

create or replace view public.v_responsibility_coverage
with (security_invoker=true)
as
select
  d.id as department_id,d.tenant_id,d.location_id,d.name,d.prioritaet,
  d.hauptverantwortung_erforderlich,d.stellvertretung_erforderlich,
  primary_assignment.employee_id as hauptverantwortlicher_id,
  deputy_assignment.employee_id as stellvertretung_id,
  coalesce(
    case when primary_absence.employee_id is null then primary_assignment.employee_id end,
    deputy_assignment.employee_id
  ) as aktuell_zustaendig_id,
  (primary_absence.employee_id is not null) as hauptverantwortlicher_abwesend,
  case
    when d.hauptverantwortung_erforderlich and primary_assignment.employee_id is null then 'hauptverantwortung_fehlt'
    when d.stellvertretung_erforderlich and deputy_assignment.employee_id is null then 'stellvertretung_fehlt'
    when primary_absence.employee_id is not null and deputy_assignment.employee_id is null then 'vertretung_waehrend_abwesenheit_fehlt'
    when primary_absence.employee_id is not null then 'aktive_vertretung'
    else 'abgedeckt'
  end as abdeckungsstatus
from public.departments d
left join lateral (
  select a.employee_id from public.department_responsibility_assignments a
  where a.department_id=d.id and a.responsibility_role='hauptverantwortung' and a.aktiv
    and a.valid_from<=current_date and (a.valid_until is null or a.valid_until>=current_date)
    and extract(isodow from current_date)::smallint=any(a.weekday_scope)
  order by a.valid_from desc,a.created_at desc limit 1
) primary_assignment on true
left join lateral (
  select primary_assignment.employee_id
  where primary_assignment.employee_id is not null and (
    exists(
      select 1 from public.employees e
      where e.id=primary_assignment.employee_id and e.status::text in ('krank','urlaub','inaktiv')
    )
    or exists(
      select 1 from public.vacation_requests v
      where v.employee_id=primary_assignment.employee_id
        and v.status::text in ('genehmigt','approved')
        and current_date between v.von_datum and v.bis_datum
    )
    or exists(
      select 1 from public.availability_exceptions x
      where x.employee_id=primary_assignment.employee_id and x.datum=current_date
        and x.typ::text in ('gesperrt','nicht_verfuegbar','krank','abwesend','unavailable','sick')
    )
  )
) primary_absence on true
left join lateral (
  select a.employee_id from public.department_responsibility_assignments a
  where a.department_id=d.id and a.responsibility_role='stellvertretung' and a.aktiv
    and a.valid_from<=current_date and (a.valid_until is null or a.valid_until>=current_date)
    and extract(isodow from current_date)::smallint=any(a.weekday_scope)
  order by a.valid_from desc,a.created_at desc limit 1
) deputy_assignment on true
where d.aktiv;

create or replace view public.v_responsibility_dashboard
with (security_invoker=true)
as
select
  e.tenant_id,e.location_id,e.id as employee_id,
  count(t.id) filter(where t.status not in ('erledigt','storniert')) as offene_aufgaben,
  count(t.id) filter(where t.due_at<now() and t.status not in ('erledigt','storniert')) as ueberfaellige_aufgaben,
  count(t.id) filter(where t.status='wartet_auf_pruefung') as offene_kontrollen,
  count(t.id) filter(where t.status='nicht_bestanden') as nicht_bestanden,
  count(t.id) filter(where t.escalation_level>0 and t.status not in ('erledigt','storniert')) as eskalationen,
  count(t.id) filter(where t.status='erledigt') as erledigt
from public.employees e
left join public.operational_tasks t
  on t.tenant_id=e.tenant_id and (t.assigned_to=e.id or t.accountable_employee_id=e.id or t.controller_employee_id=e.id)
group by e.tenant_id,e.location_id,e.id;

-- -------------------------------------------------------------------------
-- RLS and explicit Data API grants.
-- -------------------------------------------------------------------------

do $rls$
declare v_table text;
begin
  foreach v_table in array array[
    'organization_positions','organization_position_assignments','department_responsibility_assignments',
    'operational_task_templates','operational_tasks','operational_task_evidence','responsibility_handovers',
    'table_sessions','table_service_requests','table_order_events'
  ] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('drop policy if exists unified_service_all on public.%I',v_table);
    execute format('create policy unified_service_all on public.%I for all to service_role using (true) with check (true)',v_table);
  end loop;
end
$rls$;

-- Replace historic policies on the reused native tables: every read/write is
-- tenant-bound, while employee-owned progress remains self-service capable.
do $native_rls$
declare v_table text; v_policy record;
begin
  foreach v_table in array array[
    'departments','shifts','inventory_areas','inventory_items','inventory_batches',
    'training_modules','training_progress','recipes','availability_exceptions'
  ] loop
    execute format('alter table public.%I enable row level security',v_table);
    for v_policy in
      select policyname from pg_policies where schemaname='public' and tablename=v_table
    loop
      execute format('drop policy if exists %I on public.%I',v_policy.policyname,v_table);
    end loop;
    execute format('create policy unified_service_all on public.%I for all to service_role using (true) with check (true)',v_table);
  end loop;

  foreach v_table in array array[
    'departments','shifts','inventory_areas','inventory_items','inventory_batches','training_modules','recipes'
  ] loop
    execute format(
      'create policy unified_native_read on public.%I for select to authenticated using (tenant_id=public.current_tenant_id())',v_table
    );
    execute format(
      'create policy unified_native_manage on public.%I for all to authenticated using (tenant_id=public.current_tenant_id() and public.is_manager_plus()) with check (tenant_id=public.current_tenant_id() and public.is_manager_plus())',v_table
    );
  end loop;
end
$native_rls$;

create policy unified_training_progress_read on public.training_progress
for select to authenticated using (
  tenant_id=public.current_tenant_id()
  and (public.is_manager_plus() or employee_id=public.current_employee_id())
);
create policy unified_training_progress_write on public.training_progress
for all to authenticated using (
  tenant_id=public.current_tenant_id()
  and (public.is_manager_plus() or employee_id=public.current_employee_id())
) with check (
  tenant_id=public.current_tenant_id()
  and (public.is_manager_plus() or employee_id=public.current_employee_id())
);
create policy unified_availability_exception_read on public.availability_exceptions
for select to authenticated using (
  tenant_id=public.current_tenant_id()
  and (public.is_manager_plus() or employee_id=public.current_employee_id())
);
create policy unified_availability_exception_write on public.availability_exceptions
for all to authenticated using (
  tenant_id=public.current_tenant_id()
  and (public.is_manager_plus() or employee_id=public.current_employee_id())
) with check (
  tenant_id=public.current_tenant_id()
  and (public.is_manager_plus() or employee_id=public.current_employee_id())
);

create or replace function public.can_access_operational_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $function$
  select exists(
    select 1 from public.operational_tasks t
    where t.id=p_task_id and t.tenant_id=public.current_tenant_id()
      and (
        public.is_manager_plus()
        or public.current_employee_id() in (t.created_by,t.assigned_to,t.accountable_employee_id,t.controller_employee_id)
        or exists(
          select 1 from public.department_responsibility_assignments a
          where a.department_id=t.department_id and a.employee_id=public.current_employee_id() and a.aktiv
        )
      )
  )
$function$;

drop policy if exists unified_org_read on public.organization_positions;
drop policy if exists unified_org_manage on public.organization_positions;
create policy unified_org_read on public.organization_positions
for select to authenticated using (tenant_id=public.current_tenant_id());
create policy unified_org_manage on public.organization_positions
for all to authenticated
using (tenant_id=public.current_tenant_id() and public.is_manager_plus())
with check (tenant_id=public.current_tenant_id() and public.is_manager_plus());

drop policy if exists unified_position_assignment_read on public.organization_position_assignments;
drop policy if exists unified_position_assignment_manage on public.organization_position_assignments;
create policy unified_position_assignment_read on public.organization_position_assignments
for select to authenticated using (tenant_id=public.current_tenant_id());
create policy unified_position_assignment_manage on public.organization_position_assignments
for all to authenticated
using (tenant_id=public.current_tenant_id() and public.is_manager_plus())
with check (tenant_id=public.current_tenant_id() and public.is_manager_plus());

drop policy if exists unified_responsibility_read on public.department_responsibility_assignments;
drop policy if exists unified_responsibility_manage on public.department_responsibility_assignments;
create policy unified_responsibility_read on public.department_responsibility_assignments
for select to authenticated using (tenant_id=public.current_tenant_id());
create policy unified_responsibility_manage on public.department_responsibility_assignments
for all to authenticated
using (tenant_id=public.current_tenant_id() and public.is_manager_plus())
with check (tenant_id=public.current_tenant_id() and public.is_manager_plus());

drop policy if exists unified_template_read on public.operational_task_templates;
drop policy if exists unified_template_manage on public.operational_task_templates;
create policy unified_template_read on public.operational_task_templates
for select to authenticated using (tenant_id=public.current_tenant_id());
create policy unified_template_manage on public.operational_task_templates
for all to authenticated
using (tenant_id=public.current_tenant_id() and public.is_manager_plus())
with check (tenant_id=public.current_tenant_id() and public.is_manager_plus());

drop policy if exists unified_task_read on public.operational_tasks;
drop policy if exists unified_task_insert on public.operational_tasks;
drop policy if exists unified_task_update on public.operational_tasks;
create policy unified_task_read on public.operational_tasks
for select to authenticated using (public.can_access_operational_task(id));
create policy unified_task_insert on public.operational_tasks
for insert to authenticated with check (
  tenant_id=public.current_tenant_id()
  and (public.is_manager_plus() or created_by=public.current_employee_id())
);
create policy unified_task_update on public.operational_tasks
for update to authenticated
using (public.can_access_operational_task(id))
with check (tenant_id=public.current_tenant_id() and public.can_access_operational_task(id));

drop policy if exists unified_evidence_read on public.operational_task_evidence;
drop policy if exists unified_evidence_insert on public.operational_task_evidence;
drop policy if exists unified_evidence_review on public.operational_task_evidence;
create policy unified_evidence_read on public.operational_task_evidence
for select to authenticated using (tenant_id=public.current_tenant_id() and public.can_access_operational_task(task_id));
create policy unified_evidence_insert on public.operational_task_evidence
for insert to authenticated with check (
  tenant_id=public.current_tenant_id() and submitted_by=public.current_employee_id()
  and public.can_access_operational_task(task_id)
);
create policy unified_evidence_review on public.operational_task_evidence
for update to authenticated
using (tenant_id=public.current_tenant_id() and public.can_access_operational_task(task_id))
with check (tenant_id=public.current_tenant_id() and public.can_access_operational_task(task_id));

drop policy if exists unified_handover_read on public.responsibility_handovers;
drop policy if exists unified_handover_write on public.responsibility_handovers;
create policy unified_handover_read on public.responsibility_handovers
for select to authenticated using (
  tenant_id=public.current_tenant_id()
  and (public.is_manager_plus() or public.current_employee_id() in (from_employee_id,to_employee_id))
);
create policy unified_handover_write on public.responsibility_handovers
for all to authenticated
using (
  tenant_id=public.current_tenant_id()
  and (public.is_manager_plus() or public.current_employee_id() in (from_employee_id,to_employee_id))
)
with check (
  tenant_id=public.current_tenant_id()
  and (public.is_manager_plus() or from_employee_id=public.current_employee_id())
);

drop policy if exists unified_service_request_read on public.table_service_requests;
create policy unified_service_request_read on public.table_service_requests
for select to authenticated using (
  tenant_id=public.current_tenant_id()
  and (public.is_manager_plus() or assigned_to=public.current_employee_id())
);

revoke all on table
  public.organization_positions,public.organization_position_assignments,
  public.department_responsibility_assignments,public.operational_task_templates,
  public.operational_tasks,public.operational_task_evidence,public.responsibility_handovers,
  public.table_sessions,public.table_service_requests,public.table_order_events
from public,anon,authenticated;

grant select,insert,update,delete on table
  public.organization_positions,public.organization_position_assignments,
  public.department_responsibility_assignments,public.operational_task_templates,
  public.operational_tasks,public.operational_task_evidence,public.responsibility_handovers
to authenticated;
grant select on table public.table_service_requests to authenticated;
grant select on table public.v_responsibility_coverage,public.v_responsibility_dashboard to authenticated;
grant select on table public.v_responsibility_coverage,public.v_responsibility_dashboard to service_role;

grant select,insert,update,delete on table
  public.organization_positions,public.organization_position_assignments,
  public.department_responsibility_assignments,public.operational_task_templates,
  public.operational_tasks,public.operational_task_evidence,public.responsibility_handovers,
  public.table_sessions,public.table_service_requests,public.table_order_events
to service_role;
grant usage,select on sequence public.table_order_events_id_seq to service_role;

revoke all on function public.unified_audit_change(),public.process_operational_escalations(timestamptz),
  public.process_table_service_escalations(timestamptz),
  public.unified_validate_scope(),public.unified_validate_responsibility_overlap(),
  public.unified_prepare_restaurant_table(),public.unified_sync_table_order_station_status(),
  public.can_access_operational_task(uuid) from public,anon;
grant execute on function public.can_access_operational_task(uuid) to authenticated,service_role;
grant execute on function public.process_operational_escalations(timestamptz) to service_role;
grant execute on function public.process_table_service_escalations(timestamptz) to service_role;

commit;
