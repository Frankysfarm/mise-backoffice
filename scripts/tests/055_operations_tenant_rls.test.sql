\set ON_ERROR_STOP on
\pset pager off

begin;

insert into auth.users (id, email, created_at, updated_at)
values
  ('a1000000-0000-4000-8000-000000000001', 'ops-a@example.invalid', now(), now()),
  ('a1000000-0000-4000-8000-000000000002', 'ops-b@example.invalid', now(), now()),
  ('a1000000-0000-4000-8000-000000000003', 'ops-staff@example.invalid', now(), now());

insert into public.tenants (id, name, slug)
values
  ('a2000000-0000-4000-8000-000000000001', 'Ops Tenant A', 'ops-tenant-a'),
  ('a2000000-0000-4000-8000-000000000002', 'Ops Tenant B', 'ops-tenant-b');

insert into public.locations (id, name, tenant_id)
values
  ('a3000000-0000-4000-8000-000000000001', 'Ops A', 'a2000000-0000-4000-8000-000000000001'),
  ('a3000000-0000-4000-8000-000000000002', 'Ops B', 'a2000000-0000-4000-8000-000000000002');

insert into public.departments (id, name, location_id)
values
  ('a4000000-0000-4000-8000-000000000001', 'Ops Dept A', 'a3000000-0000-4000-8000-000000000001'),
  ('a4000000-0000-4000-8000-000000000002', 'Ops Dept B', 'a3000000-0000-4000-8000-000000000002');

insert into public.inventory_areas (id, name, location_id)
values
  ('a5000000-0000-4000-8000-000000000001', 'Ops Area A', 'a3000000-0000-4000-8000-000000000001'),
  ('a5000000-0000-4000-8000-000000000002', 'Ops Area B', 'a3000000-0000-4000-8000-000000000002');

insert into public.inventory_items (id, name, area_id)
values
  ('a6000000-0000-4000-8000-000000000001', 'Ops Item A', 'a5000000-0000-4000-8000-000000000001'),
  ('a6000000-0000-4000-8000-000000000002', 'Ops Item B', 'a5000000-0000-4000-8000-000000000002');

insert into public.employees (
  id, auth_user_id, vorname, nachname, email, rolle, status,
  tenant_id, location_id, department_id
)
values
  (
    'a7000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'Ops', 'Admin A', 'ops-a@example.invalid', 'admin', 'aktiv',
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000001'
  ),
  (
    'a7000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000002',
    'Ops', 'Admin B', 'ops-b@example.invalid', 'admin', 'aktiv',
    'a2000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000002',
    'a4000000-0000-4000-8000-000000000002'
  ),
  (
    'a7000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000003',
    'Ops', 'Staff A', 'ops-staff@example.invalid', 'mitarbeiter', 'aktiv',
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000001'
  );

insert into public.shifts (
  id, employee_id, department_id, location_id, start_zeit, end_zeit
)
values
  (
    'a8000000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    now(), now() + interval '4 hours'
  ),
  (
    'a8000000-0000-4000-8000-000000000002',
    'a7000000-0000-4000-8000-000000000002',
    'a4000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000002',
    now(), now() + interval '4 hours'
  );

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $test$
declare
  visible_count integer;
  changed_count integer;
begin
  select count(*) into visible_count from public.employees
  where id in (
    'a7000000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000002'
  );
  if visible_count <> 1 then raise exception 'employee isolation failed: %', visible_count; end if;

  select count(*) into visible_count from public.departments
  where id in (
    'a4000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000002'
  );
  if visible_count <> 1 then raise exception 'department isolation failed: %', visible_count; end if;

  select count(*) into visible_count from public.inventory_areas
  where id in (
    'a5000000-0000-4000-8000-000000000001',
    'a5000000-0000-4000-8000-000000000002'
  );
  if visible_count <> 1 then raise exception 'inventory area isolation failed: %', visible_count; end if;

  select count(*) into visible_count from public.inventory_items
  where id in (
    'a6000000-0000-4000-8000-000000000001',
    'a6000000-0000-4000-8000-000000000002'
  );
  if visible_count <> 1 then raise exception 'inventory item isolation failed: %', visible_count; end if;

  select count(*) into visible_count from public.shifts
  where id in (
    'a8000000-0000-4000-8000-000000000001',
    'a8000000-0000-4000-8000-000000000002'
  );
  if visible_count <> 1 then raise exception 'shift isolation failed: %', visible_count; end if;

  update public.employees
  set nachname = 'Cross tenant write'
  where id = 'a7000000-0000-4000-8000-000000000002';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then raise exception 'cross-tenant employee update succeeded'; end if;

  begin
    insert into public.inventory_items (name, area_id)
    values ('Cross tenant item', 'a5000000-0000-4000-8000-000000000002');
    raise exception 'cross-tenant inventory insert succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.shifts (
      employee_id, department_id, location_id, start_zeit, end_zeit
    ) values (
      'a7000000-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000002',
      'a3000000-0000-4000-8000-000000000002',
      now(), now() + interval '2 hours'
    );
    raise exception 'mixed-tenant shift insert succeeded';
  exception
    when insufficient_privilege then null;
  end;
end
$test$;

reset role;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
set local role authenticated;

do $test$
declare changed_count integer;
begin
  update public.employees
  set rolle = 'admin'
  where id = 'a7000000-0000-4000-8000-000000000003';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then raise exception 'employee self-escalation succeeded'; end if;
end
$test$;

reset role;
rollback;

select '055 operations tenant RLS: PASS' as result;
