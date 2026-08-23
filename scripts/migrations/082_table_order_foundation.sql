-- 082_table_order_foundation.sql
-- Atomic, idempotent creation of QR table orders.

begin;

alter table public.tenants
  add column if not exists qr_theme_primary text,
  add column if not exists qr_theme_accent text,
  add column if not exists qr_welcome_text text,
  add column if not exists qr_cta_label text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tenants'::regclass
      and conname = 'tenants_qr_theme_primary_check'
  ) then
    alter table public.tenants add constraint tenants_qr_theme_primary_check
      check (qr_theme_primary is null or qr_theme_primary ~ '^#[0-9A-Fa-f]{6}$');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tenants'::regclass
      and conname = 'tenants_qr_theme_accent_check'
  ) then
    alter table public.tenants add constraint tenants_qr_theme_accent_check
      check (qr_theme_accent is null or qr_theme_accent ~ '^#[0-9A-Fa-f]{6}$');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tenants'::regclass
      and conname = 'tenants_qr_welcome_text_check'
  ) then
    alter table public.tenants add constraint tenants_qr_welcome_text_check
      check (qr_welcome_text is null or length(qr_welcome_text) between 1 and 160);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tenants'::regclass
      and conname = 'tenants_qr_cta_label_check'
  ) then
    alter table public.tenants add constraint tenants_qr_cta_label_check
      check (qr_cta_label is null or length(qr_cta_label) between 1 and 48);
  end if;
end $$;

alter table public.customer_orders
  add column if not exists table_order_idempotency_key uuid;

create unique index if not exists customer_orders_table_order_idempotency_uidx
  on public.customer_orders (tenant_id, table_order_idempotency_key)
  where table_order_idempotency_key is not null;

comment on column public.customer_orders.table_order_idempotency_key is
  'Client-generated retry capability for one logical QR table order.';

create or replace function public.create_table_order_atomic(
  p_tenant_id uuid,
  p_location_id uuid,
  p_table_id uuid,
  p_payment_method text,
  p_total numeric,
  p_items jsonb,
  p_idempotency_key uuid
)
returns table (
  order_id uuid,
  order_number text,
  status_token uuid,
  was_created boolean
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_table_number text;
  v_order_id uuid;
  v_order_number text;
  v_status_token uuid;
  v_item_count integer;
  v_available_count integer;
  v_calculated_total numeric;
  v_order_items_json jsonb;
begin
  if p_tenant_id is null
     or p_location_id is null
     or p_table_id is null
     or p_idempotency_key is null then
    raise exception 'Missing table order identity';
  end if;

  if p_payment_method not in ('bar', 'karte') then
    raise exception 'Invalid table order payment method';
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 100 then
    raise exception 'Invalid table order items';
  end if;

  if p_total < 0.50 or p_total > 5000 then
    raise exception 'Invalid table order total';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('table-order:' || p_tenant_id::text || ':' || p_idempotency_key::text, 0)
  );

  select o.id, o.bestellnummer::text, o.tracking_token
    into v_order_id, v_order_number, v_status_token
  from public.customer_orders o
  where o.tenant_id = p_tenant_id
    and o.table_order_idempotency_key = p_idempotency_key;

  if found then
    return query select v_order_id, v_order_number, v_status_token, false;
    return;
  end if;

  select t.nummer::text
    into v_table_number
  from public.restaurant_tables t
  where t.id = p_table_id
    and t.tenant_id = p_tenant_id
    and t.location_id = p_location_id
    and t.aktiv;

  if v_table_number is null then
    raise exception 'Table is not available for tenant and location';
  end if;

  -- Retries are returned above. This limit only caps distinct new requests and
  -- leaves enough headroom for a large table splitting orders.
  if (
    select count(*)
    from public.customer_orders o
    where o.tisch_id = p_table_id
      and o.order_channel = 'tisch'
      and o.created_at >= now() - interval '1 minute'
  ) >= 12 then
    raise exception 'Too many table orders';
  end if;

  begin
    select
      count(*),
      round(coalesce(sum(
        (entry->>'unitPrice')::numeric * (entry->>'quantity')::integer
      ), 0), 2)
      into v_item_count, v_calculated_total
    from jsonb_array_elements(p_items) entry;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Invalid table order item values';
  end;

  if exists (
    select 1
    from jsonb_array_elements(p_items) entry
    where coalesce((entry->>'quantity')::integer, 0) not between 1 and 50
       or coalesce((entry->>'unitPrice')::numeric, 0) not between 0.01 and 500
       or length(btrim(coalesce(entry->>'name', ''))) not between 1 and 200
       or length(coalesce(entry->>'note', '')) > 500
       or jsonb_typeof(coalesce(entry->'selections', '{}'::jsonb)) <> 'object'
  ) then
    raise exception 'Invalid table order item payload';
  end if;

  select count(*)
    into v_available_count
  from jsonb_array_elements(p_items) entry
  join public.menu_items item
    on item.id = (entry->>'id')::uuid
   and item.tenant_id = p_tenant_id
   and item.location_id = p_location_id
   and item.verfuegbar;

  if v_item_count <> v_available_count then
    raise exception 'Table order contains unavailable items';
  end if;

  if v_calculated_total <> round(p_total, 2) then
    raise exception 'Table order total mismatch';
  end if;

  select jsonb_agg(jsonb_build_object(
    'id', entry->>'id',
    'name', entry->>'name',
    'qty', (entry->>'quantity')::integer,
    'priceCents', round(
      (entry->>'unitPrice')::numeric * (entry->>'quantity')::integer * 100
    )::integer
  ))
    into v_order_items_json
  from jsonb_array_elements(p_items) entry;

  insert into public.customer_orders (
    tenant_id,
    location_id,
    tisch_id,
    typ,
    status,
    kunde_name,
    zwischensumme,
    gesamtbetrag,
    zahlungsart,
    bezahlt,
    bestellt_am,
    geschaetzte_zubereitung_min,
    order_channel,
    payment_status,
    amount_total_cents,
    table_number,
    order_items_json,
    table_order_idempotency_key
  ) values (
    p_tenant_id,
    p_location_id,
    p_table_id,
    'vor_ort',
    'wartet_auf_zahlung',
    'Tisch ' || v_table_number,
    round(p_total, 2),
    round(p_total, 2),
    p_payment_method,
    false,
    now(),
    greatest(10, v_item_count * 3),
    'tisch',
    'pending_payment',
    round(p_total * 100)::integer,
    v_table_number,
    v_order_items_json,
    p_idempotency_key
  )
  returning id, bestellnummer::text, tracking_token
    into v_order_id, v_order_number, v_status_token;

  insert into public.order_items (
    order_id, menu_item_id, name, menge, einzelpreis, gesamtpreis, extras, notiz
  )
  select
    v_order_id,
    (entry->>'id')::uuid,
    left(entry->>'name', 200),
    (entry->>'quantity')::integer,
    (entry->>'unitPrice')::numeric,
    round((entry->>'unitPrice')::numeric * (entry->>'quantity')::integer, 2),
    jsonb_build_object('selections', coalesce(entry->'selections', '{}'::jsonb)),
    nullif(left(btrim(coalesce(entry->>'note', '')), 500), '')
  from jsonb_array_elements(p_items) entry;

  return query select v_order_id, v_order_number, v_status_token, true;
end;
$$;

revoke all on function public.create_table_order_atomic(
  uuid, uuid, uuid, text, numeric, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.create_table_order_atomic(
  uuid, uuid, uuid, text, numeric, jsonb, uuid
) to service_role;

commit;
