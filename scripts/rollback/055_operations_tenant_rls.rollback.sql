-- Emergency compatibility rollback for migration 055.
-- Run only after the application has been rolled back.

drop policy if exists tenant_read_055 on public.employees;
drop policy if exists tenant_admin_write_055 on public.employees;
create policy employees_tenant_read on public.employees
for select
using (
  tenant_id = public.current_tenant_id()
  or auth_user_id = auth.uid()
  or tenant_id is null
);
create policy employees_tenant_write on public.employees
for all
using ((tenant_id = public.current_tenant_id() and public.is_backoffice()) or public.is_backoffice())
with check ((tenant_id = public.current_tenant_id()) or public.is_backoffice());
create policy employees_update_self on public.employees
for update
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

drop policy if exists tenant_read_055 on public.departments;
drop policy if exists tenant_manager_write_055 on public.departments;
create policy departments_read_all on public.departments for select using (auth.uid() is not null);
create policy departments_write_backoffice on public.departments
for all using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists tenant_read_055 on public.inventory_areas;
drop policy if exists tenant_manager_write_055 on public.inventory_areas;
create policy inventory_areas_read_all on public.inventory_areas for select using (auth.uid() is not null);
create policy inventory_areas_write_bo on public.inventory_areas
for all using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists tenant_read_055 on public.inventory_items;
drop policy if exists tenant_manager_write_055 on public.inventory_items;
create policy inventory_items_read_all on public.inventory_items for select using (auth.uid() is not null);
create policy inventory_items_write_bo on public.inventory_items
for all using (public.is_backoffice()) with check (public.is_backoffice());

drop policy if exists tenant_read_055 on public.shifts;
drop policy if exists tenant_manager_write_055 on public.shifts;
create policy shifts_tenant_read on public.shifts for select using (
  employee_id in (select id from public.employees where tenant_id = public.current_tenant_id())
  or employee_id = public.current_employee_id()
);
create policy shifts_tenant_write on public.shifts for all using (
  employee_id in (select id from public.employees where tenant_id = public.current_tenant_id())
  and public.is_manager_plus()
);
