-- 073: Complete tenant isolation for the remaining inventory surfaces and
-- make goods receiving + order completion one atomic operation.
begin;

alter table public.suppliers enable row level security;
alter table public.inventory_categories enable row level security;
alter table public.inventory_shelves enable row level security;
alter table public.inventory_receiving enable row level security;
alter table public.inventory_waste enable row level security;
alter table public.inventory_sessions enable row level security;
alter table public.inventory_counts enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.item_suppliers enable row level security;
alter table public.stock_movements enable row level security;
alter table public.order_lists enable row level security;

-- These tables previously had no versioned policy contract. Remove any
-- permissive dashboard-era policies before installing the complete set below.
do $policies$
declare p record;
begin
  for p in
    select schemaname,tablename,policyname from pg_policies
    where schemaname='public' and tablename in (
      'suppliers','inventory_categories','inventory_shelves','inventory_receiving',
      'inventory_waste','inventory_sessions','inventory_counts',
      'inventory_batches','item_suppliers','stock_movements','order_lists'
    )
  loop
    execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  end loop;
end $policies$;

alter table public.suppliers alter column tenant_id set default public.current_tenant_id();

-- Categories are deliberately a shared, read-only taxonomy. Tenant-owned
-- products remain isolated through inventory_items -> area -> location.
create policy inventory_categories_read_073 on public.inventory_categories
for select to authenticated using (true);

create policy inventory_suppliers_read_073 on public.suppliers
for select to authenticated
using (tenant_id=(select public.current_tenant_id()));
create policy inventory_suppliers_write_073 on public.suppliers
for all to authenticated
using (tenant_id=(select public.current_tenant_id()) and (select public.is_manager_plus()))
with check (tenant_id=(select public.current_tenant_id()) and (select public.is_manager_plus()));

create policy inventory_shelves_read_073 on public.inventory_shelves
for select to authenticated
using (exists(
  select 1 from public.inventory_areas a
  join public.locations l on l.id=a.location_id
  where a.id=inventory_shelves.area_id and l.tenant_id=(select public.current_tenant_id())
));
create policy inventory_shelves_write_073 on public.inventory_shelves
for all to authenticated
using ((select public.is_manager_plus()) and exists(
  select 1 from public.inventory_areas a
  join public.locations l on l.id=a.location_id
  where a.id=inventory_shelves.area_id and l.tenant_id=(select public.current_tenant_id())
))
with check ((select public.is_manager_plus()) and exists(
  select 1 from public.inventory_areas a
  join public.locations l on l.id=a.location_id
  where a.id=inventory_shelves.area_id and l.tenant_id=(select public.current_tenant_id())
));

create policy inventory_receiving_read_073 on public.inventory_receiving
for select to authenticated
using ((select public.is_manager_plus()) and exists(
  select 1 from public.locations l
  where l.id=inventory_receiving.location_id and l.tenant_id=(select public.current_tenant_id())
));
create policy inventory_receiving_write_073 on public.inventory_receiving
for all to authenticated
using ((select public.is_manager_plus()) and exists(
  select 1 from public.locations l
  where l.id=inventory_receiving.location_id and l.tenant_id=(select public.current_tenant_id())
))
with check (
  (select public.is_manager_plus())
  and exists(select 1 from public.locations l where l.id=inventory_receiving.location_id and l.tenant_id=(select public.current_tenant_id()))
  and (inventory_receiving.supplier_id is null or exists(
    select 1 from public.suppliers s where s.id=inventory_receiving.supplier_id and s.tenant_id=(select public.current_tenant_id())
  ))
  and (inventory_receiving.order_list_id is null or exists(
    select 1 from public.order_lists o
    where o.id=inventory_receiving.order_list_id and o.location_id=inventory_receiving.location_id
  ))
  and (inventory_receiving.empfangen_von is null or exists(
    select 1 from public.employees e where e.id=inventory_receiving.empfangen_von and e.tenant_id=(select public.current_tenant_id())
  ))
);

