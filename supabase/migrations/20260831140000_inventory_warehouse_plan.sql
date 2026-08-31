begin;

alter table public.inventory_shelves add column if not exists parent_shelf_id uuid references public.inventory_shelves(id) on delete restrict;
alter table public.inventory_shelves add column if not exists place_kind text not null default 'place';
alter table public.inventory_shelves add column if not exists unit_type text;
alter table public.inventory_shelves add column if not exists qr_token uuid not null default gen_random_uuid();
alter table public.inventory_shelves add column if not exists last_checked_at timestamptz;
alter table public.inventory_shelves add column if not exists last_checked_by uuid references public.employees(id) on delete set null;

create unique index if not exists inventory_shelves_qr_token_uidx on public.inventory_shelves(qr_token);
create index if not exists inventory_shelves_parent_idx on public.inventory_shelves(parent_shelf_id);

insert into public.inventory_shelves(area_id,name,position,beschreibung,place_kind,unit_type)
select a.id,'Bestehende Lagerplätze',0,'Automatisch aus der bisherigen flachen Lagerstruktur übernommen.','unit','regal'
from public.inventory_areas a
where exists(select 1 from public.inventory_shelves s where s.area_id=a.id and s.parent_shelf_id is null)
  and not exists(select 1 from public.inventory_shelves s where s.area_id=a.id and s.place_kind='unit' and s.name='Bestehende Lagerplätze');
update public.inventory_shelves child set parent_shelf_id=parent.id
from public.inventory_shelves parent
where child.area_id=parent.area_id and child.id<>parent.id and child.parent_shelf_id is null
  and child.place_kind='place' and parent.place_kind='unit' and parent.name='Bestehende Lagerplätze';

alter table public.inventory_shelves drop constraint if exists inventory_shelves_place_kind_check;
alter table public.inventory_shelves add constraint inventory_shelves_place_kind_check check (place_kind in ('unit','place'));
alter table public.inventory_shelves drop constraint if exists inventory_shelves_unit_type_check;
alter table public.inventory_shelves add constraint inventory_shelves_unit_type_check check (unit_type is null or unit_type in ('regal','kuehlschrank','gefrierschrank','schrank','behaelter','sonstiges'));

create or replace function public.validate_inventory_shelf_hierarchy() returns trigger
language plpgsql set search_path=public,pg_temp as $function$
declare v_parent public.inventory_shelves%rowtype;
begin
  if new.place_kind='place' and new.parent_shelf_id is null then raise exception 'inventory place requires a unit'; end if;
  if new.place_kind='unit' and new.parent_shelf_id is not null then raise exception 'inventory unit cannot have a parent'; end if;
  if new.parent_shelf_id is not null then
    if new.parent_shelf_id=new.id then raise exception 'inventory hierarchy cycle'; end if;
    select * into v_parent from public.inventory_shelves where id=new.parent_shelf_id;
    if not found or v_parent.area_id<>new.area_id or v_parent.place_kind<>'unit' then raise exception 'inventory parent is outside room or not a unit'; end if;
  end if;
  return new;
end $function$;
drop trigger if exists inventory_shelves_validate_hierarchy on public.inventory_shelves;
create trigger inventory_shelves_validate_hierarchy before insert or update of area_id,parent_shelf_id,place_kind on public.inventory_shelves for each row execute function public.validate_inventory_shelf_hierarchy();

create or replace function public.save_inventory_place_as_actor(p_id uuid,p_tenant_id uuid,p_location_id uuid,p_actor_id uuid,p_area_id uuid,p_parent_id uuid,p_name text,p_kind text,p_unit_type text,p_description text)
returns setof public.inventory_shelves language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor public.employees%rowtype; v_place public.inventory_shelves%rowtype;
begin
  select * into v_actor from public.employees where id=p_actor_id and tenant_id=p_tenant_id and status in ('aktiv','in_training','in_probe');
  if not found or v_actor.rolle not in ('manager','backoffice','admin') or (v_actor.rolle='manager' and v_actor.location_id is distinct from p_location_id) then raise exception 'actor may not manage inventory plan'; end if;
  if not exists(select 1 from public.inventory_areas a join public.locations l on l.id=a.location_id where a.id=p_area_id and l.id=p_location_id and l.tenant_id=p_tenant_id) then raise exception 'inventory room is outside location'; end if;
  if nullif(trim(p_name),'') is null or p_kind not in ('unit','place') then raise exception 'inventory place settings are invalid'; end if;
  if p_id is null then
    insert into public.inventory_shelves(area_id,parent_shelf_id,name,place_kind,unit_type,beschreibung,position)
    values(p_area_id,p_parent_id,left(trim(p_name),120),p_kind,case when p_kind='unit' then p_unit_type else null end,left(nullif(trim(p_description),''),500),coalesce((select max(position)+1 from public.inventory_shelves where area_id=p_area_id),1)) returning * into v_place;
  else
    update public.inventory_shelves set parent_shelf_id=p_parent_id,name=left(trim(p_name),120),place_kind=p_kind,unit_type=case when p_kind='unit' then p_unit_type else null end,beschreibung=left(nullif(trim(p_description),''),500)
    where id=p_id and area_id=p_area_id returning * into v_place;
    if not found then raise exception 'inventory place not found'; end if;
  end if;
  return next v_place;
