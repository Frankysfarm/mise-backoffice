\set ON_ERROR_STOP on

begin;
alter table public.menu_items add column if not exists category_id uuid;
create table if not exists public.kitchen_stations (
  id uuid primary key,
  tenant_id uuid not null,
  location_id uuid not null,
  name text not null,
  aktiv boolean not null default true,
  sort_order integer not null default 0
);
create table if not exists public.station_category_routing (
  station_id uuid not null,
  category_id uuid not null
);


do $$
declare
  v_tenant uuid;
  v_location uuid;
  v_register uuid;
  v_shift uuid;
  v_employee uuid;
  v_table uuid;
  v_category uuid := gen_random_uuid();
  v_station uuid := gen_random_uuid();
  v_menu_item uuid;
  v_item_name text;
  v_price_cents integer;
  v_session uuid;
  v_transaction uuid;
  v_order uuid;
  v_total integer;
  v_remaining integer;
  v_lines jsonb;
  v_item_one uuid;
  v_item_two uuid;
  v_attempt uuid;
  v_attempt_amount integer;
  v_provider_ref text := 'sumup-split-qa-' || gen_random_uuid()::text;
  v_payment_key uuid;
  v_completed boolean;
  v_was_confirmed boolean;
  v_count integer;
  v_status text;
begin
  select s.tenant_id, s.location_id, s.register_id, s.id, s.employee_id
    into v_tenant, v_location, v_register, v_shift, v_employee
  from public.pos_shifts s join public.pos_registers r on r.id = s.register_id and r.aktiv
  where s.status = 'offen' order by s.start_at desc limit 1;

  select t.id into v_table from public.restaurant_tables t
  where t.tenant_id = v_tenant and t.location_id = v_location and t.aktiv
  order by t.id limit 1;

  select i.id, i.name, round(i.preis * 100)::integer
    into v_menu_item, v_item_name, v_price_cents
  from public.menu_items i
  where i.tenant_id = v_tenant and i.location_id = v_location and i.verfuegbar
    and round(i.preis * 100)::integer > 0
  order by i.id limit 1;

  if v_shift is null or v_table is null or v_menu_item is null then
    raise exception '085 test requires open shift, active table and item';
  end if;
  insert into public.kitchen_stations (id, tenant_id, location_id, name, aktiv, sort_order)
  values (v_station, v_tenant, v_location, 'Split QA Küche', true, 1);
  update public.menu_items set category_id = v_category where id = v_menu_item;
  insert into public.station_category_routing (station_id, category_id)
  values (v_station, v_category);


  select split_session_id, transaction_id, order_id, total_cents, remaining_cents, line_items
    into v_session, v_transaction, v_order, v_total, v_remaining, v_lines
  from public.create_pos_split_sale_085(
    v_tenant, v_location, v_register, v_shift, v_employee, v_table, 'table',
    jsonb_build_array(
      jsonb_build_object('id', v_menu_item, 'name', v_item_name || ' A', 'quantity', 1,
        'unitPriceCents', v_price_cents, 'taxRate', 19, 'note', '', 'selections', '{}'::jsonb, 'seat', 1),
      jsonb_build_object('id', v_menu_item, 'name', v_item_name || ' B', 'quantity', 1,
        'unitPriceCents', v_price_cents, 'taxRate', 19, 'note', '', 'selections', '{}'::jsonb, 'seat', 2),
      jsonb_build_object('id', v_menu_item, 'name', v_item_name || ' C', 'quantity', 1,
        'unitPriceCents', v_price_cents, 'taxRate', 19, 'note', '', 'selections', '{}'::jsonb, 'seat', 3)
    ),
    v_price_cents * 3, 0, true, gen_random_uuid()
  );

  if v_total <> v_price_cents * 3 or v_remaining <> v_total or jsonb_array_length(v_lines) <> 3 then
    raise exception 'split creation did not preserve exact integer cents';
  end if;
  select (v_lines->0->>'id')::uuid, (v_lines->1->>'id')::uuid into v_item_one, v_item_two;

  if (select bezahlt from public.customer_orders where id = v_order) is distinct from false then
    raise exception 'unpaid split order was released';
  end if;
  if exists (select 1 from public.kitchen_tickets where order_id = v_order) then
    raise exception 'unpaid split order has a kitchen ticket';
  end if;

  begin
    perform * from public.prepare_pos_split_payment_085(
      v_tenant, v_location, v_register, v_shift, v_employee, v_session,
      'sumup', 'amount', v_total + 1, '[]'::jsonb, null, gen_random_uuid()
    );
    raise exception 'overpayment was accepted';
  exception when others then
    if sqlerrm <> 'Split payment exceeds remaining total' then raise; end if;
  end;

  begin
    perform * from public.prepare_pos_split_payment_085(
      v_tenant, v_location, v_register, v_shift, v_employee, v_session,
      'sumup', 'amount', 0, '[]'::jsonb, null, gen_random_uuid()
    );
    raise exception 'zero payment was accepted';
  exception when others then
    if sqlerrm <> 'Split payment must be positive' then raise; end if;
  end;

  v_payment_key := gen_random_uuid();
  select completed, was_confirmed, remaining_cents
    into v_completed, v_was_confirmed, v_remaining
  from public.record_pos_split_cash_085(
    v_tenant, v_location, v_register, v_shift, v_employee, v_session,
    'amount', v_price_cents, '[]'::jsonb, null, v_price_cents + 100, v_payment_key
  );
  if v_completed or not v_was_confirmed or v_remaining <> v_price_cents * 2 then
    raise exception 'free cash partial payment is incorrect';
  end if;

  select completed, was_confirmed, remaining_cents
    into v_completed, v_was_confirmed, v_remaining
  from public.record_pos_split_cash_085(
    v_tenant, v_location, v_register, v_shift, v_employee, v_session,
    'amount', v_price_cents, '[]'::jsonb, null, v_price_cents + 100, v_payment_key
  );
  if v_completed or v_was_confirmed or v_remaining <> v_price_cents * 2 then
    raise exception 'cash retry was not idempotent';
  end if;
  begin
    perform * from public.record_pos_split_cash_085(
      v_tenant, v_location, v_register, v_shift, v_employee, v_session,
      'amount', v_price_cents, '[]'::jsonb, null, v_price_cents + 101, v_payment_key
    );
    raise exception 'changed idempotent cash payload was accepted';
  exception when others then
    if sqlerrm <> 'Split payment idempotency key conflict' then raise; end if;
  end;

  if exists (select 1 from public.kitchen_tickets where order_id = v_order) then
    raise exception 'partial cash payment released kitchen';
  end if;

  select payment_attempt_id, amount_cents
    into v_attempt, v_attempt_amount
  from public.prepare_pos_split_payment_085(
    v_tenant, v_location, v_register, v_shift, v_employee, v_session,
    'sumup', 'items', 0, jsonb_build_array(v_item_two), null, gen_random_uuid()
  );
  if v_attempt_amount <> v_price_cents then raise exception 'item allocation amount mismatch'; end if;
  perform public.attach_pos_split_provider_085(
    v_tenant, v_location, v_register, v_shift, v_employee, v_attempt, v_provider_ref
  );
  select completed, remaining_cents into v_completed, v_remaining
  from public.confirm_pos_split_payment_085(
    v_tenant, v_location, v_register, v_shift, v_employee, v_attempt, v_provider_ref
  );
  if v_completed or v_remaining <> v_price_cents then
    raise exception 'provider item partial payment is incorrect';
  end if;

  begin
    perform * from public.prepare_pos_split_payment_085(
      v_tenant, v_location, v_register, v_shift, v_employee, v_session,
      'sumup', 'items', 0, jsonb_build_array(v_item_two), null, gen_random_uuid()
    );
    raise exception 'duplicate item allocation was accepted';
  exception when others then
    if sqlerrm <> 'Split item allocation is unavailable' then raise; end if;
  end;

  if exists (select 1 from public.kitchen_tickets where order_id = v_order) then
    raise exception 'provider partial payment released kitchen';
  end if;

  select completed, remaining_cents into v_completed, v_remaining
  from public.record_pos_split_cash_085(
    v_tenant, v_location, v_register, v_shift, v_employee, v_session,
    'seat', 0, '[]'::jsonb, 3, v_price_cents, gen_random_uuid()
  );
  if not v_completed or v_remaining <> 0 then raise exception 'seat payment did not complete exact total'; end if;

  select status into v_status from public.pos_split_sessions where id = v_session;
  if v_status <> 'paid' or (select bezahlt from public.customer_orders where id = v_order) is distinct from true
     or (select zahlungsart from public.customer_orders where id = v_order) <> 'split' then
    raise exception 'completed split did not atomically release order';
  end if;
  select count(*) into v_count from public.kitchen_tickets where order_id = v_order;
  if v_count <> 1 then raise exception 'expected exactly one kitchen ticket, got %', v_count; end if;
  select count(*) into v_count from public.kitchen_ticket_items kti
    join public.kitchen_tickets kt on kt.id = kti.ticket_id where kt.order_id = v_order;
  if v_count <> 3 then raise exception 'expected three kitchen items, got %', v_count; end if;
  select count(*) into v_count from public.kitchen_ticket_events e
    join public.kitchen_tickets kt on kt.id = e.ticket_id
    where kt.order_id = v_order and e.event_type = 'enqueued';
  if v_count <> 1 then raise exception 'kitchen release was not exactly once'; end if;
  select count(*) into v_count from public.pos_payment_attempts
    where split_session_id = v_session and status = 'confirmed';
  if v_count <> 3 then raise exception 'expected three confirmed split payments'; end if;
  select count(*) into v_count from public.pos_payment_allocations
    where split_session_id = v_session;
  if v_count <> 3 then raise exception 'expected amount, item and seat allocations'; end if;

  if has_function_privilege('anon',
      'public.record_pos_split_cash_085(uuid,uuid,uuid,uuid,uuid,uuid,text,integer,jsonb,integer,integer,uuid)',
      'EXECUTE')
     or has_function_privilege('authenticated',
      'public.prepare_pos_split_payment_085(uuid,uuid,uuid,uuid,uuid,uuid,text,text,integer,jsonb,integer,uuid)',
      'EXECUTE') then
    raise exception 'browser roles can execute split payment functions';
  end if;
end $$;

rollback;