create policy inventory_waste_read_073 on public.inventory_waste
for select to authenticated
using ((select public.is_manager_plus()) and exists(
  select 1 from public.inventory_items i
  join public.inventory_areas a on a.id=i.area_id
  join public.locations l on l.id=a.location_id
  where i.id=inventory_waste.item_id and l.tenant_id=(select public.current_tenant_id())
));
create policy inventory_waste_write_073 on public.inventory_waste
for all to authenticated
using ((select public.is_manager_plus()) and exists(
  select 1 from public.inventory_items i
  join public.inventory_areas a on a.id=i.area_id
  join public.locations l on l.id=a.location_id
  where i.id=inventory_waste.item_id and l.tenant_id=(select public.current_tenant_id())
))
with check (
  (select public.is_manager_plus())
  and exists(
    select 1 from public.inventory_items i
    join public.inventory_areas a on a.id=i.area_id
    join public.locations l on l.id=a.location_id
    where i.id=inventory_waste.item_id and l.tenant_id=(select public.current_tenant_id())
      and (inventory_waste.location_id is null or inventory_waste.location_id=l.id)
  )
  and (inventory_waste.erfasst_von is null or exists(
    select 1 from public.employees e where e.id=inventory_waste.erfasst_von and e.tenant_id=(select public.current_tenant_id())
  ))
);

create policy inventory_sessions_read_073 on public.inventory_sessions
for select to authenticated
using (
  (
    (select public.is_manager_plus())
    and (
      exists(select 1 from public.locations l where l.id=inventory_sessions.location_id and l.tenant_id=(select public.current_tenant_id()))
      or exists(
        select 1 from public.inventory_areas a join public.locations l on l.id=a.location_id
        where a.id=inventory_sessions.area_id and l.tenant_id=(select public.current_tenant_id())
      )
    )
  )
  or (
    inventory_sessions.assigned_to=(select public.current_employee_id())
    and (
      exists(select 1 from public.locations l where l.id=inventory_sessions.location_id and l.tenant_id=(select public.current_tenant_id()))
      or exists(
        select 1 from public.inventory_areas a join public.locations l on l.id=a.location_id
        where a.id=inventory_sessions.area_id and l.tenant_id=(select public.current_tenant_id())
      )
    )
  )
);
create policy inventory_sessions_write_073 on public.inventory_sessions
for all to authenticated
using (
  (select public.is_manager_plus()) and (
    exists(select 1 from public.locations l where l.id=inventory_sessions.location_id and l.tenant_id=(select public.current_tenant_id()))
    or exists(
      select 1 from public.inventory_areas a join public.locations l on l.id=a.location_id
      where a.id=inventory_sessions.area_id and l.tenant_id=(select public.current_tenant_id())
    )
  )
)
with check (
  (select public.is_manager_plus())
  and (
    exists(select 1 from public.locations l where l.id=inventory_sessions.location_id and l.tenant_id=(select public.current_tenant_id()))
    or exists(
      select 1 from public.inventory_areas a join public.locations l on l.id=a.location_id
      where a.id=inventory_sessions.area_id and l.tenant_id=(select public.current_tenant_id())
    )
  )
  and (inventory_sessions.area_id is null or exists(
    select 1 from public.inventory_areas a join public.locations l on l.id=a.location_id
    where a.id=inventory_sessions.area_id and l.tenant_id=(select public.current_tenant_id())
      and (inventory_sessions.location_id is null or inventory_sessions.location_id=l.id)
  ))
  and (inventory_sessions.assigned_to is null or exists(
    select 1 from public.employees e where e.id=inventory_sessions.assigned_to and e.tenant_id=(select public.current_tenant_id())
  ))
);

create policy inventory_counts_read_073 on public.inventory_counts
for select to authenticated
using (exists(
  select 1 from public.inventory_sessions s
  left join public.locations sl on sl.id=s.location_id
  left join public.inventory_areas a on a.id=s.area_id
  left join public.locations al on al.id=a.location_id
  where s.id=inventory_counts.session_id
    and coalesce(sl.tenant_id,al.tenant_id)=(select public.current_tenant_id())
    and ((select public.is_manager_plus()) or s.assigned_to=(select public.current_employee_id()))
));
create policy inventory_counts_write_073 on public.inventory_counts
for all to authenticated
using ((select public.is_manager_plus()) and exists(
  select 1 from public.inventory_sessions s
  left join public.locations sl on sl.id=s.location_id
  left join public.inventory_areas a on a.id=s.area_id
  left join public.locations al on al.id=a.location_id
  where s.id=inventory_counts.session_id
    and coalesce(sl.tenant_id,al.tenant_id)=(select public.current_tenant_id())
))
with check ((select public.is_manager_plus()) and exists(
  select 1 from public.inventory_sessions s
  join public.inventory_items i on i.id=inventory_counts.item_id
  left join public.locations sl on sl.id=s.location_id
  left join public.inventory_areas a on a.id=s.area_id
  left join public.locations al on al.id=a.location_id
  where s.id=inventory_counts.session_id
    and coalesce(sl.tenant_id,al.tenant_id)=(select public.current_tenant_id())
    and (s.area_id is null or i.area_id=s.area_id)
    and (inventory_counts."gezählt_von" is null or exists(
      select 1 from public.employees e
      where e.id=inventory_counts."gezählt_von" and e.tenant_id=(select public.current_tenant_id())
    ))
));

