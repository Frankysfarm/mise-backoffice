create extension if not exists pgcrypto;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;

create type public.order_status as enum (
  'neu','bestätigt','in_zubereitung','fertig','unterwegs','geliefert','abgeholt',
  'storniert','wartet_auf_zahlung','abgeschlossen','cancelled'
);

create table public.tenants (id uuid primary key default gen_random_uuid());
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null default 'Teststandort'
);
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  name text not null
);
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  location_id uuid references public.locations(id),
  department_id uuid references public.departments(id),
  vorname text not null default 'Test',
  nachname text not null default 'Person',
  email text,
  rolle text not null default 'mitarbeiter',
  status text not null default 'aktiv'
);
create table public.shifts (
  id uuid primary key default gen_random_uuid(), employee_id uuid references public.employees(id),
  department_id uuid references public.departments(id), location_id uuid references public.locations(id),
  start_zeit timestamptz not null, end_zeit timestamptz not null, typ text not null default 'normal',
  status text not null default 'geplant', position text, pause_minuten integer not null default 30
);
create table public.inventory_areas (
  id uuid primary key default gen_random_uuid(), location_id uuid references public.locations(id), name text not null
);
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(), area_id uuid references public.inventory_areas(id),
  name text not null, einheit text not null default 'Stück', letzte_inventur numeric
);
create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(), item_id uuid references public.inventory_items(id),
  location_id uuid references public.locations(id), eingang_am date not null default current_date,
  mhd date, menge numeric not null, rest_menge numeric not null
);
create table public.training_modules (
  id uuid primary key default gen_random_uuid(), titel text not null, inhalt jsonb
);
create table public.training_progress (
  id uuid primary key default gen_random_uuid(), employee_id uuid references public.employees(id),
  module_id uuid references public.training_modules(id)
);
create table public.recipes (
  id uuid primary key default gen_random_uuid(), name text not null, zutaten jsonb not null default '[]'::jsonb
);
create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  location_id uuid not null references public.locations(id),
  nummer text not null default '1',
  qr_token uuid not null default gen_random_uuid(),
  aktiv boolean not null default true
);
create table public.kitchen_stations (
  id uuid primary key default gen_random_uuid()
);
create table public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  location_id uuid not null references public.locations(id),
  tisch_id uuid references public.restaurant_tables(id),
  typ text not null default 'abholung',
  status public.order_status not null default 'neu',
  created_at timestamptz not null default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.customer_orders(id) on delete cascade,
  station_id uuid references public.kitchen_stations(id),
  station_status text not null default 'offen'
);
create table public.vacation_requests (
  id uuid primary key default gen_random_uuid(), employee_id uuid references public.employees(id),
  status text, von_datum date, bis_datum date
);
create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(), employee_id uuid references public.employees(id),
  datum date, typ text, grund text
);
create table public.employee_availability (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  weekday integer not null,
  start_time time not null,
  end_time time not null,
  typ text not null default 'verfügbar'
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), employee_id uuid references public.employees(id),
  typ text, titel text, nachricht text, link text
);
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
  to_email text not null, subject text not null, html text not null,
  template text, template_data jsonb, created_at timestamptz not null default now()
);
create table public.audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid, employee_id uuid, action text, entity_type text, entity_id uuid,
  payload_before jsonb, payload_after jsonb, created_at timestamptz not null default now()
);

create function public.current_employee_id() returns uuid language sql stable as $$select null::uuid$$;
create function public.current_tenant_id() returns uuid language sql stable as $$select null::uuid$$;
create function public.is_manager_plus() returns boolean language sql stable as $$select false$$;

insert into public.tenants(id) values ('10000000-0000-0000-0000-000000000001');
insert into public.locations(id,tenant_id) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
insert into public.departments(id,location_id,name) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Küche');
insert into public.employees(id,tenant_id,location_id,rolle) values
  ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','manager'),
  ('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','mitarbeiter');
