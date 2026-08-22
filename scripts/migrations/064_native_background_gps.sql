-- 064: Idempotenter, monotoner GPS-Transport fuer die native Fahrer-App.
-- Die HTTP-Schicht authentifiziert den Fahrer; diese RPC fuehrt Receipt,
-- Breadcrumb und aktuelle Position atomar in genau einer Transaktion fort.

begin;

alter table public.mise_drivers
  add column if not exists last_foreground_at timestamptz;

create table if not exists public.mise_driver_gps_receipts (
  id bigint generated always as identity primary key,
  driver_id uuid not null references public.mise_drivers(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  action_id uuid not null,
  installation_id uuid not null,
  session_id uuid not null,
  sequence bigint not null check (sequence>=0),
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(driver_id,action_id),
  unique(driver_id,session_id,sequence)
);

create index if not exists idx_mise_driver_gps_receipts_driver_received
  on public.mise_driver_gps_receipts(driver_id,received_at desc);

alter table public.mise_driver_gps_receipts enable row level security;
drop policy if exists mise_driver_gps_receipts_service_all on public.mise_driver_gps_receipts;
create policy mise_driver_gps_receipts_service_all on public.mise_driver_gps_receipts
  for all to service_role using (true) with check (true);
revoke all on table public.mise_driver_gps_receipts from public,anon,authenticated;
grant select,insert,update,delete on table public.mise_driver_gps_receipts to service_role;
grant usage,select on sequence public.mise_driver_gps_receipts_id_seq to service_role;

create or replace function public.ingest_native_driver_gps(
  p_driver_id uuid,
  p_location_id uuid,
  p_action_id uuid,
  p_installation_id uuid,
  p_session_id uuid,
  p_sequence bigint,
  p_captured_at timestamptz,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_speed_mps double precision default null,
  p_heading_deg double precision default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_driver public.mise_drivers%rowtype;
  v_receipt_id bigint;
  v_batch_id uuid;
begin
  if p_sequence<0 or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
     or p_accuracy_m<0 or p_accuracy_m>10000
     or p_captured_at<now()-interval '24 hours' or p_captured_at>now()+interval '1 minute' then
    raise exception 'invalid native gps event';
  end if;

  select * into strict v_driver from public.mise_drivers where id=p_driver_id for update;
  if not v_driver.active or v_driver.shift_started_at is null
     or v_driver.shift_started_at<public.mise_driver_workday_start(p_location_id,now())
     or v_driver.shift_started_at<now()-make_interval(hours=>public.mise_driver_session_max_hours(p_location_id)) then
    raise exception 'driver session is not current';
  end if;

  insert into public.mise_driver_gps_receipts(
    driver_id,location_id,action_id,installation_id,session_id,sequence,captured_at,metadata
  ) values (
    p_driver_id,p_location_id,p_action_id,p_installation_id,p_session_id,p_sequence,p_captured_at,coalesce(p_metadata,'{}'::jsonb)
  ) on conflict do nothing returning id into v_receipt_id;
  if v_receipt_id is null then
    return jsonb_build_object('duplicate',true,'accepted',true);
  end if;

  select b.id into v_batch_id from public.mise_delivery_batches b
  where b.driver_id=p_driver_id and b.state not in ('completed','cancelled')
  order by b.created_at desc limit 1;

  insert into public.mise_driver_locations(
    driver_id,lat,lng,accuracy_m,heading,speed_kmh,batch_id,recorded_at
  ) values (
    p_driver_id,p_latitude,p_longitude,p_accuracy_m,p_heading_deg,
    case when p_speed_mps is null then null else greatest(0,p_speed_mps)*3.6 end,
    v_batch_id,p_captured_at
  );

  update public.mise_drivers set
    last_lat=case when last_position_at is null or p_captured_at>=last_position_at then p_latitude else last_lat end,
    last_lng=case when last_position_at is null or p_captured_at>=last_position_at then p_longitude else last_lng end,
    last_position_at=greatest(coalesce(last_position_at,p_captured_at),p_captured_at),
    last_active_at=now(),
    last_foreground_at=case
      when coalesce(p_metadata->>'app_state','unknown')='foreground' then now()
      else last_foreground_at
    end,
    updated_at=now()
  where id=p_driver_id;

  update public.driver_status ds set
    last_lat=case when ds.last_update is null or p_captured_at>=ds.last_update then p_latitude else ds.last_lat end,
    last_lng=case when ds.last_update is null or p_captured_at>=ds.last_update then p_longitude else ds.last_lng end,
    last_update=greatest(coalesce(ds.last_update,p_captured_at),p_captured_at)
  from public.employees e
  where ds.employee_id=e.id and e.auth_user_id=v_driver.auth_user_id;

  return jsonb_build_object('duplicate',false,'accepted',true,'receipt_id',v_receipt_id);
exception when no_data_found then
  raise exception 'driver not found';
end
$function$;

revoke all on function public.ingest_native_driver_gps(
  uuid,uuid,uuid,uuid,uuid,bigint,timestamptz,double precision,double precision,double precision,double precision,double precision,jsonb
) from public,anon,authenticated;
grant execute on function public.ingest_native_driver_gps(
  uuid,uuid,uuid,uuid,uuid,bigint,timestamptz,double precision,double precision,double precision,double precision,double precision,jsonb
) to service_role;

commit;