create policy inventory_batches_read_073 on public.inventory_batches
for select to authenticated
using (exists(
  select 1 from public.inventory_items i
  join public.inventory_areas a on a.id=i.area_id
  join public.locations l on l.id=a.location_id
  where i.id=inventory_batches.item_id and l.tenant_id=(select public.current_tenant_id())
));
create policy inventory_batches_write_073 on public.inventory_batches
for all to authenticated
using ((select public.is_manager_plus()) and exists(
  select 1 from public.inventory_items i
  join public.inventory_areas a on a.id=i.area_id
  join public.locations l on l.id=a.location_id
  where i.id=inventory_batches.item_id and l.tenant_id=(select public.current_tenant_id())
))
with check ((select public.is_manager_plus()) and exists(
  select 1 from public.inventory_items i
  join public.inventory_areas a on a.id=i.area_id
  join public.locations l on l.id=a.location_id
  where i.id=inventory_batches.item_id and l.tenant_id=(select public.current_tenant_id())
    and (inventory_batches.location_id is null or inventory_batches.location_id=l.id)
) and (inventory_batches.lieferant_id is null or exists(
  select 1 from public.suppliers s
  where s.id=inventory_batches.lieferant_id and s.tenant_id=(select public.current_tenant_id())
)));

create policy item_suppliers_read_073 on public.item_suppliers
for select to authenticated
using (exists(
  select 1 from public.inventory_items i
  join public.inventory_areas a on a.id=i.area_id
  join public.locations l on l.id=a.location_id
  where i.id=item_suppliers.item_id and l.tenant_id=(select public.current_tenant_id())
));
create policy item_suppliers_write_073 on public.item_suppliers
for all to authenticated
using ((select public.is_manager_plus()) and exists(
  select 1 from public.inventory_items i
  join public.inventory_areas a on a.id=i.area_id
  join public.locations l on l.id=a.location_id
  where i.id=item_suppliers.item_id and l.tenant_id=(select public.current_tenant_id())
))
with check ((select public.is_manager_plus()) and exists(
  select 1 from public.inventory_items i
  join public.inventory_areas a on a.id=i.area_id
  join public.locations l on l.id=a.location_id
  where i.id=item_suppliers.item_id and l.tenant_id=(select public.current_tenant_id())
) and exists(
  select 1 from public.suppliers s
  where s.id=item_suppliers.supplier_id and s.tenant_id=(select public.current_tenant_id())
));

create policy stock_movements_read_073 on public.stock_movements
for select to authenticated
using ((select public.is_manager_plus()) and exists(
  select 1 from public.inventory_items i
  join public.inventory_areas a on a.id=i.area_id
  join public.locations l on l.id=a.location_id
  where i.id=stock_movements.item_id and l.tenant_id=(select public.current_tenant_id())
));
create policy stock_movements_write_073 on public.stock_movements
for all to authenticated
using ((select public.is_manager_plus()) and exists(
  select 1 from public.inventory_items i
  join public.inventory_areas a on a.id=i.area_id
  join public.locations l on l.id=a.location_id
  where i.id=stock_movements.item_id and l.tenant_id=(select public.current_tenant_id())
))
with check ((select public.is_manager_plus()) and exists(
  select 1 from public.inventory_items i
  join public.inventory_areas a on a.id=i.area_id
  join public.locations l on l.id=a.location_id
  where i.id=stock_movements.item_id and l.tenant_id=(select public.current_tenant_id())
    and (stock_movements.location_id is null or stock_movements.location_id=l.id)
) and (stock_movements.erfasst_von is null or exists(
  select 1 from public.employees e
  where e.id=stock_movements.erfasst_von and e.tenant_id=(select public.current_tenant_id())
)));

