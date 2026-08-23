\set ON_ERROR_STOP on

begin;

do $$
declare
  v_tenant uuid;
  v_location uuid;
  v_register uuid;
  v_shift uuid;
  v_employee uuid;
  v_table uuid;
  v_item uuid;
  v_item_name text;
  v_price numeric;
  v_key uuid := gen_random_uuid();
  v_first_tx uuid;
  v_retry_tx uuid;
  v_order uuid;
  v_first_created boolean;
  v_retry_created boolean;
  v_count integer;
begin
  select s.tenant_id, s.location_id, s.register_id, s.id, s.employee_id
    into v_tenant, v_location, v_register, v_shift, v_employee
  from public.pos_shifts s
  join public.pos_registers r on r.id = s.register_id and r.aktiv
  where s.status = 'offen'
  order by s.start_at desc
  limit 1;

  select t.id into v_table
  from public.restaurant_tables t
  where t.tenant_id = v_tenant and t.location_id = v_location and t.aktiv
  order by t.id limit 1;

  select i.id, i.name, i.preis
    into v_item, v_item_name, v_price
  from public.menu_items i
  where i.tenant_id = v_tenant and i.location_id = v_location and i.verfuegbar
  order by i.id limit 1;

  if v_shift is null or v_table is null or v_item is null then
    raise exception '083 test requires an open POS shift, active table and available item';
  end if;

  select transaction_id, order_id, was_created
    into v_first_tx, v_order, v_first_created
  from public.create_pos_sale_atomic(
    v_tenant, v_location, v_register, v_shift, v_employee, v_table,
    'table', 'bar',
    jsonb_build_array(jsonb_build_object(
      'id', v_item, 'name', v_item_name, 'quantity', 1,
      'unitPrice', v_price, 'taxRate', 19,
      'note', '', 'selections', '{}'::jsonb
    )),
    v_price, 0, v_price, v_price, true, v_key, '{}'::jsonb
  );

  select transaction_id, was_created
    into v_retry_tx, v_retry_created
  from public.create_pos_sale_atomic(
    v_tenant, v_location, v_register, v_shift, v_employee, v_table,
    'table', 'bar',
    jsonb_build_array(jsonb_build_object(
      'id', v_item, 'name', v_item_name, 'quantity', 1,
      'unitPrice', v_price, 'taxRate', 19,
      'note', '', 'selections', '{}'::jsonb
    )),
    v_price, 0, v_price, v_price, true, v_key, '{}'::jsonb
  );

  if not v_first_created or v_retry_created or v_first_tx <> v_retry_tx then
    raise exception 'POS retry was not idempotent';
  end if;

  select count(*) into v_count from public.pos_transactions
  where tenant_id = v_tenant and pos_sale_idempotency_key = v_key;
  if v_count <> 1 then raise exception 'expected one POS transaction, got %', v_count; end if;

  select count(*) into v_count from public.pos_transaction_items where transaction_id = v_first_tx;
  if v_count <> 1 then raise exception 'expected one POS transaction item, got %', v_count; end if;

  select count(*) into v_count from public.order_items where order_id = v_order;
  if v_count <> 1 then raise exception 'expected one kitchen order item, got %', v_count; end if;

  begin
    perform * from public.create_pos_sale_atomic(
      v_tenant, v_location, v_register, v_shift, v_employee, v_table,
      'table', 'bar',
      jsonb_build_array(jsonb_build_object(
        'id', v_item, 'name', v_item_name, 'quantity', 1,
        'unitPrice', v_price, 'taxRate', 19,
        'note', '', 'selections', '{}'::jsonb
      )),
      v_price + 1, 0, v_price + 1, v_price + 1, true, gen_random_uuid(), '{}'::jsonb
    );
    raise exception 'subtotal mismatch was accepted';
  exception when others then
    if sqlerrm = 'subtotal mismatch was accepted' then raise; end if;
  end;

  if has_function_privilege(
    'anon',
    'public.create_pos_sale_atomic(uuid,uuid,uuid,uuid,uuid,uuid,text,text,jsonb,numeric,numeric,numeric,numeric,boolean,uuid,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.create_pos_sale_atomic(uuid,uuid,uuid,uuid,uuid,uuid,text,text,jsonb,numeric,numeric,numeric,numeric,boolean,uuid,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'browser roles can execute POS sale function';
  end if;
end $$;

rollback;
