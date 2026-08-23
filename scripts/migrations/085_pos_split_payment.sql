-- 085_pos_split_payment.sql
-- Persistent, integer-cent split payments for POS/table orders.

begin;

create table if not exists public.pos_split_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  register_id uuid not null,
  shift_id uuid not null,
  employee_id uuid not null,
  table_id uuid,
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  transaction_id uuid not null references public.pos_transactions(id) on delete restrict,
  create_idempotency_key uuid not null,
  total_cents integer not null check (total_cents between 50 and 1000000),
  paid_cents integer not null default 0 check (paid_cents >= 0 and paid_cents <= total_cents),
  status text not null default 'open' check (status in ('open', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (order_id),
  unique (transaction_id),
  unique (tenant_id, create_idempotency_key)
);

create table if not exists public.pos_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  split_session_id uuid not null references public.pos_split_sessions(id) on delete cascade,
  method text not null check (method in ('bar', 'sumup', 'stripe')),
  scope_type text not null check (scope_type in ('amount', 'items', 'seat')),
  seat_no integer check (seat_no between 1 and 99),
  amount_cents integer not null check (amount_cents > 0),
  cash_received_cents integer check (cash_received_cents > 0),
  cash_change_cents integer check (cash_change_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  idempotency_key uuid not null,
  provider_reference text,
  provider_payment_id text,
  failure_reason text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  failed_at timestamptz,
  unique (tenant_id, idempotency_key)
);

create table if not exists public.pos_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  split_session_id uuid not null references public.pos_split_sessions(id) on delete cascade,
  payment_attempt_id uuid not null references public.pos_payment_attempts(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete restrict,
  seat_no integer check (seat_no between 1 and 99),
  allocation_type text not null check (allocation_type in ('amount', 'item', 'seat')),
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

create index if not exists pos_split_sessions_context_idx
  on public.pos_split_sessions (tenant_id, location_id, register_id, shift_id, employee_id, status);
create index if not exists pos_payment_attempts_session_idx
  on public.pos_payment_attempts (split_session_id, status, created_at);
create index if not exists pos_payment_allocations_item_idx
  on public.pos_payment_allocations (split_session_id, order_item_id);
create unique index if not exists ux_pos_payment_attempt_provider_reference
  on public.pos_payment_attempts (method, provider_reference)
  where provider_reference is not null;
create unique index if not exists ux_pos_payment_attempt_provider_payment
  on public.pos_payment_attempts (method, provider_payment_id)
  where provider_payment_id is not null;
create unique index if not exists ux_pos_payment_allocation_attempt_item
  on public.pos_payment_allocations (payment_attempt_id, order_item_id)
  where order_item_id is not null;

alter table public.pos_split_sessions enable row level security;
alter table public.pos_payment_attempts enable row level security;
alter table public.pos_payment_allocations enable row level security;
revoke all on public.pos_split_sessions from public, anon, authenticated;
revoke all on public.pos_payment_attempts from public, anon, authenticated;
revoke all on public.pos_payment_allocations from public, anon, authenticated;

create or replace function public.create_pos_split_sale_085(
  p_tenant_id uuid,
  p_location_id uuid,
  p_register_id uuid,
  p_shift_id uuid,
  p_employee_id uuid,
  p_table_id uuid,
  p_fulfillment text,
  p_items jsonb,
  p_subtotal_cents integer,
  p_tip_cents integer,
  p_training boolean,
  p_idempotency_key uuid
)
returns table (
  split_session_id uuid,
  transaction_id uuid,
  order_id uuid,
  order_number text,
  bon_token text,
  bon_number text,
  total_cents integer,
  remaining_cents integer,
  line_items jsonb,
  was_created boolean
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_existing public.pos_split_sessions%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_transaction_id uuid;
  v_session_id uuid;
  v_bon_token text;
  v_bon_number text;
  v_table_number text;
  v_entry jsonb;
  v_order_item_id uuid;
  v_item_count integer;
  v_available_count integer;
  v_calculated_subtotal bigint := 0;
  v_total_cents integer;
  v_tax_7_cents bigint := 0;
  v_tax_19_cents bigint := 0;
  v_gross_cents bigint;
  v_rate integer;
  v_line_items jsonb := '[]'::jsonb;
  v_bon_data jsonb;
begin
  if p_tenant_id is null or p_location_id is null or p_register_id is null
     or p_shift_id is null or p_employee_id is null or p_idempotency_key is null then
    raise exception 'Missing POS split identity';
  end if;
  if p_fulfillment not in ('table', 'counter', 'takeaway') then
    raise exception 'Invalid POS split fulfillment';
  end if;
  if p_fulfillment = 'table' and p_table_id is null then
    raise exception 'Table split requires a table';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'Invalid POS split items';
  end if;
  if coalesce(p_tip_cents, 0) not between 0 and 50000 then
    raise exception 'Invalid POS split tip';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pos-split-create:' || p_tenant_id::text || ':' || p_idempotency_key::text, 0)
  );

  select s.* into v_existing
  from public.pos_split_sessions s
  where s.tenant_id = p_tenant_id and s.create_idempotency_key = p_idempotency_key;
  if found then
    if v_existing.location_id is distinct from p_location_id
       or v_existing.register_id is distinct from p_register_id
       or v_existing.shift_id is distinct from p_shift_id
       or v_existing.employee_id is distinct from p_employee_id
       or v_existing.table_id is distinct from p_table_id then
      raise exception 'POS split idempotency key conflict';
    end if;
    return query
    select s.id, s.transaction_id, s.order_id, o.bestellnummer::text,
      tx.bon_token::text, tx.bon_nummer::text, s.total_cents,
      s.total_cents - s.paid_cents,
      coalesce(jsonb_agg(jsonb_build_object(
        'id', oi.id, 'name', oi.name, 'quantity', oi.menge,
        'totalCents', round(coalesce(oi.gesamtpreis, oi.einzelpreis * oi.menge) * 100)::integer,
        'seat', nullif(oi.extras->>'seat', '')::integer
      ) order by oi.id) filter (where oi.id is not null), '[]'::jsonb),
      false
    from public.pos_split_sessions s
    join public.customer_orders o on o.id = s.order_id
    join public.pos_transactions tx on tx.id = s.transaction_id
    left join public.order_items oi on oi.order_id = s.order_id
    where s.id = v_existing.id
    group by s.id, o.bestellnummer, tx.bon_token, tx.bon_nummer;
    return;
  end if;

  if not exists (
    select 1 from public.employees e
    where e.id = p_employee_id and e.tenant_id = p_tenant_id and e.location_id = p_location_id
  ) then raise exception 'POS split employee binding failed'; end if;
  if not exists (
    select 1 from public.pos_registers r
    join public.locations l on l.id = r.location_id
    where r.id = p_register_id and r.location_id = p_location_id
      and l.tenant_id = p_tenant_id and r.aktiv
  ) then raise exception 'POS split register binding failed'; end if;
  if not exists (
    select 1 from public.pos_shifts s
    where s.id = p_shift_id and s.tenant_id = p_tenant_id and s.location_id = p_location_id
      and s.register_id = p_register_id and s.employee_id = p_employee_id and s.status = 'offen'
  ) then raise exception 'POS split shift binding failed'; end if;
  if p_table_id is not null then
    select t.nummer::text into v_table_number
    from public.restaurant_tables t
    where t.id = p_table_id and t.tenant_id = p_tenant_id
      and t.location_id = p_location_id and t.aktiv;
    if v_table_number is null then raise exception 'POS split table binding failed'; end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) entry
    where coalesce((entry->>'quantity')::integer, 0) not between 1 and 50
      or coalesce((entry->>'unitPriceCents')::integer, 0) not between 1 and 50000
      or coalesce((entry->>'taxRate')::integer, 0) not in (7, 19)
      or length(btrim(coalesce(entry->>'name', ''))) not between 1 and 255
      or length(coalesce(entry->>'note', '')) > 500
      or jsonb_typeof(coalesce(entry->'selections', '{}'::jsonb)) <> 'object'
      or (entry ? 'seat' and coalesce((entry->>'seat')::integer, 0) not between 1 and 99)
  ) then raise exception 'Invalid POS split item payload'; end if;

  select count(*) into v_item_count from jsonb_array_elements(p_items);
  select count(*) into v_available_count
  from jsonb_array_elements(p_items) entry
  join public.menu_items item on item.id = (entry->>'id')::uuid
    and item.tenant_id = p_tenant_id and item.location_id = p_location_id and item.verfuegbar;
  if v_item_count <> v_available_count then
    raise exception 'POS split contains unavailable items';
  end if;

  for v_entry in select value from jsonb_array_elements(p_items)
  loop
    v_gross_cents := (v_entry->>'unitPriceCents')::integer * (v_entry->>'quantity')::integer;
    v_rate := (v_entry->>'taxRate')::integer;
    v_calculated_subtotal := v_calculated_subtotal + v_gross_cents;
    if v_rate = 7 then
      v_tax_7_cents := v_tax_7_cents + round(v_gross_cents * 7.0 / 107.0);
    else
      v_tax_19_cents := v_tax_19_cents + round(v_gross_cents * 19.0 / 119.0);
    end if;
  end loop;
  if v_calculated_subtotal <> p_subtotal_cents then
    raise exception 'POS split subtotal mismatch';
  end if;
  v_total_cents := p_subtotal_cents + coalesce(p_tip_cents, 0);
  if v_total_cents not between 50 and 1000000 then
    raise exception 'POS split total mismatch';
  end if;

  insert into public.customer_orders (
    tenant_id, location_id, tisch_id, kellner_id, typ, status, kunde_name,
    zwischensumme, gesamtbetrag, zahlungsart, bezahlt, bestellt_am,
    bestaetigt_am, geschaetzte_zubereitung_min, order_channel
  ) values (
    p_tenant_id, p_location_id, p_table_id, p_employee_id,
    case when p_fulfillment in ('table', 'counter') then 'vor_ort' else 'abholung' end,
    'wartet_auf_zahlung',
    case when p_fulfillment = 'table' then 'Tisch ' || v_table_number
      when p_fulfillment = 'counter' then 'POS-Theke' else 'POS-Abholung' end,
    p_subtotal_cents / 100.0, v_total_cents / 100.0, 'split', false, now(), null,
    greatest(5, v_item_count * 3), 'pos'
  ) returning id, bestellnummer::text into v_order_id, v_order_number;

  v_bon_data := jsonb_build_object(
    'source', 'pos-v5-split', 'order_number', v_order_number,
    'nettoCents', p_subtotal_cents - v_tax_7_cents - v_tax_19_cents,
    'tax7Cents', v_tax_7_cents, 'tax19Cents', v_tax_19_cents,
    'subtotalCents', p_subtotal_cents, 'tipCents', coalesce(p_tip_cents, 0),
    'totalCents', v_total_cents, 'payments', '[]'::jsonb
  );

  insert into public.pos_transactions as tx (
    tenant_id, location_id, register_id, shift_id, customer_order_id, tisch_id,
    typ, mitarbeiter_id, brutto_gesamt, netto_gesamt, mwst_gesamt, mwst_7,
    mwst_19, zahlungsart, bezahlt_betrag, gegeben, rueckgeld, trainingsbon,
    bon_data, pos_sale_idempotency_key
  ) values (
    p_tenant_id, p_location_id, p_register_id, p_shift_id, v_order_id, p_table_id,
    'verkauf', p_employee_id, p_subtotal_cents / 100.0,
    (p_subtotal_cents - v_tax_7_cents - v_tax_19_cents) / 100.0,
    (v_tax_7_cents + v_tax_19_cents) / 100.0, v_tax_7_cents / 100.0,
    v_tax_19_cents / 100.0, 'split', 0, null, null, coalesce(p_training, false),
    v_bon_data, p_idempotency_key
  ) returning tx.id, tx.bon_token::text, tx.bon_nummer::text
    into v_transaction_id, v_bon_token, v_bon_number;

  for v_entry in select value from jsonb_array_elements(p_items)
  loop
    v_gross_cents := (v_entry->>'unitPriceCents')::integer * (v_entry->>'quantity')::integer;
    insert into public.order_items (
      order_id, menu_item_id, name, menge, einzelpreis, gesamtpreis, extras, notiz
    ) values (
      v_order_id, (v_entry->>'id')::uuid, left(v_entry->>'name', 255),
      (v_entry->>'quantity')::integer, (v_entry->>'unitPriceCents')::integer / 100.0,
      v_gross_cents / 100.0,
      jsonb_build_object(
        'selections', coalesce(v_entry->'selections', '{}'::jsonb),
        'seat', case when v_entry ? 'seat' then (v_entry->>'seat')::integer else null end
      ),
      nullif(left(btrim(coalesce(v_entry->>'note', '')), 500), '')
    ) returning id into v_order_item_id;

    v_line_items := v_line_items || jsonb_build_array(jsonb_build_object(
      'id', v_order_item_id, 'name', left(v_entry->>'name', 255),
      'quantity', (v_entry->>'quantity')::integer, 'totalCents', v_gross_cents,
      'seat', case when v_entry ? 'seat' then (v_entry->>'seat')::integer else null end
    ));

    v_rate := (v_entry->>'taxRate')::integer;
    insert into public.pos_transaction_items (
      transaction_id, menu_item_id, name, menge, einzelpreis_netto,
      einzelpreis_brutto, mwst_satz, mwst_betrag, gesamt_brutto
    ) values (
      v_transaction_id, (v_entry->>'id')::uuid, left(v_entry->>'name', 255),
      (v_entry->>'quantity')::integer,
      round(((v_entry->>'unitPriceCents')::integer / 100.0) / (1 + v_rate / 100.0), 2),
      (v_entry->>'unitPriceCents')::integer / 100.0, v_rate,
      round((v_gross_cents - round(v_gross_cents * 100.0 / (100 + v_rate))) / 100.0, 2),
      v_gross_cents / 100.0
    );
  end loop;

  insert into public.pos_split_sessions (
    tenant_id, location_id, register_id, shift_id, employee_id, table_id,
    order_id, transaction_id, create_idempotency_key, total_cents
  ) values (
    p_tenant_id, p_location_id, p_register_id, p_shift_id, p_employee_id, p_table_id,
    v_order_id, v_transaction_id, p_idempotency_key, v_total_cents
  ) returning id into v_session_id;

  return query select v_session_id, v_transaction_id, v_order_id, v_order_number,
    v_bon_token, v_bon_number, v_total_cents, v_total_cents, v_line_items, true;
