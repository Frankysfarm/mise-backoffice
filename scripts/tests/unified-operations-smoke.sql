\set ON_ERROR_STOP on

insert into public.department_responsibility_assignments(
  tenant_id,location_id,department_id,employee_id,responsibility_role,assigned_by
) values (
  '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',
  'hauptverantwortung','40000000-0000-0000-0000-000000000001'
);

update public.departments set
  hauptverantwortung_erforderlich=true,
  stellvertretung_erforderlich=true
where id='30000000-0000-0000-0000-000000000001';

do $$
declare v_employee uuid;
begin
  perform public.replace_department_responsibility(
    '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002',
    'hauptverantwortung',array[1,2,3,4,5]::smallint[],'08:00'::time,'17:00'::time,
    '40000000-0000-0000-0000-000000000001'
  );
  begin
    perform public.replace_department_responsibility(
      '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001','49999999-0000-0000-0000-000000000099',
      'hauptverantwortung',array[1,2,3,4,5]::smallint[],null,null,
      '40000000-0000-0000-0000-000000000001'
    );
    raise exception 'invalid replacement unexpectedly succeeded';
  exception when others then
    if sqlerrm='invalid replacement unexpectedly succeeded' then raise; end if;
  end;
  select employee_id into strict v_employee
  from public.department_responsibility_assignments
  where department_id='30000000-0000-0000-0000-000000000001'
    and responsibility_role='hauptverantwortung' and aktiv;
  if v_employee<>'40000000-0000-0000-0000-000000000002' then
    raise exception 'failed replacement did not preserve the active assignment';
  end if;
  perform public.replace_department_responsibility(
    '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',
    'hauptverantwortung',array[1,2,3,4,5,6,7]::smallint[],null,null,
    '40000000-0000-0000-0000-000000000001'
  );
end $$;

do $$
declare v_task uuid; v_accountable uuid; v_audit integer; v_status text;
begin
  insert into public.operational_tasks(
    tenant_id,location_id,department_id,title,created_by,assigned_to,accountable_employee_id,
    controller_employee_id,due_at,evidence_requirements
  ) values (
    '10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001','Temperaturkontrolle',
    '40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002',null,
    '40000000-0000-0000-0000-000000000001',now()-interval '90 minutes','["messwert"]'
  ) returning id,accountable_employee_id into v_task,v_accountable;
  if v_accountable <> '40000000-0000-0000-0000-000000000001' then
    raise exception 'accountability was not derived from department responsibility';
  end if;
  perform public.process_operational_escalations();
  select escalation_level into strict v_audit from public.operational_tasks where id=v_task;
  if v_audit <> 4 then raise exception 'escalation level is %, expected 4',v_audit; end if;
  if not exists(select 1 from public.notifications where nachricht='Temperaturkontrolle') then
    raise exception 'escalation notification missing';
  end if;
  select abdeckungsstatus into strict v_status from public.v_responsibility_coverage
  where department_id='30000000-0000-0000-0000-000000000001';
  if v_status <> 'stellvertretung_fehlt' then raise exception 'coverage status is %',v_status; end if;
  select count(*) into v_audit from public.audit_log where entity_type in ('departments','operational_tasks');
  if v_audit < 2 then raise exception 'audit rows missing'; end if;
end $$;

do $$
declare v_order uuid:='50000000-0000-0000-0000-000000000001'; v_status text; v_events integer;
begin
  insert into public.restaurant_tables(id,tenant_id,location_id,nummer)
  values('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001','12');
  insert into public.customer_orders(id,tenant_id,location_id,tisch_id,typ,status)
  values(v_order,'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002','vor_ort','neu');
  insert into public.order_items(id,order_id,station_status) values
    ('50000000-0000-0000-0000-000000000003',v_order,'offen'),
    ('50000000-0000-0000-0000-000000000004',v_order,'offen');

  update public.order_items set station_status='in_arbeit'
  where id='50000000-0000-0000-0000-000000000003';
  select status::text into strict v_status from public.customer_orders where id=v_order;
  if v_status <> 'in_zubereitung' then raise exception 'started station status is %',v_status; end if;

  update public.order_items set station_status='fertig'
  where id='50000000-0000-0000-0000-000000000003';
  select status::text into strict v_status from public.customer_orders where id=v_order;
  if v_status <> 'teilweise_fertig' then raise exception 'partial station status is %',v_status; end if;

  update public.order_items set station_status='fertig'
  where id='50000000-0000-0000-0000-000000000004';
  select status::text into strict v_status from public.customer_orders where id=v_order;
  if v_status <> 'abholbereit' then raise exception 'ready station status is %',v_status; end if;
  select count(*) into v_events from public.table_order_events where order_id=v_order;
  if v_events <> 3 then raise exception 'station events are %, expected 3',v_events; end if;
end $$;

select 'unified operations migration smoke test passed' as result;
