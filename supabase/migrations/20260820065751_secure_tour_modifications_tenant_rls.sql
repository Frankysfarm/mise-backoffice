begin;

-- Replace the legacy policy from migration 043. Authorization must rely on
-- server-controlled employee and tenant ownership data only.
alter table public.tour_modifications enable row level security;

drop policy if exists authenticated_select_tour_modifications
  on public.tour_modifications;

create policy authenticated_select_tour_modifications
on public.tour_modifications
for select
to authenticated
using (
  exists (
    select 1
    from public.employees as employee
    join public.locations as location
      on location.tenant_id = employee.tenant_id
    where employee.auth_user_id = (select auth.uid())
      and location.id = tour_modifications.location_id
  )
);

-- Data API access is explicit; RLS still enforces tenant isolation per row.
revoke all on table public.tour_modifications from public, anon, authenticated;
grant select on table public.tour_modifications to authenticated;
grant select, insert, update, delete on table public.tour_modifications to service_role;

commit;
