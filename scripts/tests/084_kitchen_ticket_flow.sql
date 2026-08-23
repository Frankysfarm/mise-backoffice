\set ON_ERROR_STOP on

begin;

do $$
declare
  v_tenant uuid;
  v_location uuid;
  v_register uuid;
  v_shift uuid;
  v_employee uuid;
  v_item uuid;
  v_item_name text;
  v_price numeric;
  v_category uuid := gen_random_uuid();
  v_station uuid := gen_random_uuid();
  v_sale_key uuid := gen_random_uuid();
  v_order uuid;
  v_qr_order uuid;
  v_ticket uuid;
  v_card_order uuid;
  v_legacy_order uuid;
  v_collision_key uuid := gen_random_uuid();
  v_ticket_item uuid;
  v_transition_key uuid := gen_random_uuid();
  v_changed boolean;
  v_status text;
  v_order_state text;
  v_count integer;
begin
  select s.tenant_id, s.location_id, s.register_id, s.id, s.employee_id
    into v_tenant, v_location, v_register, v_shift, v_employee
  from public.pos_shifts s join public.pos_registers r on r.id = s.register_id and r.aktiv
  where s.status = 'offen' order by s.start_at desc limit 1;
  select i.id, i.name, i.preis into v_item, v_item_name, v_price
  from public.menu_items i where i.tenant_id = v_tenant and i.location_id = v_location and i.verfuegbar
  order by i.id limit 1;
  if v_shift is null or v_item is null then raise exception '084 test requires POS fixtures'; end if;

  insert into public.kitchen_stations (id, tenant_id, location_id, name, aktiv, sort_order)
  values (v_station, v_tenant, v_location, 'Testküche', true, 1);
  update public.menu_items set category_id = v_category where id = v_item;
  insert into public.station_category_routing (station_id, category_id) values (v_station, v_category);

  insert into public.customer_orders (
    tenant_id, location_id, typ, status, kunde_name, zahlungsart, bezahlt, bestellt_am, order_channel
  ) values (
    v_tenant, v_location, 'vor_ort', 'wartet_auf_zahlung', 'Tisch QA', 'bar', false, now(), 'tisch'
  ) returning id into v_qr_order;
  insert into public.order_items (order_id, menu_item_id, name, menge, einzelpreis, gesamtpreis)
  values (v_qr_order, v_item, v_item_name, 1, v_price, v_price);
  if not exists (
    select 1 from public.kitchen_tickets t join public.kitchen_ticket_items i on i.ticket_id = t.id
    where t.order_id = v_qr_order and t.source = 'qr_table' and i.station_id = v_station
  ) then raise exception 'QR cash order hook did not create routed ticket'; end if;

  -- Card table orders insert every item first, remain invisible to KDS, and
  -- enqueue exactly once in the same transaction that marks payment verified.
  insert into public.customer_orders (
    tenant_id, location_id, typ, status, kunde_name, zahlungsart, bezahlt,
    bestellt_am, order_channel
  ) values (
    v_tenant, v_location, 'vor_ort', 'wartet_auf_zahlung', 'Tisch Karte QA',
    'karte', false, now(), 'tisch'
  ) returning id into v_card_order;
  insert into public.order_items (
    order_id, menu_item_id, name, menge, einzelpreis, gesamtpreis
  ) values
    (v_card_order, v_item, v_item_name, 1, v_price, v_price),
    (v_card_order, v_item, v_item_name || ' 2', 1, v_price, v_price);
  if exists (select 1 from public.kitchen_tickets where order_id = v_card_order) then
    raise exception 'unpaid card order reached kitchen';
  end if;

  update public.customer_orders set
    bezahlt = true, status = 'neu'
  where id = v_card_order;
  select id into v_ticket from public.kitchen_tickets where order_id = v_card_order;
  if v_ticket is null
     or (select count(*) from public.kitchen_tickets where order_id = v_card_order) <> 1
     or (select count(*) from public.kitchen_ticket_items where ticket_id = v_ticket) <> 2
     or (select count(*) from public.kitchen_ticket_events
         where ticket_id = v_ticket and event_type = 'enqueued') <> 1 then
    raise exception 'paid card order did not create exactly one complete ticket';
  end if;
  update public.customer_orders set bezahlt = true where id = v_card_order;
  perform * from public.enqueue_kitchen_ticket_atomic(v_tenant, v_location, v_card_order, 'qr_table', v_card_order);
  if (select count(*) from public.kitchen_tickets where order_id = v_card_order) <> 1 then
    raise exception 'payment retry duplicated card ticket';
  end if;

  -- Legacy station state is preserved and aggregated for an active,
  -- partially-finished multi-item order.
  insert into public.customer_orders (
    tenant_id, location_id, typ, status, kunde_name, zahlungsart, bezahlt,
    bestellt_am, order_channel, zubereitung_start
  ) values (
    v_tenant, v_location, 'abholung', 'bestätigt', 'Wolt QA', 'karte', false,
    now(), 'legacy', now() - interval '10 minutes'
  ) returning id into v_legacy_order;
  insert into public.order_items (
    order_id, menu_item_id, name, menge, einzelpreis, gesamtpreis, station_status
  ) values
    (v_legacy_order, v_item, v_item_name, 1, v_price, v_price, 'fertig'),
    (v_legacy_order, v_item, v_item_name || ' offen', 1, v_price, v_price, 'offen');
  update public.customer_orders set bezahlt = true where id = v_legacy_order;
  select id into v_ticket from public.kitchen_tickets where order_id = v_legacy_order;
  if (select source from public.kitchen_tickets where id = v_ticket) <> 'legacy'
     or (select status from public.kitchen_tickets where id = v_ticket) <> 'preparing'
     or (select preparing_at from public.kitchen_tickets where id = v_ticket) is null
     or (select status from public.customer_orders where id = v_legacy_order) <> 'in_zubereitung'
     or (select count(*) from public.kitchen_ticket_items
         where ticket_id = v_ticket and status = 'ready' and ready_at is not null) <> 1 then
    raise exception 'legacy partial state was not aggregated';
  end if;

  if public.kitchen_ticket_source_084('tisch', null, null) <> 'qr_table'
     or public.kitchen_ticket_source_084('pos', null, v_employee) <> 'pos'
     or public.kitchen_ticket_source_084(null, 'uber_eats', v_employee) <> 'legacy'
     or public.kitchen_ticket_source_084('staff', null, v_employee) <> 'staff' then
    raise exception 'kitchen source classification is not deterministic';
  end if;

  perform * from public.enqueue_kitchen_ticket_atomic(
    v_tenant, v_location, v_card_order, 'qr_table', v_collision_key
  );
  begin
    perform * from public.enqueue_kitchen_ticket_atomic(
      v_tenant, v_location, v_legacy_order, 'legacy', v_collision_key
    );
    raise exception 'enqueue idempotency collision was accepted';
  exception when others then
    if sqlerrm <> 'Kitchen idempotency key conflict' then raise; end if;
  end;

  select order_id into v_order from public.create_pos_sale_atomic(
    v_tenant, v_location, v_register, v_shift, v_employee, null,
    'counter', 'bar',
    jsonb_build_array(jsonb_build_object(
      'id', v_item, 'name', v_item_name, 'quantity', 1,
      'unitPrice', v_price, 'taxRate', 19, 'note', '', 'selections', '{}'::jsonb
    )), v_price, 0, v_price, v_price, true, v_sale_key, '{}'::jsonb
  );

  select t.id into v_ticket from public.kitchen_tickets t where t.order_id = v_order;
  select i.id into v_ticket_item from public.kitchen_ticket_items i
  where i.ticket_id = v_ticket and i.station_id = v_station;
  if v_ticket is null or v_ticket_item is null
     or (select source from public.kitchen_tickets where id = v_ticket) <> 'pos'
  then raise exception 'POS hook did not create routed POS ticket'; end if;

  perform * from public.enqueue_kitchen_ticket_atomic(v_tenant, v_location, v_order, 'pos', v_order);
  select count(*) into v_count from public.kitchen_tickets where order_id = v_order;
  if v_count <> 1 then raise exception 'enqueue retry duplicated ticket'; end if;

  select was_changed, item_status into v_changed, v_status
  from public.advance_kitchen_ticket_item_atomic(
    v_tenant, v_location, v_ticket_item, v_station, v_employee, 'preparing', v_transition_key
  );
  if not v_changed or v_status <> 'preparing' then raise exception 'queued to preparing failed'; end if;
  select was_changed into v_changed from public.advance_kitchen_ticket_item_atomic(
    v_tenant, v_location, v_ticket_item, v_station, v_employee, 'preparing', v_transition_key
  );
  if v_changed then raise exception 'transition retry was not idempotent'; end if;

  begin
    perform * from public.advance_kitchen_ticket_item_atomic(
      v_tenant, v_location, v_ticket_item, v_station, v_employee, 'ready', v_transition_key
    );
    raise exception 'idempotency key conflict was accepted';
  exception when others then
    if sqlerrm <> 'Kitchen idempotency key conflict' then raise; end if;
  end;

  select ticket_status, order_status into v_status, v_order_state
  from public.advance_kitchen_ticket_item_atomic(
    v_tenant, v_location, v_ticket_item, v_station, v_employee, 'ready', gen_random_uuid()
  );
  if v_status <> 'ready' then raise exception 'ticket did not aggregate to ready'; end if;
  if (select status from public.customer_orders where id = (select order_id from public.kitchen_tickets where id = v_ticket)) <> 'fertig' then
    raise exception 'order did not advance to fertig';
  end if;

  begin
    perform * from public.advance_kitchen_ticket_item_atomic(
      v_tenant, v_location, v_ticket_item, v_station, v_employee, 'preparing', gen_random_uuid()
    );
    raise exception 'ready regression was accepted';
  exception when others then
    if sqlerrm = 'ready regression was accepted' then raise; end if;
  end;

  begin
    perform * from public.advance_kitchen_ticket_item_atomic(
      gen_random_uuid(), v_location, v_ticket_item, v_station, v_employee, 'ready', gen_random_uuid()
    );
    raise exception 'tenant mismatch was accepted';
  exception when others then
    if sqlerrm = 'tenant mismatch was accepted' then raise; end if;
  end;

  if has_function_privilege('anon', 'public.advance_kitchen_ticket_item_atomic(uuid,uuid,uuid,uuid,uuid,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.enqueue_kitchen_ticket_atomic(uuid,uuid,uuid,text,uuid)', 'EXECUTE') then
    raise exception 'browser roles can execute kitchen write RPCs';
  end if;
end $$;

rollback;
