-- Transactional contract test. Run only after migrations 063 + 064; all writes
-- are expected to be enclosed by the caller in a transaction that is rolled back.

do $test$
declare
  v_driver_id uuid;
  v_location_id uuid;
  v_action_1 uuid:=gen_random_uuid();
  v_action_2 uuid:=gen_random_uuid();
  v_installation_id uuid:=gen_random_uuid();
  v_session_id uuid:=gen_random_uuid();
  v_result jsonb;
  v_lat numeric;
begin
  select d.id,e.location_id into v_driver_id,v_location_id
  from public.mise_drivers d
  join public.employees e on e.auth_user_id=d.auth_user_id and e.location_id is not null
  where not exists(
    select 1 from public.mise_delivery_batches b
    where b.driver_id=d.id and b.state not in ('completed','cancelled')
  )
  limit 1;
  if v_driver_id is null or v_location_id is null then
    raise exception 'native GPS test fixture unavailable';
  end if;

  update public.mise_drivers set active=true,state='idle',dispatch_availability='available',shift_started_at=now(),
    last_position_at=null,last_lat=null,last_lng=null,last_foreground_at=null
  where id=v_driver_id;

  v_result:=public.ingest_native_driver_gps(
    v_driver_id,v_location_id,v_action_1,v_installation_id,v_session_id,1,
    now()-interval '10 seconds',50.1001,8.6001,7,4,90,'{"app_state":"background"}'::jsonb
  );
  if coalesce((v_result->>'duplicate')::boolean,true) then
    raise exception 'first GPS event was marked duplicate';
  end if;

  v_result:=public.ingest_native_driver_gps(
    v_driver_id,v_location_id,v_action_1,v_installation_id,v_session_id,1,
    now()-interval '10 seconds',50.1001,8.6001,7,4,90,'{"app_state":"background"}'::jsonb
  );
  if not coalesce((v_result->>'duplicate')::boolean,false) then
    raise exception 'replayed GPS event was not idempotent';
  end if;

  -- A delayed breadcrumb is retained in the trail but must never move the
  -- current driver position backwards in time.
  perform public.ingest_native_driver_gps(
    v_driver_id,v_location_id,v_action_2,v_installation_id,v_session_id,2,
    now()-interval '2 minutes',51.2002,9.7002,9,2,45,'{"app_state":"background"}'::jsonb
  );
  select last_lat into v_lat from public.mise_drivers where id=v_driver_id;
  if abs(v_lat-50.1001)>0.000001 then
    raise exception 'delayed GPS event regressed current position: %',v_lat;
  end if;
  if (select count(*) from public.mise_driver_gps_receipts where driver_id=v_driver_id)<>2 then
    raise exception 'unexpected GPS receipt count';
  end if;
  if (select last_foreground_at is not null from public.mise_drivers where id=v_driver_id) then
    raise exception 'background GPS incorrectly marked app as foreground';
  end if;

  if has_function_privilege('authenticated',
    'public.ingest_native_driver_gps(uuid,uuid,uuid,uuid,uuid,bigint,timestamptz,double precision,double precision,double precision,double precision,double precision,jsonb)',
    'EXECUTE') then
    raise exception 'authenticated role can execute native GPS ingest';
  end if;
  if has_table_privilege('authenticated','public.mise_driver_gps_receipts','SELECT') then
    raise exception 'authenticated role can read native GPS receipts';
  end if;
end
$test$;

select 'native_background_gps_contract_ok' as result;