create policy inventory_order_lists_read_073 on public.order_lists
for select to authenticated
using ((select public.is_manager_plus()) and exists(
  select 1 from public.locations l
  where l.id=order_lists.location_id and l.tenant_id=(select public.current_tenant_id())
));
create policy inventory_order_lists_write_073 on public.order_lists
for all to authenticated
using ((select public.is_manager_plus()) and exists(
  select 1 from public.locations l
  where l.id=order_lists.location_id and l.tenant_id=(select public.current_tenant_id())
))
with check (
  (select public.is_manager_plus())
  and exists(select 1 from public.locations l where l.id=order_lists.location_id and l.tenant_id=(select public.current_tenant_id()))
  and (order_lists.supplier_id is null or exists(
    select 1 from public.suppliers s where s.id=order_lists.supplier_id and s.tenant_id=(select public.current_tenant_id())
  ))
  and (order_lists.erstellt_von is null or exists(
    select 1 from public.employees e where e.id=order_lists.erstellt_von and e.tenant_id=(select public.current_tenant_id())
  ))
);

create or replace function public.record_inventory_receiving(
  p_order_list_id uuid,
  p_supplier_id uuid,
  p_location_id uuid,
  p_temperatur_ok boolean,
  p_mhd_ok boolean,
  p_menge_ok boolean,
  p_notiz text,
  p_positionen jsonb
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_tenant_id uuid:=(select public.current_tenant_id());
  v_employee_id uuid:=(select public.current_employee_id());
  v_order public.order_lists%rowtype;
  v_supplier_id uuid:=p_supplier_id;
  v_positionen jsonb:=coalesce(p_positionen,'[]'::jsonb);
  v_receiving_id uuid;
begin
  if auth.uid() is null or v_tenant_id is null or not public.is_manager_plus() then
    raise exception 'inventory manager authorization required';
  end if;
  if not exists(select 1 from public.locations l where l.id=p_location_id and l.tenant_id=v_tenant_id) then
    raise exception 'inventory location is outside tenant';
  end if;

  if p_order_list_id is not null then
    select * into strict v_order from public.order_lists
    where id=p_order_list_id and location_id=p_location_id and status::text='bestellt'
    for update;
    v_supplier_id:=coalesce(v_supplier_id,v_order.supplier_id);
    if jsonb_typeof(v_positionen)<>'array' or jsonb_array_length(v_positionen)=0 then
      v_positionen:=coalesce(v_order.positionen,'[]'::jsonb);
    end if;
  end if;

  if v_supplier_id is not null and not exists(
    select 1 from public.suppliers s where s.id=v_supplier_id and s.tenant_id=v_tenant_id
  ) then
    raise exception 'inventory supplier is outside tenant';
  end if;
  if jsonb_typeof(v_positionen)<>'array' then raise exception 'positions must be an array'; end if;

  insert into public.inventory_receiving(
    order_list_id,supplier_id,location_id,empfangen_von,
    temperatur_ok,mhd_ok,menge_ok,notiz,positionen
  ) values(
    p_order_list_id,v_supplier_id,p_location_id,v_employee_id,
    p_temperatur_ok,p_mhd_ok,p_menge_ok,left(nullif(trim(p_notiz),''),2000),v_positionen
  ) returning id into v_receiving_id;

  if p_order_list_id is not null then
    update public.order_lists set status='geliefert',geliefert_am=now(),updated_at=now()
    where id=p_order_list_id;
  end if;
  return v_receiving_id;
exception when no_data_found then
  raise exception 'open inventory order not found';
end $function$;

revoke all on function public.record_inventory_receiving(uuid,uuid,uuid,boolean,boolean,boolean,text,jsonb) from public,anon;
grant execute on function public.record_inventory_receiving(uuid,uuid,uuid,boolean,boolean,boolean,text,jsonb) to authenticated,service_role;

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

    insert into public.inventory_counts(
      session_id,item_id,"gezählt_von",ist_bestand,differenz,kommentar
    ) values(
      v_session.id,v_item.id,v_employee_id,v_count,v_count-v_before,
      left(nullif(trim(v_entry->>'comment'),''),500)
    );
    insert into public.stock_movements(
      item_id,location_id,typ,menge,vorher,nachher,referenz_typ,referenz_id,erfasst_von,notiz
    ) values(
      v_item.id,v_location_id,'inventur',v_count-v_before,v_before,v_count,
      'inventory_session',v_session.id,v_employee_id,'Blind-Count abgeschlossen'
    );
    update public.inventory_items set letzte_inventur=v_count,updated_at=now() where id=v_item.id;
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
