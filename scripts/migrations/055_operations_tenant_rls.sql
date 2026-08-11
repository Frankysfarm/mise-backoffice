-- Tenant isolation for employee, scheduling and inventory operations.
-- Apply after 049-054 with a transaction-aware runner.

-- Employees contain payroll and personal data. Browser users may only read
-- their own tenant; only backoffice/admin users may mutate tenant records.
alter table public.employees enable row level security;
drop policy if exists employees_tenant_read on public.employees;
drop policy if exists employees_tenant_write on public.employees;
drop policy if exists employees_update_self on public.employees;
drop policy if exists tenant_read_055 on public.employees;
drop policy if exists tenant_admin_write_055 on public.employees;

create policy tenant_read_055 on public.employees
for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  or auth_user_id = auth.uid()
);
create policy tenant_admin_write_055 on public.employees
for all to authenticated
using (
  tenant_id = public.current_tenant_id()
  and public.is_backoffice()
)
with check (
  tenant_id = public.current_tenant_id()
  and public.is_backoffice()
);

-- Departments inherit ownership through their location.
alter table public.departments enable row level security;
drop policy if exists departments_read_all on public.departments;
drop policy if exists departments_write_backoffice on public.departments;
drop policy if exists tenant_read_055 on public.departments;
drop policy if exists tenant_manager_write_055 on public.departments;

create policy tenant_read_055 on public.departments
for select to authenticated
using (exists (
  select 1 from public.locations l
  where l.id = departments.location_id
    and l.tenant_id = public.current_tenant_id()
));

create policy tenant_manager_write_055 on public.departments
for all to authenticated
using (
  public.is_manager_plus()
  and exists (
    select 1 from public.locations l
    where l.id = departments.location_id
      and l.tenant_id = public.current_tenant_id()
  )
)
with check (
  public.is_manager_plus()
  and exists (
    select 1 from public.locations l
    where l.id = departments.location_id
      and l.tenant_id = public.current_tenant_id()
  )
);

-- Inventory areas and items inherit ownership through area -> location.
alter table public.inventory_areas enable row level security;
drop policy if exists inventory_areas_read_all on public.inventory_areas;
drop policy if exists inventory_areas_write_bo on public.inventory_areas;
drop policy if exists tenant_read_055 on public.inventory_areas;
drop policy if exists tenant_manager_write_055 on public.inventory_areas;

create policy tenant_read_055 on public.inventory_areas
for select to authenticated
using (exists (
  select 1 from public.locations l
  where l.id = inventory_areas.location_id
    and l.tenant_id = public.current_tenant_id()
));

create policy tenant_manager_write_055 on public.inventory_areas
for all to authenticated
using (
  public.is_manager_plus()
  and exists (
    select 1 from public.locations l
    where l.id = inventory_areas.location_id
      and l.tenant_id = public.current_tenant_id()
  )
)
with check (
  public.is_manager_plus()
  and exists (
    select 1 from public.locations l
    where l.id = inventory_areas.location_id
      and l.tenant_id = public.current_tenant_id()
  )
);

alter table public.inventory_items enable row level security;
drop policy if exists inventory_items_read_all on public.inventory_items;
drop policy if exists inventory_items_write_bo on public.inventory_items;
drop policy if exists tenant_read_055 on public.inventory_items;
drop policy if exists tenant_manager_write_055 on public.inventory_items;

create policy tenant_read_055 on public.inventory_items
for select to authenticated
using (exists (
  select 1
  from public.inventory_areas a
  join public.locations l on l.id = a.location_id
  where a.id = inventory_items.area_id
    and l.tenant_id = public.current_tenant_id()
));

create policy tenant_manager_write_055 on public.inventory_items
for all to authenticated
using (
  public.is_manager_plus()
  and exists (
    select 1
    from public.inventory_areas a
    join public.locations l on l.id = a.location_id
    where a.id = inventory_items.area_id
      and l.tenant_id = public.current_tenant_id()
  )
)
with check (
  public.is_manager_plus()
  and exists (
    select 1
    from public.inventory_areas a
    join public.locations l on l.id = a.location_id
    where a.id = inventory_items.area_id
      and l.tenant_id = public.current_tenant_id()
  )
);

-- Shifts inherit the tenant from their employee, or (when unassigned) from
-- their location. Optional location/department references must match too.
alter table public.shifts enable row level security;
drop policy if exists shifts_tenant_read on public.shifts;
drop policy if exists shifts_tenant_write on public.shifts;
drop policy if exists tenant_read_055 on public.shifts;
drop policy if exists tenant_manager_write_055 on public.shifts;

create policy tenant_read_055 on public.shifts
for select to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = shifts.employee_id
      and e.tenant_id = public.current_tenant_id()
  )
  or (
    employee_id is null
    and exists (
      select 1 from public.locations l
      where l.id = shifts.location_id
        and l.tenant_id = public.current_tenant_id()
    )
  )
);

create policy tenant_manager_write_055 on public.shifts
for all to authenticated
using (
  public.is_manager_plus()
  and (
    exists (
      select 1 from public.employees e
      where e.id = shifts.employee_id
        and e.tenant_id = public.current_tenant_id()
    )
    or (
      employee_id is null
      and exists (
        select 1 from public.locations l
        where l.id = shifts.location_id
          and l.tenant_id = public.current_tenant_id()
      )
    )
  )
)
with check (
  public.is_manager_plus()
  and (
    exists (
      select 1 from public.employees e
      where e.id = shifts.employee_id
        and e.tenant_id = public.current_tenant_id()
    )
    or (
      employee_id is null
      and exists (
        select 1 from public.locations l
        where l.id = shifts.location_id
          and l.tenant_id = public.current_tenant_id()
      )
    )
  )
  and (
    location_id is null
    or exists (
      select 1 from public.locations l
      where l.id = shifts.location_id
        and l.tenant_id = public.current_tenant_id()
    )
  )
  and (
    department_id is null
    or exists (
      select 1
      from public.departments d
      join public.locations l on l.id = d.location_id
      where d.id = shifts.department_id
        and l.tenant_id = public.current_tenant_id()
    )
  )
);
