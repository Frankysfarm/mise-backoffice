\set ON_ERROR_STOP on

begin;

do $$
declare
  v_tenant uuid;
  v_location uuid;
  v_department uuid;
  v_first uuid;
  v_second uuid;
  v_active uuid;
begin
  if exists(select 1 from public.training_modules where tenant_id is null)
     or exists(select 1 from public.recipes where tenant_id is null) then
    raise exception 'historic training or recipe ownership was not preserved';
  end if;

  select l.tenant_id,l.id,d.id into strict v_tenant,v_location,v_department
  from public.locations l
  join public.departments d on d.location_id=l.id
  where (select count(*) from public.employees e
         where e.location_id=l.id and e.tenant_id=l.tenant_id
           and e.status::text in ('aktiv','in_training','in_probe'))>=2
  order by l.name,d.id
  limit 1;

  select ids[1],ids[2] into strict v_first,v_second
  from (
    select array_agg(e.id order by e.id) as ids
    from public.employees e
    where e.location_id=v_location and e.tenant_id=v_tenant
      and e.status::text in ('aktiv','in_training','in_probe')
  ) employees;

  perform public.replace_department_responsibility(
    v_tenant,v_location,v_department,v_first,'hauptverantwortung',
    array[1,2,3,4,5,6,7]::smallint[],null,null,v_first
  );
  perform public.replace_department_responsibility(
    v_tenant,v_location,v_department,v_second,'hauptverantwortung',
    array[1,2,3,4,5]::smallint[],'08:00'::time,'17:00'::time,v_first
  );

  begin
    perform public.replace_department_responsibility(
      v_tenant,v_location,v_department,'49999999-0000-0000-0000-000000000099',
      'hauptverantwortung',array[1,2,3,4,5]::smallint[],null,null,v_first
    );
    raise exception 'invalid replacement unexpectedly succeeded';
  exception when others then
    if sqlerrm='invalid replacement unexpectedly succeeded' then raise; end if;
  end;

  select employee_id into strict v_active
  from public.department_responsibility_assignments
  where tenant_id=v_tenant and location_id=v_location and department_id=v_department
    and responsibility_role='hauptverantwortung' and aktiv;
  if v_active<>v_second then
    raise exception 'failed replacement did not preserve the active responsibility';
  end if;
end $$;

rollback;

select 'production clone ownership and atomic responsibility smoke test passed' as result;
