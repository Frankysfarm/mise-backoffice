\set ON_ERROR_STOP on

do $$
begin
  if not public.responsibility_assignment_active_at(
    '2026-08-28','2026-08-28',array[5]::smallint[],'22:00'::time,'06:00'::time,
    '2026-08-29 02:30:00+00'::timestamptz
  ) then
    raise exception 'Friday overnight responsibility is not active early Saturday';
  end if;
  if public.responsibility_assignment_active_at(
    '2026-08-31',null,array[1]::smallint[],'09:00'::time,'17:00'::time,
    '2026-08-31 20:00:00+00'::timestamptz
  ) then
    raise exception 'day responsibility is incorrectly active at 22:00 Berlin time';
  end if;
end $$;

insert into public.locations(id,tenant_id)
values('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001');
insert into public.departments(id,tenant_id,location_id,name)
values('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Bar B');
insert into public.employees(id,tenant_id,location_id,rolle,status)
values('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','mitarbeiter','aktiv');

do $$
begin
  begin
    insert into public.operational_tasks(
      tenant_id,location_id,department_id,title,created_by,assigned_to,accountable_employee_id
    ) values (
      '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000002','Falscher Standort',
      '40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000001'
    );
    raise exception 'cross-location department unexpectedly accepted';
  exception when others then
    if sqlerrm='cross-location department unexpectedly accepted' then raise; end if;
    if position('department is outside location' in sqlerrm)=0 then raise; end if;
  end;
end $$;

select * from public.move_employee_in_organization(
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001',
  'Serviceleitung',true,'40000000-0000-0000-0000-000000000001'
);

do $$
begin
  if not exists(
    select 1 from public.audit_log
    where entity_type='employees'
      and entity_id='40000000-0000-0000-0000-000000000002'
      and employee_id='40000000-0000-0000-0000-000000000001'
      and action='organization_update'
      and payload_after->>'position_title'='Serviceleitung'
  ) then
    raise exception 'organization audit row is missing actor or change';
  end if;
  begin
    perform public.move_employee_in_organization(
      '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002',
      null,false,'40000000-0000-0000-0000-000000000001'
    );
    raise exception 'reporting cycle unexpectedly accepted';
  exception when others then
    if sqlerrm='reporting cycle unexpectedly accepted' then raise; end if;
    if position('reporting line cycle' in sqlerrm)=0 then raise; end if;
  end;
end $$;

select 'responsibility organization hardening test passed' as result;