end;
$$;

create or replace function public.get_pos_split_status_085(
  p_tenant_id uuid, p_location_id uuid, p_register_id uuid, p_shift_id uuid,
  p_employee_id uuid, p_split_session_id uuid
)
returns table (
  split_session_id uuid, transaction_id uuid, order_id uuid, order_number text,
  bon_token text, total_cents integer, paid_cents integer, remaining_cents integer,
  status text, line_items jsonb, payments jsonb
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select s.id, s.transaction_id, s.order_id, o.bestellnummer::text, tx.bon_token::text,
    s.total_cents, s.paid_cents, s.total_cents - s.paid_cents, s.status,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id, 'name', oi.name, 'quantity', oi.menge,
        'totalCents', round(coalesce(oi.gesamtpreis, oi.einzelpreis * oi.menge) * 100)::integer,
        'remainingCents', greatest(0,
          round(coalesce(oi.gesamtpreis, oi.einzelpreis * oi.menge) * 100)::integer
          - coalesce((select sum(a.amount_cents) from public.pos_payment_allocations a
              join public.pos_payment_attempts pa on pa.id = a.payment_attempt_id
              where a.order_item_id = oi.id and pa.status in ('pending', 'confirmed')), 0)
        ),
        'seat', nullif(oi.extras->>'seat', '')::integer
      ) order by oi.id)
      from public.order_items oi where oi.order_id = s.order_id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pa.id, 'method', pa.method, 'scope', pa.scope_type,
        'amountCents', pa.amount_cents, 'status', pa.status,
        'cashChangeCents', coalesce(pa.cash_change_cents, 0),
        'createdAt', pa.created_at
      ) order by pa.created_at, pa.id)
      from public.pos_payment_attempts pa
      where pa.split_session_id = s.id and pa.status = 'confirmed'
    ), '[]'::jsonb)
  from public.pos_split_sessions s
  join public.customer_orders o on o.id = s.order_id
  join public.pos_transactions tx on tx.id = s.transaction_id
  where s.id = p_split_session_id and s.tenant_id = p_tenant_id
    and s.location_id = p_location_id and s.register_id = p_register_id
    and s.shift_id = p_shift_id and s.employee_id = p_employee_id
