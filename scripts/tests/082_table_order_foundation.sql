\set ON_ERROR_STOP on

begin;

do $$
declare
  v_tenant uuid;
  v_location uuid;
  v_table uuid;
  v_item uuid;
  v_item_name text;
  v_price numeric;
  v_key uuid := gen_random_uuid();
  v_first_order uuid;
  v_retry_order uuid;
  v_first_created boolean;
  v_retry_created boolean;
  v_count integer;
begin
  select t.tenant_id, t.location_id, t.id
    into v_tenant, v_location, v_table
  from public.restaurant_tables t
  where t.aktiv
  order by t.id
  limit 1;

  select i.id, i.name, i.preis
    into v_item, v_item_name, v_price
  from public.menu_items i
  where i.tenant_id = v_tenant
    and i.location_id = v_location
    and i.verfuegbar
  order by i.id
  limit 1;

  if v_table is null or v_item is null then
    raise exception '082 test requires one active table and available menu item';
  end if;

  select order_id, was_created
    into v_first_order, v_first_created
  from public.create_table_order_atomic(
    v_tenant,
    v_location,
    v_table,
    'bar',
    v_price,
    jsonb_build_array(jsonb_build_object(
      'id', v_item,
      'name', v_item_name,
      'quantity', 1,
      'unitPrice', v_price,
      'note', '',
      'selections', '{}'::jsonb
    )),
    v_key
  );

  select order_id, was_created
    into v_retry_order, v_retry_created
  from public.create_table_order_atomic(
    v_tenant,
    v_location,
    v_table,
    'bar',
    v_price,
    jsonb_build_array(jsonb_build_object(
      'id', v_item,
      'name', v_item_name,
      'quantity', 1,
      'unitPrice', v_price,
      'note', '',
      'selections', '{}'::jsonb
    )),
    v_key
  );

  if not v_first_created or v_retry_created or v_first_order <> v_retry_order then
    raise exception 'table order retry was not idempotent';
  end if;

  select count(*) into v_count
  from public.customer_orders
  where tenant_id = v_tenant
    and table_order_idempotency_key = v_key;
  if v_count <> 1 then
    raise exception 'expected exactly one customer order, got %', v_count;
  end if;

  select count(*) into v_count
  from public.order_items
  where order_id = v_first_order;
  if v_count <> 1 then
    raise exception 'expected exactly one order item, got %', v_count;
  end if;

  if has_function_privilege(
    'anon',
    'public.create_table_order_atomic(uuid,uuid,uuid,text,numeric,jsonb,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.create_table_order_atomic(uuid,uuid,uuid,text,numeric,jsonb,uuid)',
    'EXECUTE'
  ) then
    raise exception 'browser roles can execute table order function';
  end if;
end $$;

rollback;