end $function$;

create or replace function public.record_inventory_place_action_as_actor(p_tenant_id uuid,p_location_id uuid,p_actor_id uuid,p_place_id uuid,p_item_id uuid,p_action text,p_amount numeric,p_target_place_id uuid default null)
returns numeric language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor public.employees%rowtype; v_item public.inventory_items%rowtype; v_before numeric; v_after numeric; v_target public.inventory_shelves%rowtype;
begin
  select * into v_actor from public.employees where id=p_actor_id and tenant_id=p_tenant_id and status in ('aktiv','in_training','in_probe');
  if not found or (v_actor.rolle not in ('backoffice','admin') and v_actor.location_id is distinct from p_location_id) then raise exception 'actor is outside inventory location'; end if;
  if p_action not in ('book','withdraw','transfer','count') or p_amount<0 or (p_action<>'count' and p_amount=0) then raise exception 'inventory action is invalid'; end if;
  select i.* into v_item from public.inventory_items i join public.inventory_areas a on a.id=i.area_id join public.locations l on l.id=a.location_id join public.inventory_shelves s on s.id=p_place_id and s.area_id=a.id where i.id=p_item_id and i.shelf_id=p_place_id and s.place_kind='place' and l.id=p_location_id and l.tenant_id=p_tenant_id for update;
  if not found then raise exception 'inventory item is outside place'; end if;
  v_before:=coalesce(v_item.letzte_inventur,0);
  if p_action='book' then v_after:=v_before+p_amount; elsif p_action='withdraw' then v_after:=v_before-p_amount; elsif p_action='transfer' then v_after:=v_before; else v_after:=p_amount; end if;
  if v_after<0 then raise exception 'inventory stock cannot become negative'; end if;
  if p_action='transfer' then
    select s.* into v_target from public.inventory_shelves s join public.inventory_areas a on a.id=s.area_id join public.locations l on l.id=a.location_id where s.id=p_target_place_id and s.place_kind='place' and l.id=p_location_id and l.tenant_id=p_tenant_id;
    if not found or v_target.id=p_place_id then raise exception 'inventory transfer target is invalid'; end if;
    if p_amount<>v_before then raise exception 'the complete place stock must be transferred'; end if;
    update public.inventory_items set shelf_id=v_target.id,area_id=v_target.area_id,letzte_inventur=v_after,updated_at=now() where id=v_item.id;
  else update public.inventory_items set letzte_inventur=v_after,updated_at=now() where id=v_item.id; end if;
  if p_action='transfer' then
    insert into public.stock_movements(item_id,location_id,typ,menge,vorher,nachher,referenz_typ,referenz_id,erfasst_von,notiz) values
      (v_item.id,p_location_id,'umlagerung',-p_amount,v_before,0,'inventory_shelf',p_place_id,p_actor_id,'Umlagerung Ausgang nach '||v_target.name),
      (v_item.id,p_location_id,'umlagerung',p_amount,0,v_before,'inventory_shelf',v_target.id,p_actor_id,'Umlagerung Eingang von '||p_place_id::text);
  else
    insert into public.stock_movements(item_id,location_id,typ,menge,vorher,nachher,referenz_typ,referenz_id,erfasst_von,notiz)
    values(v_item.id,p_location_id,case p_action when 'book' then 'zugang' when 'withdraw' then 'entnahme' else 'inventur' end,v_after-v_before,v_before,v_after,'inventory_shelf',p_place_id,p_actor_id,'Lagerplatz-Scan');
  end if;
  update public.inventory_shelves set last_checked_at=now(),last_checked_by=p_actor_id where id=p_place_id or id=p_target_place_id;
  return v_after;
end $function$;

revoke all on function public.save_inventory_place_as_actor(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.save_inventory_place_as_actor(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,text) to service_role;
revoke all on function public.record_inventory_place_action_as_actor(uuid,uuid,uuid,uuid,uuid,text,numeric,uuid) from public,anon,authenticated;
grant execute on function public.record_inventory_place_action_as_actor(uuid,uuid,uuid,uuid,uuid,text,numeric,uuid) to service_role;
revoke all on function public.validate_inventory_shelf_hierarchy() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