$$;

create or replace function public.prepare_pos_split_payment_085(
  p_tenant_id uuid, p_location_id uuid, p_register_id uuid, p_shift_id uuid,
  p_employee_id uuid, p_split_session_id uuid, p_method text, p_scope_type text,
  p_requested_cents integer, p_order_item_ids jsonb, p_seat_no integer,
  p_idempotency_key uuid
)
returns table (
  payment_attempt_id uuid, amount_cents integer, attempt_status text,
  provider_reference text, was_created boolean
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_session public.pos_split_sessions%rowtype;
  v_existing public.pos_payment_attempts%rowtype;
  v_attempt_id uuid;
  v_amount integer;
  v_available integer;
  v_selected integer;
begin
  if p_idempotency_key is null or p_split_session_id is null then
    raise exception 'Missing split payment identity';
  end if;
  if p_method not in ('bar', 'sumup', 'stripe') then raise exception 'Invalid split payment method'; end if;
  if p_scope_type not in ('amount', 'items', 'seat') then raise exception 'Invalid split payment scope'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended('pos-split-payment:' || p_tenant_id::text || ':' || p_idempotency_key::text, 0)
  );
  select pa.* into v_existing from public.pos_payment_attempts pa
  where pa.tenant_id = p_tenant_id and pa.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.split_session_id is distinct from p_split_session_id
       or v_existing.method is distinct from p_method
       or v_existing.scope_type is distinct from p_scope_type
       or (p_scope_type = 'amount' and v_existing.amount_cents is distinct from p_requested_cents)
       or (p_scope_type = 'seat' and v_existing.seat_no is distinct from p_seat_no)
       or (p_scope_type = 'items' and (
         jsonb_typeof(p_order_item_ids) <> 'array'
         or (select count(distinct a.order_item_id)
             from public.pos_payment_allocations a
             where a.payment_attempt_id = v_existing.id)
            <> (select count(distinct value) from jsonb_array_elements_text(p_order_item_ids))
         or exists (
           select value::uuid from jsonb_array_elements_text(p_order_item_ids)
           except
           select a.order_item_id from public.pos_payment_allocations a
           where a.payment_attempt_id = v_existing.id
         )
       )) then
      raise exception 'Split payment idempotency key conflict';
    end if;
    return query select v_existing.id, v_existing.amount_cents, v_existing.status,
      v_existing.provider_reference, false;
    return;
  end if;

  select s.* into v_session from public.pos_split_sessions s
  where s.id = p_split_session_id and s.tenant_id = p_tenant_id
    and s.location_id = p_location_id and s.register_id = p_register_id
    and s.shift_id = p_shift_id and s.employee_id = p_employee_id
  for update;
  if not found then raise exception 'Split session binding failed'; end if;
  if v_session.status <> 'open' then raise exception 'Split session is not open'; end if;
  if not exists (
    select 1 from public.pos_shifts s
    where s.id = p_shift_id and s.tenant_id = p_tenant_id and s.location_id = p_location_id
      and s.register_id = p_register_id and s.employee_id = p_employee_id and s.status = 'offen'
  ) then raise exception 'Split payment shift binding failed'; end if;

  select v_session.total_cents - coalesce(sum(pa.amount_cents)
    filter (where pa.status in ('pending', 'confirmed')), 0)
  into v_available
  from public.pos_payment_attempts pa where pa.split_session_id = v_session.id;

  if p_scope_type = 'amount' then
    v_amount := p_requested_cents;
    if jsonb_typeof(coalesce(p_order_item_ids, '[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(p_order_item_ids, '[]'::jsonb)) <> 0
       or p_seat_no is not null then
      raise exception 'Amount split has invalid allocation';
    end if;
  elsif p_scope_type = 'items' then
    if jsonb_typeof(p_order_item_ids) <> 'array'
       or jsonb_array_length(p_order_item_ids) not between 1 and 100
       or p_seat_no is not null then raise exception 'Item split has invalid allocation'; end if;
    select count(*), coalesce(sum(item_remaining), 0)
      into v_selected, v_amount
    from (
      select oi.id, greatest(0,
        round(coalesce(oi.gesamtpreis, oi.einzelpreis * oi.menge) * 100)::integer
        - coalesce((select sum(a.amount_cents) from public.pos_payment_allocations a
            join public.pos_payment_attempts pa on pa.id = a.payment_attempt_id
            where a.order_item_id = oi.id and pa.status in ('pending', 'confirmed')), 0)
      ) as item_remaining
      from public.order_items oi
      where oi.order_id = v_session.order_id
        and oi.id in (select distinct value::uuid from jsonb_array_elements_text(p_order_item_ids))
    ) selected;
    if v_selected <> (select count(distinct value) from jsonb_array_elements_text(p_order_item_ids))
       or v_amount <= 0 then raise exception 'Split item allocation is unavailable'; end if;
  else
    if p_seat_no not between 1 and 99
       or jsonb_typeof(coalesce(p_order_item_ids, '[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(p_order_item_ids, '[]'::jsonb)) <> 0 then
      raise exception 'Seat split has invalid allocation';
    end if;
    select count(*), coalesce(sum(item_remaining), 0)
      into v_selected, v_amount
    from (
      select oi.id, greatest(0,
        round(coalesce(oi.gesamtpreis, oi.einzelpreis * oi.menge) * 100)::integer
        - coalesce((select sum(a.amount_cents) from public.pos_payment_allocations a
            join public.pos_payment_attempts pa on pa.id = a.payment_attempt_id
            where a.order_item_id = oi.id and pa.status in ('pending', 'confirmed')), 0)
      ) as item_remaining
      from public.order_items oi
      where oi.order_id = v_session.order_id and nullif(oi.extras->>'seat', '')::integer = p_seat_no
    ) selected;
    if v_selected = 0 or v_amount <= 0 then raise exception 'Split seat allocation is unavailable'; end if;
  end if;

  if v_amount is null or v_amount <= 0 then raise exception 'Split payment must be positive'; end if;
  if v_amount > v_available then raise exception 'Split payment exceeds remaining total'; end if;

  insert into public.pos_payment_attempts (
    tenant_id, location_id, split_session_id, method, scope_type, seat_no,
    amount_cents, idempotency_key
  ) values (
    p_tenant_id, p_location_id, v_session.id, p_method, p_scope_type,
    case when p_scope_type = 'seat' then p_seat_no else null end,
    v_amount, p_idempotency_key
  ) returning id into v_attempt_id;

  if p_scope_type = 'items' then
    insert into public.pos_payment_allocations (
      tenant_id, location_id, split_session_id, payment_attempt_id,
      order_item_id, allocation_type, amount_cents
    )
    select p_tenant_id, p_location_id, v_session.id, v_attempt_id, oi.id, 'item',
      round(coalesce(oi.gesamtpreis, oi.einzelpreis * oi.menge) * 100)::integer
      - coalesce((select sum(a.amount_cents) from public.pos_payment_allocations a
          join public.pos_payment_attempts pa on pa.id = a.payment_attempt_id
          where a.order_item_id = oi.id and pa.status in ('pending', 'confirmed')), 0)
    from public.order_items oi
    where oi.order_id = v_session.order_id
      and oi.id in (select distinct value::uuid from jsonb_array_elements_text(p_order_item_ids));
  elsif p_scope_type = 'seat' then
    insert into public.pos_payment_allocations (
      tenant_id, location_id, split_session_id, payment_attempt_id,
      order_item_id, seat_no, allocation_type, amount_cents
    )
    select p_tenant_id, p_location_id, v_session.id, v_attempt_id, oi.id,
      p_seat_no, 'seat',
      round(coalesce(oi.gesamtpreis, oi.einzelpreis * oi.menge) * 100)::integer
      - coalesce((select sum(a.amount_cents) from public.pos_payment_allocations a
          join public.pos_payment_attempts pa on pa.id = a.payment_attempt_id
          where a.order_item_id = oi.id and pa.status in ('pending', 'confirmed')), 0)
    from public.order_items oi
    where oi.order_id = v_session.order_id and nullif(oi.extras->>'seat', '')::integer = p_seat_no;
  else
    insert into public.pos_payment_allocations (
      tenant_id, location_id, split_session_id, payment_attempt_id,
      allocation_type, amount_cents
    ) values (p_tenant_id, p_location_id, v_session.id, v_attempt_id, 'amount', v_amount);
  end if;

  return query select v_attempt_id, v_amount, 'pending'::text, null::text, true;
end;
$$;

create or replace function public.attach_pos_split_provider_085(
  p_tenant_id uuid, p_location_id uuid, p_register_id uuid, p_shift_id uuid,
  p_employee_id uuid, p_payment_attempt_id uuid, p_provider_reference text
)
returns text
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare v_attempt public.pos_payment_attempts%rowtype;
begin
  if nullif(btrim(p_provider_reference), '') is null or length(p_provider_reference) > 255 then
    raise exception 'Invalid split provider reference';
  end if;
  select pa.* into v_attempt
  from public.pos_payment_attempts pa
  join public.pos_split_sessions s on s.id = pa.split_session_id
  where pa.id = p_payment_attempt_id and pa.tenant_id = p_tenant_id
    and pa.location_id = p_location_id and s.register_id = p_register_id
    and s.shift_id = p_shift_id and s.employee_id = p_employee_id
  for update of pa;
  if not found or v_attempt.method = 'bar' then raise exception 'Split provider attempt binding failed'; end if;
  if v_attempt.provider_reference is not null
     and v_attempt.provider_reference <> p_provider_reference then
    raise exception 'Split provider reference conflict';
  end if;
  update public.pos_payment_attempts
  set provider_reference = p_provider_reference where id = v_attempt.id;
  return p_provider_reference;
end;
$$;

create or replace function public.confirm_pos_split_payment_085(
  p_tenant_id uuid, p_location_id uuid, p_register_id uuid, p_shift_id uuid,
  p_employee_id uuid, p_payment_attempt_id uuid, p_provider_payment_id text
)
returns table (
  split_session_id uuid, transaction_id uuid, order_id uuid, order_number text,
  bon_token text, amount_cents integer, paid_cents integer, remaining_cents integer,
  completed boolean, was_confirmed boolean
)
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v_attempt public.pos_payment_attempts%rowtype;
  v_session public.pos_split_sessions%rowtype;
  v_paid integer;
  v_completed boolean;
  v_methods integer;
  v_method text;
begin
  select pa.* into v_attempt
  from public.pos_payment_attempts pa
  join public.pos_split_sessions s on s.id = pa.split_session_id
  where pa.id = p_payment_attempt_id and pa.tenant_id = p_tenant_id
    and pa.location_id = p_location_id and s.register_id = p_register_id
    and s.shift_id = p_shift_id and s.employee_id = p_employee_id;
  if not found then raise exception 'Split payment attempt binding failed'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'pos-split-session:' || p_tenant_id::text || ':' || v_attempt.split_session_id::text, 0
  ));
  select pa.* into v_attempt
  from public.pos_payment_attempts pa
  join public.pos_split_sessions s on s.id = pa.split_session_id
  where pa.id = p_payment_attempt_id and pa.tenant_id = p_tenant_id
    and pa.location_id = p_location_id and s.register_id = p_register_id
    and s.shift_id = p_shift_id and s.employee_id = p_employee_id
  for update of pa;
  if not found then raise exception 'Split payment attempt binding failed'; end if;
  select s.* into v_session from public.pos_split_sessions s
  where s.id = v_attempt.split_session_id for update;

  if v_attempt.status = 'failed' then raise exception 'Split payment attempt has failed'; end if;
  if v_attempt.method <> 'bar' then
    if nullif(btrim(p_provider_payment_id), '') is null or length(p_provider_payment_id) > 255 then
      raise exception 'Verified provider payment is required';
    end if;
    if v_attempt.provider_reference is not null
       and v_attempt.provider_reference <> p_provider_payment_id then
      raise exception 'Verified provider payment mismatch';
    end if;
  elsif p_provider_payment_id is not null then
    raise exception 'Cash split cannot have a provider payment';
  end if;

  if v_attempt.status = 'confirmed' then
    return query select v_session.id, v_session.transaction_id, v_session.order_id,
      o.bestellnummer::text, tx.bon_token::text, v_attempt.amount_cents,
      v_session.paid_cents, v_session.total_cents - v_session.paid_cents,
      v_session.status = 'paid', false
    from public.customer_orders o join public.pos_transactions tx on tx.id = v_session.transaction_id
    where o.id = v_session.order_id;
    return;
  end if;

  update public.pos_payment_attempts
  set status = 'confirmed', confirmed_at = now(),
      provider_reference = case when method <> 'bar' then coalesce(provider_reference, p_provider_payment_id) else provider_reference end,
      provider_payment_id = case when method <> 'bar' then p_provider_payment_id else null end
  where id = v_attempt.id;

  select coalesce(sum(pa.amount_cents), 0) into v_paid
  from public.pos_payment_attempts pa
  where pa.split_session_id = v_session.id and pa.status = 'confirmed';
  if v_paid > v_session.total_cents then raise exception 'Split payment exceeds total'; end if;
  v_completed := v_paid = v_session.total_cents;

  update public.pos_split_sessions s
  set paid_cents = v_paid, status = case when v_completed then 'paid' else 'open' end,
      completed_at = case when v_completed then coalesce(s.completed_at, now()) else null end,
      updated_at = now()
  where s.id = v_session.id;

  if v_completed then
    select count(distinct pa.method), min(pa.method) into v_methods, v_method
    from public.pos_payment_attempts pa
    where pa.split_session_id = v_session.id and pa.status = 'confirmed';
    update public.customer_orders o
    set bezahlt = true, status = 'neu',
      zahlungsart = case when v_methods > 1 then 'split' else v_method end,
      bestaetigt_am = coalesce(o.bestaetigt_am, now())
    where o.id = v_session.order_id and o.tenant_id = p_tenant_id
      and o.location_id = p_location_id and coalesce(o.bezahlt, false) = false;
    update public.pos_transactions tx
    set zahlungsart = case when v_methods > 1 then 'split' else v_method end,
      bezahlt_betrag = v_session.total_cents / 100.0,
      bon_data = jsonb_set(coalesce(tx.bon_data, '{}'::jsonb), '{payments}',
        coalesce((select jsonb_agg(jsonb_build_object(
          'method', pa.method, 'amountCents', pa.amount_cents,
          'cashChangeCents', coalesce(pa.cash_change_cents, 0),
          'providerPaymentId', pa.provider_payment_id
        ) order by pa.confirmed_at, pa.id)
        from public.pos_payment_attempts pa
        where pa.split_session_id = v_session.id and pa.status = 'confirmed'), '[]'::jsonb), true)
    where tx.id = v_session.transaction_id;
  end if;

  return query select v_session.id, v_session.transaction_id, v_session.order_id,
    o.bestellnummer::text, tx.bon_token::text, v_attempt.amount_cents,
    v_paid, v_session.total_cents - v_paid, v_completed, true
  from public.customer_orders o join public.pos_transactions tx on tx.id = v_session.transaction_id
  where o.id = v_session.order_id;
end;
$$;

create or replace function public.record_pos_split_cash_085(
  p_tenant_id uuid, p_location_id uuid, p_register_id uuid, p_shift_id uuid,
  p_employee_id uuid, p_split_session_id uuid, p_scope_type text,
  p_requested_cents integer, p_order_item_ids jsonb, p_seat_no integer,
  p_cash_received_cents integer, p_idempotency_key uuid
)
returns table (
  split_session_id uuid, transaction_id uuid, order_id uuid, order_number text,
  bon_token text, amount_cents integer, paid_cents integer, remaining_cents integer,
  completed boolean, was_confirmed boolean, cash_change_cents integer
)
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v_prepared record;
  v_confirmed record;
  v_change integer;
  v_recorded_received integer;
begin
  select * into v_prepared from public.prepare_pos_split_payment_085(
    p_tenant_id, p_location_id, p_register_id, p_shift_id, p_employee_id,
    p_split_session_id, 'bar', p_scope_type, p_requested_cents,
    coalesce(p_order_item_ids, '[]'::jsonb), p_seat_no, p_idempotency_key
  );
  if v_prepared.attempt_status = 'failed' then raise exception 'Split cash attempt has failed'; end if;
  if p_cash_received_cents is null or p_cash_received_cents < v_prepared.amount_cents
     or p_cash_received_cents > 1000000 then raise exception 'Split cash received is invalid'; end if;

  if v_prepared.attempt_status = 'confirmed' then
    select pa.cash_received_cents, pa.cash_change_cents
      into v_recorded_received, v_change
    from public.pos_payment_attempts pa
    where pa.id = v_prepared.payment_attempt_id;
    if v_recorded_received is distinct from p_cash_received_cents then
      raise exception 'Split payment idempotency key conflict';
    end if;
  else
    v_change := p_cash_received_cents - v_prepared.amount_cents;
    update public.pos_payment_attempts set cash_received_cents = p_cash_received_cents,
      cash_change_cents = v_change where id = v_prepared.payment_attempt_id;
  end if;

  select * into v_confirmed from public.confirm_pos_split_payment_085(
    p_tenant_id, p_location_id, p_register_id, p_shift_id, p_employee_id,
    v_prepared.payment_attempt_id, null
  );
  return query select v_confirmed.split_session_id, v_confirmed.transaction_id,
    v_confirmed.order_id, v_confirmed.order_number, v_confirmed.bon_token,
    v_confirmed.amount_cents, v_confirmed.paid_cents, v_confirmed.remaining_cents,
    v_confirmed.completed, v_confirmed.was_confirmed, v_change;
end;
$$;

create or replace function public.fail_pos_split_provider_085(
  p_tenant_id uuid, p_location_id uuid, p_register_id uuid, p_shift_id uuid,
  p_employee_id uuid, p_payment_attempt_id uuid, p_reason text
)
returns boolean
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare v_session_id uuid;
begin
  select s.id into v_session_id
  from public.pos_payment_attempts pa
  join public.pos_split_sessions s on s.id = pa.split_session_id
  where pa.id = p_payment_attempt_id and pa.tenant_id = p_tenant_id
    and pa.location_id = p_location_id and s.register_id = p_register_id
    and s.shift_id = p_shift_id and s.employee_id = p_employee_id
    and pa.method in ('sumup', 'stripe');
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'pos-split-session:' || p_tenant_id::text || ':' || v_session_id::text, 0
  ));
  perform 1 from public.pos_payment_attempts pa
  where pa.id = p_payment_attempt_id for update;
  update public.pos_payment_attempts pa set status = 'failed',
    failure_reason = left(coalesce(nullif(btrim(p_reason), ''), 'provider_failed'), 255),
    failed_at = now()
  where pa.id = p_payment_attempt_id and pa.split_session_id = v_session_id
    and pa.tenant_id = p_tenant_id and pa.location_id = p_location_id
    and pa.method in ('sumup', 'stripe') and pa.status = 'pending';
  return found;
