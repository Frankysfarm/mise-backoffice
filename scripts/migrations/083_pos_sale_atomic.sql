-- 083_pos_sale_atomic.sql
-- Atomic, idempotent POS sale for authenticated restaurant shifts.

begin;

alter table public.pos_transactions
  add column if not exists pos_sale_idempotency_key uuid;

create unique index if not exists ux_pos_transactions_tenant_idempotency
  on public.pos_transactions (tenant_id, pos_sale_idempotency_key)
  where pos_sale_idempotency_key is not null;

create or replace function public.create_pos_sale_atomic(
  p_tenant_id uuid,
  p_location_id uuid,
  p_register_id uuid,
  p_shift_id uuid,
  p_employee_id uuid,
  p_table_id uuid,
  p_fulfillment text,
  p_payment_method text,
  p_items jsonb,
  p_subtotal numeric,
  p_tip numeric,
  p_payment_total numeric,
  p_cash_given numeric,
  p_training boolean,
  p_idempotency_key uuid,
  p_tse jsonb default '{}'::jsonb
)
returns table (
  transaction_id uuid,
  order_id uuid,
  order_number text,
  bon_token text,
  bon_number text,
  was_created boolean
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_existing public.pos_transactions%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_transaction_id uuid;
  v_bon_token text;
  v_bon_number text;
  v_table_number text;
  v_item_count integer;
  v_available_count integer;
  v_calculated_subtotal numeric;
  v_tax_7 numeric := 0;
  v_tax_19 numeric := 0;
  v_tax_total numeric := 0;
  v_net_total numeric := 0;
  v_change numeric := 0;
  v_order_items_json jsonb;
  v_bon_data jsonb;
begin
  if p_tenant_id is null
     or p_location_id is null
     or p_register_id is null
     or p_shift_id is null
     or p_employee_id is null
     or p_idempotency_key is null then
    raise exception 'Missing POS sale identity';
  end if;

  if p_fulfillment not in ('table', 'counter', 'takeaway') then
    raise exception 'Invalid POS fulfillment';
  end if;
  if p_fulfillment = 'table' and p_table_id is null then
    raise exception 'Table sale requires a table';
  end if;
  if p_payment_method not in ('bar', 'karte') then
    raise exception 'Invalid POS payment method';
  end if;
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 100 then
    raise exception 'Invalid POS sale items';
  end if;
  if jsonb_typeof(coalesce(p_tse, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid POS TSE payload';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pos-sale:' || p_tenant_id::text || ':' || p_idempotency_key::text, 0)
  );

  select * into v_existing
  from public.pos_transactions tx
  where tx.tenant_id = p_tenant_id
    and tx.pos_sale_idempotency_key = p_idempotency_key;

  if found then
    select o.bestellnummer::text
      into v_order_number
    from public.customer_orders o
    where o.id = v_existing.customer_order_id;
    return query select
      v_existing.id,
      v_existing.customer_order_id,
      v_order_number,
      v_existing.bon_token::text,
      v_existing.bon_nummer::text,
      false;
    return;
  end if;

  if not exists (
    select 1
    from public.employees e
    where e.id = p_employee_id
      and e.tenant_id = p_tenant_id
      and e.location_id = p_location_id
  ) then
    raise exception 'Employee is not assigned to tenant and location';
  end if;

  if not exists (
    select 1
    from public.pos_registers r
    join public.locations l on l.id = r.location_id
    where r.id = p_register_id
      and r.location_id = p_location_id
      and l.tenant_id = p_tenant_id
      and r.aktiv
  ) then
    raise exception 'Register is not active for tenant and location';
  end if;

  if not exists (
    select 1
    from public.pos_shifts s
    where s.id = p_shift_id
      and s.tenant_id = p_tenant_id
      and s.location_id = p_location_id
      and s.register_id = p_register_id
      and s.employee_id = p_employee_id
      and s.status = 'offen'
  ) then
    raise exception 'POS shift is not open for employee and register';
  end if;

  if p_table_id is not null then
    select t.nummer::text
      into v_table_number
    from public.restaurant_tables t
    where t.id = p_table_id
      and t.tenant_id = p_tenant_id
      and t.location_id = p_location_id
      and t.aktiv;
    if v_table_number is null then
      raise exception 'Table is not active for tenant and location';
    end if;
  end if;

  begin
    select
      count(*),
      round(coalesce(sum((entry->>'unitPrice')::numeric * (entry->>'quantity')::integer), 0), 2),
      round(coalesce(sum(case when (entry->>'taxRate')::integer = 7 then
        ((entry->>'unitPrice')::numeric * (entry->>'quantity')::integer)
        - (((entry->>'unitPrice')::numeric * (entry->>'quantity')::integer) / 1.07)
      else 0 end), 0), 2),
      round(coalesce(sum(case when (entry->>'taxRate')::integer = 19 then
        ((entry->>'unitPrice')::numeric * (entry->>'quantity')::integer)
        - (((entry->>'unitPrice')::numeric * (entry->>'quantity')::integer) / 1.19)
      else 0 end), 0), 2)
      into v_item_count, v_calculated_subtotal, v_tax_7, v_tax_19
    from jsonb_array_elements(p_items) entry;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Invalid POS item values';
  end;

  if exists (
    select 1
    from jsonb_array_elements(p_items) entry
    where coalesce((entry->>'quantity')::integer, 0) not between 1 and 50
       or coalesce((entry->>'unitPrice')::numeric, 0) not between 0.01 and 500
       or coalesce((entry->>'taxRate')::integer, 0) not in (7, 19)
       or length(btrim(coalesce(entry->>'name', ''))) not between 1 and 255
       or length(coalesce(entry->>'note', '')) > 500
       or jsonb_typeof(coalesce(entry->'selections', '{}'::jsonb)) <> 'object'
  ) then
    raise exception 'Invalid POS item payload';
  end if;

  select count(*) into v_available_count
  from jsonb_array_elements(p_items) entry
  join public.menu_items item
    on item.id = (entry->>'id')::uuid
   and item.tenant_id = p_tenant_id
   and item.location_id = p_location_id
   and item.verfuegbar;

  if v_item_count <> v_available_count then
    raise exception 'POS sale contains unavailable items';
  end if;
  if round(p_subtotal, 2) <> v_calculated_subtotal then
    raise exception 'POS subtotal mismatch';
  end if;
  if coalesce(p_tip, 0) < 0 or coalesce(p_tip, 0) > 500 then
    raise exception 'Invalid POS tip';
  end if;
  if round(p_payment_total, 2) <> round(v_calculated_subtotal + coalesce(p_tip, 0), 2)
     or p_payment_total < 0.50
     or p_payment_total > 10000 then
    raise exception 'POS payment total mismatch';
  end if;
  if p_payment_method = 'bar' and coalesce(p_cash_given, 0) < p_payment_total then
    raise exception 'Cash received is below payment total';
  end if;

  v_tax_total := round(v_tax_7 + v_tax_19, 2);
  v_net_total := round(v_calculated_subtotal - v_tax_total, 2);
  v_change := case when p_payment_method = 'bar'
    then round(coalesce(p_cash_given, 0) - p_payment_total, 2)
    else 0 end;

  select jsonb_agg(jsonb_build_object(
    'id', entry->>'id',
    'name', entry->>'name',
    'qty', (entry->>'quantity')::integer,
    'priceCents', round((entry->>'unitPrice')::numeric * (entry->>'quantity')::integer * 100)::integer
  )) into v_order_items_json
  from jsonb_array_elements(p_items) entry;

  insert into public.customer_orders (
    tenant_id, location_id, tisch_id, kellner_id, typ, status, kunde_name,
    zwischensumme, gesamtbetrag, zahlungsart, bezahlt, bestellt_am,
    bestaetigt_am, geschaetzte_zubereitung_min, order_channel
  ) values (
    p_tenant_id, p_location_id, p_table_id, p_employee_id,
    case when p_fulfillment in ('table', 'counter') then 'vor_ort' else 'abholung' end,
    'neu',
    case
      when p_fulfillment = 'table' then 'Tisch ' || v_table_number
      when p_fulfillment = 'counter' then 'POS-Theke'
      else 'POS-Abholung'
    end,
    v_calculated_subtotal, v_calculated_subtotal, p_payment_method, true, now(), now(),
    greatest(5, v_item_count * 3), 'pos'
  )
  returning id, bestellnummer::text into v_order_id, v_order_number;

  insert into public.order_items (
    order_id, menu_item_id, name, menge, einzelpreis, gesamtpreis, extras, notiz
  )
  select
    v_order_id,
    (entry->>'id')::uuid,
    left(entry->>'name', 255),
    (entry->>'quantity')::integer,
    (entry->>'unitPrice')::numeric,
    round((entry->>'unitPrice')::numeric * (entry->>'quantity')::integer, 2),
    jsonb_build_object('selections', coalesce(entry->'selections', '{}'::jsonb)),
    nullif(left(btrim(coalesce(entry->>'note', '')), 500), '')
  from jsonb_array_elements(p_items) entry;

  v_bon_data := jsonb_build_object(
    'source', 'pos-v5',
    'order_number', v_order_number,
    'positionen', v_order_items_json,
    'netto', v_net_total,
    'mwst', jsonb_build_object('7%', v_tax_7, '19%', v_tax_19),
    'brutto', v_calculated_subtotal,
    'trinkgeld', round(coalesce(p_tip, 0), 2),
    'zahlbetrag', round(p_payment_total, 2),
    'gegeben', case when p_payment_method = 'bar' then round(p_cash_given, 2) else null end,
    'rueckgeld', case when p_payment_method = 'bar' then v_change else null end
  );

  insert into public.pos_transactions as tx (
    tenant_id, location_id, register_id, shift_id, customer_order_id, tisch_id,
    typ, mitarbeiter_id, brutto_gesamt, netto_gesamt, mwst_gesamt, mwst_7,
    mwst_19, zahlungsart, bezahlt_betrag, gegeben, rueckgeld, trainingsbon,
    bon_data, pos_sale_idempotency_key,
    tse_transaction_id, tse_signature, tse_signature_counter, tse_start_time,
    tse_end_time, tse_serial, qr_code_data
  ) values (
    p_tenant_id, p_location_id, p_register_id, p_shift_id, v_order_id, p_table_id,
    'verkauf', p_employee_id, v_calculated_subtotal, v_net_total, v_tax_total,
    v_tax_7, v_tax_19, p_payment_method, p_payment_total,
    case when p_payment_method = 'bar' then p_cash_given else null end,
    case when p_payment_method = 'bar' then v_change else null end,
    coalesce(p_training, false), v_bon_data, p_idempotency_key,
    nullif(p_tse->>'tse_transaction_id', ''),
    nullif(p_tse->>'tse_signature', ''),
    nullif(p_tse->>'tse_signature_counter', '')::bigint,
    nullif(p_tse->>'tse_start_time', '')::timestamptz,
    nullif(p_tse->>'tse_end_time', '')::timestamptz,
    nullif(p_tse->>'tse_serial', ''),
    nullif(p_tse->>'qr_code_data', '')
  )
  returning tx.id, tx.bon_token::text, tx.bon_nummer::text
    into v_transaction_id, v_bon_token, v_bon_number;

  insert into public.pos_transaction_items (
    transaction_id, menu_item_id, name, menge, einzelpreis_netto,
    einzelpreis_brutto, mwst_satz, mwst_betrag, gesamt_brutto
  )
  select
    v_transaction_id,
    (entry->>'id')::uuid,
    left(entry->>'name', 255),
    (entry->>'quantity')::integer,
    round((entry->>'unitPrice')::numeric / (1 + ((entry->>'taxRate')::numeric / 100)), 2),
    (entry->>'unitPrice')::numeric,
    (entry->>'taxRate')::numeric,
    round(
      ((entry->>'unitPrice')::numeric * (entry->>'quantity')::integer)
      - (((entry->>'unitPrice')::numeric * (entry->>'quantity')::integer)
        / (1 + ((entry->>'taxRate')::numeric / 100))),
      2
    ),
    round((entry->>'unitPrice')::numeric * (entry->>'quantity')::integer, 2)
  from jsonb_array_elements(p_items) entry;

  return query select
    v_transaction_id, v_order_id, v_order_number, v_bon_token, v_bon_number, true;
end;
$$;

revoke all on function public.create_pos_sale_atomic(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb,
  numeric, numeric, numeric, numeric, boolean, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.create_pos_sale_atomic(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb,
  numeric, numeric, numeric, numeric, boolean, uuid, jsonb
) to service_role;

commit;
