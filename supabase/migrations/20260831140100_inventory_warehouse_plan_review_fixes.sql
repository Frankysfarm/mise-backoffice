begin;

create or replace function public.delete_inventory_place_as_actor(p_id uuid,p_tenant_id uuid,p_location_id uuid,p_actor_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor public.employees%rowtype;
begin
  select * into v_actor from public.employees where id=p_actor_id and tenant_id=p_tenant_id and status in ('aktiv','in_training','in_probe');
  if not found or v_actor.rolle not in ('manager','backoffice','admin') or (v_actor.rolle='manager' and v_actor.location_id is distinct from p_location_id) then raise exception 'actor may not manage inventory plan'; end if;
  if exists(select 1 from public.inventory_items where shelf_id=p_id and aktiv=true) then raise exception 'inventory place not found or still in use'; end if;
  delete from public.inventory_shelves s using public.inventory_areas a,public.locations l
  where s.id=p_id and a.id=s.area_id and l.id=a.location_id and l.id=p_location_id and l.tenant_id=p_tenant_id;
  if not found then raise exception 'inventory place not found or still in use'; end if;
exception when foreign_key_violation then
  raise exception 'inventory place not found or still in use';
end $function$;

create or replace function public.record_inventory_place_action_as_actor(p_tenant_id uuid,p_location_id uuid,p_actor_id uuid,p_place_id uuid,p_item_id uuid,p_action text,p_amount numeric,p_target_place_id uuid default null)
returns numeric language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor public.employees%rowtype; v_item public.inventory_items%rowtype; v_before numeric; v_after numeric; v_target public.inventory_shelves%rowtype; v_source public.inventory_shelves%rowtype; v_session_id uuid;
begin
  select * into v_actor from public.employees where id=p_actor_id and tenant_id=p_tenant_id and status in ('aktiv','in_training','in_probe');
  if not found or (v_actor.rolle not in ('backoffice','admin') and v_actor.location_id is distinct from p_location_id) then raise exception 'actor is outside inventory location'; end if;
  if p_action not in ('book','withdraw','transfer','count') or p_amount is null or p_amount<0 or (p_action<>'count' and p_amount=0) then raise exception 'inventory action is invalid'; end if;
  select i.* into v_item from public.inventory_items i join public.inventory_areas a on a.id=i.area_id join public.locations l on l.id=a.location_id join public.inventory_shelves s on s.id=p_place_id and s.area_id=a.id where i.id=p_item_id and i.shelf_id=p_place_id and s.place_kind='place' and l.id=p_location_id and l.tenant_id=p_tenant_id for update;
  if not found then raise exception 'inventory item is outside place'; end if;
  v_before:=coalesce(v_item.letzte_inventur,0);
  if p_action='book' then v_after:=v_before+p_amount; elsif p_action='withdraw' then v_after:=v_before-p_amount; elsif p_action='transfer' then v_after:=v_before; else v_after:=p_amount; end if;
  if v_after<0 then raise exception 'inventory stock cannot become negative'; end if;
  select * into v_source from public.inventory_shelves where id=p_place_id;
  if p_action='transfer' then
    select s.* into v_target from public.inventory_shelves s join public.inventory_areas a on a.id=s.area_id join public.locations l on l.id=a.location_id where s.id=p_target_place_id and s.place_kind='place' and l.id=p_location_id and l.tenant_id=p_tenant_id;
    if not found or v_target.id=p_place_id then raise exception 'inventory transfer target is invalid'; end if;
    if p_amount<>v_before then raise exception 'the complete place stock must be transferred'; end if;
    update public.inventory_items set shelf_id=v_target.id,area_id=v_target.area_id,letzte_inventur=v_after,updated_at=now() where id=v_item.id;
  elsif p_action<>'count' then update public.inventory_items set letzte_inventur=v_after,updated_at=now() where id=v_item.id; end if;
  if p_action='transfer' then
    insert into public.stock_movements(item_id,location_id,typ,menge,vorher,nachher,referenz_typ,referenz_id,erfasst_von,notiz) values
      (v_item.id,p_location_id,'transfer',0,v_before,v_after,'inventory_shelf',p_place_id,p_actor_id,'Umlagerung Ausgang nach '||v_target.name),
      (v_item.id,p_location_id,'transfer',0,v_before,v_after,'inventory_shelf',v_target.id,p_actor_id,'Umlagerung Eingang von '||v_source.name);
  elsif p_action='count' then
    insert into public.inventory_sessions(location_id,area_id,assigned_to,gestartet_von,typ,notiz)
    values(p_location_id,v_item.area_id,p_actor_id,p_actor_id,'spontan','QR-Zählung am Lagerplatz '||v_source.name)
    returning id into v_session_id;
    insert into public.inventory_counts(session_id,item_id,"gezählt_von",ist_bestand,differenz,kommentar)
    values(v_session_id,v_item.id,p_actor_id,p_amount,p_amount-v_before,'QR-Zählung am Lagerplatz '||v_source.name);
    update public.inventory_sessions set abgeschlossen_am=now(),ergebnis=jsonb_build_array(jsonb_build_object('item_id',v_item.id,'count',p_amount)) where id=v_session_id;
  else
    insert into public.stock_movements(item_id,location_id,typ,menge,vorher,nachher,referenz_typ,referenz_id,erfasst_von,notiz)
    values(v_item.id,p_location_id,(case p_action when 'book' then 'eingang' else 'ausgang' end)::public.movement_type,v_after-v_before,v_before,v_after,'inventory_shelf',p_place_id,p_actor_id,'Lagerplatz-Scan');
  end if;
  update public.inventory_shelves set last_checked_at=now(),last_checked_by=p_actor_id where id=p_place_id or id=p_target_place_id;
  return v_after;
end $function$;

revoke all on function public.delete_inventory_place_as_actor(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_inventory_place_as_actor(uuid,uuid,uuid,uuid) to service_role;
revoke all on function public.record_inventory_place_action_as_actor(uuid,uuid,uuid,uuid,uuid,text,numeric,uuid) from public,anon,authenticated;
grant execute on function public.record_inventory_place_action_as_actor(uuid,uuid,uuid,uuid,uuid,text,numeric,uuid) to service_role;
notify pgrst,'reload schema';
commit;