end;
$$;

revoke all on function public.create_pos_split_sale_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,integer,integer,boolean,uuid
) from public, anon, authenticated;
revoke all on function public.get_pos_split_status_085(uuid,uuid,uuid,uuid,uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.prepare_pos_split_payment_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text,text,integer,jsonb,integer,uuid
) from public, anon, authenticated;
revoke all on function public.attach_pos_split_provider_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text
) from public, anon, authenticated;
revoke all on function public.confirm_pos_split_payment_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text
) from public, anon, authenticated;
revoke all on function public.record_pos_split_cash_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text,integer,jsonb,integer,integer,uuid
) from public, anon, authenticated;
revoke all on function public.fail_pos_split_provider_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text
) from public, anon, authenticated;

grant execute on function public.create_pos_split_sale_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,integer,integer,boolean,uuid
) to service_role;
grant execute on function public.get_pos_split_status_085(uuid,uuid,uuid,uuid,uuid,uuid)
  to service_role;
grant execute on function public.prepare_pos_split_payment_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text,text,integer,jsonb,integer,uuid
) to service_role;
grant execute on function public.attach_pos_split_provider_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text
) to service_role;
grant execute on function public.confirm_pos_split_payment_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text
) to service_role;
grant execute on function public.record_pos_split_cash_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text,integer,jsonb,integer,integer,uuid
) to service_role;
grant execute on function public.fail_pos_split_provider_085(
  uuid,uuid,uuid,uuid,uuid,uuid,text
) to service_role;

commit;
