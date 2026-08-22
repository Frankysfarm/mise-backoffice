-- Prevent duplicate stock movements when an assigned blind count is completed.
-- inventory_counts already owns the canonical movement/update trigger.
begin;

create or replace function public.complete_inventory_session(
  p_session_id uuid,
  p_counts jsonb
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_tenant_id uuid:=(select public.current_tenant_id());
  v_employee_id uuid:=(select public.current_employee_id());
  v_session public.inventory_sessions%rowtype;
  v_entry jsonb;
  v_item public.inventory_items%rowtype;
  v_count numeric;
  v_before numeric;
  v_location_id uuid;
  v_expected integer;
begin
  if auth.uid() is null or v_tenant_id is null or v_employee_id is null then
    raise exception 'inventory employee authorization required';
  end if;

  if not exists(
    select 1
    from pg_trigger t
    where t.tgrelid='public.inventory_counts'::regclass
      and t.tgname='trg_inventory_count_movement'
      and not t.tgisinternal
  ) then
    raise exception 'inventory count movement trigger is missing';
  end if;

  select s.* into strict v_session
  from public.inventory_sessions s
  where s.id=p_session_id
  for update;

  select coalesce(s.location_id,a.location_id) into v_location_id
  from public.inventory_sessions s
  left join public.inventory_areas a on a.id=s.area_id
  where s.id=p_session_id;

  if not exists(select 1 from public.locations l where l.id=v_location_id and l.tenant_id=v_tenant_id) then
    raise exception 'inventory session is outside tenant';
  end if;
  if v_session.assigned_to is distinct from v_employee_id and not public.is_manager_plus() then
    raise exception 'inventory session is assigned to another employee';
  end if;
  if v_session.abgeschlossen_am is not null then return v_session.id; end if;
  if v_session.area_id is null then raise exception 'inventory session has no counting area'; end if;
  if jsonb_typeof(p_counts)<>'array' or jsonb_array_length(p_counts)=0 then
    raise exception 'inventory counts must be a non-empty array';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_counts) e
    where not (e ? 'item_id') or not (e ? 'count')
      or (e->>'item_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or (e->>'count') !~ '^([0-9]+([.][0-9]+)?|[.][0-9]+)$'
      or (e->>'count')::numeric < 0
  ) then raise exception 'inventory counts contain invalid values'; end if;

  select count(*) into v_expected from public.inventory_items
  where area_id=v_session.area_id and aktiv=true;
  if v_expected=0 then raise exception 'inventory area has no active items'; end if;
  if (select count(distinct e->>'item_id') from jsonb_array_elements(p_counts) e)<>v_expected
    or jsonb_array_length(p_counts)<>v_expected
    or exists(
      select 1 from jsonb_array_elements(p_counts) e
      where not exists(
        select 1 from public.inventory_items i
        where i.id=(e->>'item_id')::uuid and i.area_id=v_session.area_id and i.aktiv=true
      )
    )
  then raise exception 'every active inventory item must be counted exactly once'; end if;

  for v_entry in select value from jsonb_array_elements(p_counts)
  loop
    select * into strict v_item from public.inventory_items
    where id=(v_entry->>'item_id')::uuid and area_id=v_session.area_id and aktiv=true
    for update;
    v_count:=(v_entry->>'count')::numeric;
    v_before:=coalesce(v_item.letzte_inventur,0);

    -- The existing trg_inventory_count_movement trigger creates exactly one
    -- stock_movements row and updates inventory_items.letzte_inventur.
    insert into public.inventory_counts(
      session_id,item_id,"gezählt_von",ist_bestand,differenz,kommentar
    ) values(
      v_session.id,v_item.id,v_employee_id,v_count,v_count-v_before,
      left(nullif(trim(v_entry->>'comment'),''),500)
    );
  end loop;

  update public.inventory_sessions
  set abgeschlossen_am=now(),gestartet_von=coalesce(gestartet_von,v_employee_id),ergebnis=p_counts
  where id=v_session.id;
  return v_session.id;
exception when no_data_found then
  raise exception 'inventory session not found';
end $function$;

revoke all on function public.complete_inventory_session(uuid,jsonb) from public,anon;
grant execute on function public.complete_inventory_session(uuid,jsonb) to authenticated,service_role;

notify pgrst,'reload schema';
commit;
