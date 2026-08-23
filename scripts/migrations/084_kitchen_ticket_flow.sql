-- 084_kitchen_ticket_flow.sql
-- Persistent, tenant-safe kitchen tickets for QR table orders and POS sales.

begin;

alter table public.order_items
  add column if not exists station_id uuid,
  add column if not exists station_status text not null default 'offen';

alter table public.customer_orders
  add column if not exists order_channel text,
  add column if not exists zubereitung_start timestamptz,
  add column if not exists fertig_am timestamptz;

create table if not exists public.kitchen_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  order_id uuid not null references public.customer_orders(id) on delete restrict,
  source text not null check (source in ('qr_table', 'pos', 'staff', 'legacy')),
  status text not null default 'queued' check (status in ('queued', 'preparing', 'ready', 'cancelled')),
  version integer not null default 1 check (version > 0),
  queued_at timestamptz not null default now(),
  preparing_at timestamptz,
  ready_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id),
  unique (tenant_id, id)
);

create table if not exists public.kitchen_ticket_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  ticket_id uuid not null references public.kitchen_tickets(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  station_id uuid,
  status text not null default 'queued' check (status in ('queued', 'preparing', 'ready', 'cancelled')),
  quantity integer not null check (quantity > 0),
  item_name text not null check (length(btrim(item_name)) between 1 and 255),
  note text,
  version integer not null default 1 check (version > 0),
  queued_at timestamptz not null default now(),
  preparing_at timestamptz,
  ready_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_item_id),
  unique (tenant_id, id)
);

create table if not exists public.kitchen_ticket_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  location_id uuid not null references public.locations(id) on delete restrict,
  ticket_id uuid not null references public.kitchen_tickets(id) on delete cascade,
  ticket_item_id uuid references public.kitchen_ticket_items(id) on delete cascade,
  actor_employee_id uuid references public.employees(id) on delete restrict,
  event_type text not null check (event_type in ('enqueued', 'preparing', 'ready', 'cancelled')),
  from_status text,
  to_status text not null,
  idempotency_key uuid not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create index if not exists kitchen_tickets_queue_idx on public.kitchen_tickets (tenant_id, location_id, status, queued_at);
create index if not exists kitchen_ticket_items_station_idx on public.kitchen_ticket_items (tenant_id, location_id, station_id, status, queued_at);
create index if not exists kitchen_ticket_events_ticket_idx on public.kitchen_ticket_events (ticket_id, created_at);

alter table public.kitchen_tickets enable row level security;
alter table public.kitchen_ticket_items enable row level security;
alter table public.kitchen_ticket_events enable row level security;
revoke all on table public.kitchen_tickets from anon, authenticated;
revoke all on table public.kitchen_ticket_items from anon, authenticated;
revoke all on table public.kitchen_ticket_events from anon, authenticated;

create or replace function public.kitchen_ticket_source_084(
  p_order_channel text, p_external_source text, p_employee_id uuid
)
returns text language sql immutable set search_path = public, pg_catalog
as $$
  select case
    when p_order_channel = 'tisch' then 'qr_table'
    when p_order_channel in ('pos', 'kasse') then 'pos'
    when nullif(btrim(coalesce(p_external_source, '')), '') is not null then 'legacy'
    when p_order_channel in ('staff', 'service', 'mitarbeiter') or p_employee_id is not null then 'staff'
    else 'legacy'
  end
$$;

revoke all on function public.kitchen_ticket_source_084(text,text,uuid)
  from public, anon, authenticated;
grant execute on function public.kitchen_ticket_source_084(text,text,uuid)
  to service_role;

create or replace function public.enqueue_kitchen_ticket_atomic(
  p_tenant_id uuid, p_location_id uuid, p_order_id uuid, p_source text, p_idempotency_key uuid
)
returns table (ticket_id uuid, was_created boolean, item_count integer)
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v_ticket_id uuid;
  v_created boolean := false;
  v_count integer := 0;
  v_order public.customer_orders%rowtype;
  v_all_count integer;
  v_ready_count integer;
  v_cancelled_count integer;
  v_preparing_count integer;
  v_ticket_status text;
  v_preparing_at timestamptz;
  v_ready_at timestamptz;
  v_cancelled_at timestamptz;
  v_idempotent_ticket uuid;
begin
  if p_tenant_id is null or p_location_id is null or p_order_id is null or p_idempotency_key is null then
    raise exception 'Missing kitchen ticket identity';
  end if;
  if p_source not in ('qr_table', 'pos', 'staff', 'legacy') then raise exception 'Invalid kitchen ticket source'; end if;
  perform pg_advisory_xact_lock(hashtextextended('kitchen-ticket:' || p_tenant_id::text || ':' || p_order_id::text, 0));

  select * into v_order from public.customer_orders o
  where o.id = p_order_id and o.tenant_id = p_tenant_id and o.location_id = p_location_id for update;
  if not found then raise exception 'Order is outside tenant or location'; end if;
  if not (coalesce(v_order.bezahlt, false) or v_order.zahlungsart = 'bar') then
    raise exception 'Order is not released to kitchen';
  end if;

  select e.ticket_id into v_idempotent_ticket
  from public.kitchen_ticket_events e
  where e.tenant_id = p_tenant_id and e.idempotency_key = p_idempotency_key;
  if found and not exists (
    select 1 from public.kitchen_tickets t
    where t.id = v_idempotent_ticket and t.order_id = p_order_id
      and t.tenant_id = p_tenant_id and t.location_id = p_location_id
  ) then
    raise exception 'Kitchen idempotency key conflict';
  end if;

  insert into public.kitchen_tickets (tenant_id, location_id, order_id, source, queued_at)
  values (
    p_tenant_id, p_location_id, p_order_id, p_source,
    coalesce(v_order.bestellt_am, nullif(to_jsonb(v_order)->>'created_at', '')::timestamptz, now())
  )
  on conflict (order_id) do nothing returning id into v_ticket_id;
  if v_ticket_id is not null then
    v_created := true;
  else
    select t.id into v_ticket_id from public.kitchen_tickets t
    where t.order_id = p_order_id and t.tenant_id = p_tenant_id and t.location_id = p_location_id;
    if v_ticket_id is null then raise exception 'Kitchen ticket ownership mismatch'; end if;
  end if;

  insert into public.kitchen_ticket_items (
    tenant_id, location_id, ticket_id, order_item_id, station_id, status,
    quantity, item_name, note, queued_at, preparing_at, ready_at, cancelled_at
  )
  select p_tenant_id, p_location_id, v_ticket_id, oi.id,
    coalesce(oi.station_id,
      (select scr.station_id from public.menu_items mi
       join public.station_category_routing scr on scr.category_id = mi.category_id
       join public.kitchen_stations ks on ks.id = scr.station_id
       where mi.id = oi.menu_item_id and mi.tenant_id = p_tenant_id and mi.location_id = p_location_id
         and ks.tenant_id = p_tenant_id and ks.location_id = p_location_id and ks.aktiv
       order by ks.sort_order, ks.id limit 1),
      (select ks.id from public.kitchen_stations ks
       where ks.tenant_id = p_tenant_id and ks.location_id = p_location_id and ks.aktiv
       order by ks.sort_order, ks.id limit 1)),
    case oi.station_status
      when 'in_arbeit' then 'preparing'
      when 'fertig' then 'ready'
      when 'storniert' then 'cancelled'
      else 'queued'
    end,
    greatest(coalesce(oi.menge, 1), 1),
    left(coalesce(nullif(btrim(oi.name), ''), 'Position'), 255),
    nullif(left(btrim(coalesce(oi.notiz, '')), 500), ''),
    coalesce(o.bestellt_am, nullif(to_jsonb(o)->>'created_at', '')::timestamptz, now()),
    case when oi.station_status in ('in_arbeit', 'fertig')
      then coalesce(o.zubereitung_start, o.bestaetigt_am, o.bestellt_am, nullif(to_jsonb(o)->>'created_at', '')::timestamptz, now()) end,
    case when oi.station_status = 'fertig' then coalesce(o.fertig_am, now()) end,
    case when oi.station_status = 'storniert' then now() end
  from public.order_items oi
  join public.customer_orders o on o.id = oi.order_id
  where oi.order_id = p_order_id
  on conflict (order_item_id) do nothing;

  update public.order_items oi
  set station_id = kti.station_id,
      station_status = case when oi.station_status in ('offen', 'in_arbeit', 'fertig', 'storniert') then oi.station_status else 'offen' end
  from public.kitchen_ticket_items kti
  where kti.ticket_id = v_ticket_id and kti.order_item_id = oi.id;

  select count(*), count(*) filter (where i.status = 'ready'),
    count(*) filter (where i.status = 'cancelled'), count(*) filter (where i.status = 'preparing'),
    min(i.preparing_at), max(i.ready_at), max(i.cancelled_at)
  into v_all_count, v_ready_count, v_cancelled_count, v_preparing_count,
    v_preparing_at, v_ready_at, v_cancelled_at
  from public.kitchen_ticket_items i where i.ticket_id = v_ticket_id;
  v_count := v_all_count;
  if v_count = 0 then raise exception 'Kitchen ticket has no items'; end if;
  v_ticket_status := case
    when v_cancelled_count = v_all_count then 'cancelled'
    when v_ready_count + v_cancelled_count = v_all_count then 'ready'
    when v_preparing_count > 0 or v_ready_count > 0 then 'preparing'
    else 'queued' end;

  update public.kitchen_tickets t set
    status = v_ticket_status,
    version = t.version + 1,
    preparing_at = case when v_ticket_status in ('preparing', 'ready')
      then coalesce(t.preparing_at, v_preparing_at, v_ready_at, now()) else t.preparing_at end,
    ready_at = case when v_ticket_status = 'ready'
      then coalesce(t.ready_at, v_ready_at, now()) else t.ready_at end,
    cancelled_at = case when v_ticket_status = 'cancelled'
      then coalesce(t.cancelled_at, v_cancelled_at, now()) else t.cancelled_at end,
    updated_at = now()
  where t.id = v_ticket_id
    and (t.status is distinct from v_ticket_status
      or (v_ticket_status in ('preparing', 'ready') and t.preparing_at is null)
      or (v_ticket_status = 'ready' and t.ready_at is null)
      or (v_ticket_status = 'cancelled' and t.cancelled_at is null));

  update public.customer_orders o set
    status = case v_ticket_status
      when 'preparing' then 'in_zubereitung'
      when 'ready' then 'fertig'
      when 'cancelled' then 'storniert'
      else o.status end,
    zubereitung_start = case when v_ticket_status in ('preparing', 'ready')
      then coalesce(o.zubereitung_start, v_preparing_at, v_ready_at, now()) else o.zubereitung_start end,
    fertig_am = case when v_ticket_status = 'ready'
      then coalesce(o.fertig_am, v_ready_at, now()) else o.fertig_am end
  where o.id = p_order_id and o.tenant_id = p_tenant_id and o.location_id = p_location_id
    and o.status in ('wartet_auf_zahlung', 'neu', 'bestätigt', 'in_zubereitung', 'fertig');

  insert into public.kitchen_ticket_events (
    tenant_id, location_id, ticket_id, event_type, to_status, idempotency_key, metadata
  ) values (
    p_tenant_id, p_location_id, v_ticket_id, 'enqueued', v_ticket_status, p_idempotency_key,
    jsonb_build_object('source', p_source, 'items', v_count)
  ) on conflict (tenant_id, idempotency_key) do nothing;

  select e.ticket_id into v_idempotent_ticket
  from public.kitchen_ticket_events e
  where e.tenant_id = p_tenant_id and e.idempotency_key = p_idempotency_key;
  if v_idempotent_ticket is distinct from v_ticket_id then
    raise exception 'Kitchen idempotency key conflict';
  end if;
  return query select v_ticket_id, v_created, v_count;
end;
$$;

create or replace function public.advance_kitchen_ticket_item_atomic(
  p_tenant_id uuid, p_location_id uuid, p_ticket_item_id uuid, p_station_id uuid,
  p_actor_employee_id uuid, p_target_status text, p_idempotency_key uuid
)
returns table (ticket_id uuid, item_status text, ticket_status text, order_status text, was_changed boolean)
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v_item public.kitchen_ticket_items%rowtype;
  v_ticket public.kitchen_tickets%rowtype;
  v_next_ticket text;
  v_order_status text;
  v_all_count integer;
  v_ready_count integer;
  v_cancelled_count integer;
  v_preparing_count integer;
  v_prior_item_id uuid;
  v_prior_target text;
begin
  if p_tenant_id is null or p_location_id is null or p_ticket_item_id is null
     or p_station_id is null or p_idempotency_key is null then raise exception 'Missing kitchen transition identity'; end if;
  if p_target_status not in ('preparing', 'ready', 'cancelled') then raise exception 'Invalid kitchen target status'; end if;
  perform pg_advisory_xact_lock(hashtextextended('kitchen-item:' || p_tenant_id::text || ':' || p_ticket_item_id::text, 0));

  select * into v_item from public.kitchen_ticket_items i
  where i.id = p_ticket_item_id and i.tenant_id = p_tenant_id
    and i.location_id = p_location_id and i.station_id = p_station_id for update;
  if not found then raise exception 'Kitchen item is outside tenant, location or station'; end if;
  select * into v_ticket from public.kitchen_tickets t
  where t.id = v_item.ticket_id and t.tenant_id = p_tenant_id and t.location_id = p_location_id for update;
  if not found then raise exception 'Kitchen ticket ownership mismatch'; end if;
  if p_actor_employee_id is not null and not exists (
    select 1 from public.employees e where e.id = p_actor_employee_id
      and e.tenant_id = p_tenant_id and e.location_id = p_location_id
  ) then raise exception 'Kitchen actor is outside tenant or location'; end if;

  select e.ticket_item_id, e.to_status into v_prior_item_id, v_prior_target
  from public.kitchen_ticket_events e
  where e.tenant_id = p_tenant_id and e.idempotency_key = p_idempotency_key;
  if found then
    if v_prior_item_id is distinct from v_item.id or v_prior_target is distinct from p_target_status then
      raise exception 'Kitchen idempotency key conflict';
    end if;
    select o.status into v_order_status from public.customer_orders o where o.id = v_ticket.order_id;
    return query select v_ticket.id, v_item.status, v_ticket.status, v_order_status, false;
    return;
  end if;
  if v_item.status = p_target_status then
    return query select v_ticket.id, v_item.status, v_ticket.status,
      (select o.status from public.customer_orders o where o.id = v_ticket.order_id), false;
    return;
  end if;
  if not ((v_item.status = 'queued' and p_target_status in ('preparing', 'ready', 'cancelled'))
          or (v_item.status = 'preparing' and p_target_status in ('ready', 'cancelled'))) then
    raise exception 'Kitchen item status transition is not allowed';
  end if;

  update public.kitchen_ticket_items i
  set status = p_target_status, version = i.version + 1,
      preparing_at = case when p_target_status = 'preparing' then coalesce(i.preparing_at, now()) else i.preparing_at end,
      ready_at = case when p_target_status = 'ready' then coalesce(i.ready_at, now()) else i.ready_at end,
      cancelled_at = case when p_target_status = 'cancelled' then coalesce(i.cancelled_at, now()) else i.cancelled_at end,
      updated_at = now()
  where i.id = v_item.id;
  update public.order_items oi set station_status = case p_target_status
    when 'preparing' then 'in_arbeit' when 'ready' then 'fertig' else 'storniert' end
  where oi.id = v_item.order_item_id;

  select count(*), count(*) filter (where i.status = 'ready'),
    count(*) filter (where i.status = 'cancelled'), count(*) filter (where i.status = 'preparing')
  into v_all_count, v_ready_count, v_cancelled_count, v_preparing_count
  from public.kitchen_ticket_items i where i.ticket_id = v_ticket.id;
  v_next_ticket := case
    when v_cancelled_count = v_all_count then 'cancelled'
    when v_ready_count + v_cancelled_count = v_all_count then 'ready'
    when v_preparing_count > 0 or v_ready_count > 0 then 'preparing'
    else 'queued' end;

  update public.kitchen_tickets t set status = v_next_ticket, version = t.version + 1,
    preparing_at = case when v_next_ticket = 'preparing' then coalesce(t.preparing_at, now()) else t.preparing_at end,
    ready_at = case when v_next_ticket = 'ready' then coalesce(t.ready_at, now()) else t.ready_at end,
    cancelled_at = case when v_next_ticket = 'cancelled' then coalesce(t.cancelled_at, now()) else t.cancelled_at end,
    updated_at = now() where t.id = v_ticket.id;

  update public.customer_orders o set
    status = case when v_next_ticket = 'ready' then 'fertig'
                  when v_next_ticket = 'preparing' then 'in_zubereitung' else o.status end,
    zubereitung_start = case when v_next_ticket = 'preparing' then coalesce(o.zubereitung_start, now()) else o.zubereitung_start end,
    fertig_am = case when v_next_ticket = 'ready' then coalesce(o.fertig_am, now()) else o.fertig_am end
  where o.id = v_ticket.order_id and o.tenant_id = p_tenant_id and o.location_id = p_location_id
    and o.status in ('wartet_auf_zahlung', 'neu', 'bestätigt', 'in_zubereitung', 'fertig')
  returning o.status into v_order_status;
  if v_order_status is null then select o.status into v_order_status from public.customer_orders o where o.id = v_ticket.order_id; end if;

  insert into public.kitchen_ticket_events (
    tenant_id, location_id, ticket_id, ticket_item_id, actor_employee_id,
    event_type, from_status, to_status, idempotency_key
  ) values (
    p_tenant_id, p_location_id, v_ticket.id, v_item.id, p_actor_employee_id,
    p_target_status, v_item.status, p_target_status, p_idempotency_key
  );
  return query select v_ticket.id, p_target_status, v_next_ticket, v_order_status, true;
end;
$$;

create or replace function public.enqueue_kitchen_item_after_insert_084()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_order public.customer_orders%rowtype;
begin
  select * into v_order from public.customer_orders o where o.id = new.order_id;
  if found and (coalesce(v_order.bezahlt, false) or v_order.zahlungsart = 'bar') then
    perform * from public.enqueue_kitchen_ticket_atomic(
      v_order.tenant_id, v_order.location_id, v_order.id,
      public.kitchen_ticket_source_084(v_order.order_channel, to_jsonb(v_order)->>'external_source', v_order.kellner_id),
      v_order.id
    );
  end if;
  return new;
end;
$$;

create or replace function public.enqueue_kitchen_ticket_after_payment_084()
returns trigger language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if coalesce(new.bezahlt, false) and not coalesce(old.bezahlt, false) then
    perform * from public.enqueue_kitchen_ticket_atomic(
      new.tenant_id, new.location_id, new.id,
      public.kitchen_ticket_source_084(new.order_channel, to_jsonb(new)->>'external_source', new.kellner_id),
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists enqueue_kitchen_item_084 on public.order_items;
create trigger enqueue_kitchen_item_084 after insert on public.order_items
for each row execute function public.enqueue_kitchen_item_after_insert_084();

drop trigger if exists enqueue_kitchen_payment_084 on public.customer_orders;
create trigger enqueue_kitchen_payment_084 after update of bezahlt on public.customer_orders
for each row when (new.bezahlt is true and old.bezahlt is distinct from true)
execute function public.enqueue_kitchen_ticket_after_payment_084();

-- Preserve active work that was created shortly before the migration. Closed
-- history is deliberately not copied into the operational kitchen queue.
do $$
declare v_order record;
begin
  for v_order in
    select o.id, o.tenant_id, o.location_id, o.order_channel, o.kellner_id, to_jsonb(o)->>'external_source' as external_source
    from public.customer_orders o
    where (coalesce(o.bezahlt, false) or o.zahlungsart = 'bar')
      and o.status in ('wartet_auf_zahlung', 'neu', 'bestätigt', 'in_zubereitung')
      and exists (select 1 from public.order_items oi where oi.order_id = o.id)
      and coalesce(o.bestellt_am, nullif(to_jsonb(o)->>'created_at', '')::timestamptz) >= now() - interval '24 hours'
  loop
    perform * from public.enqueue_kitchen_ticket_atomic(
      v_order.tenant_id, v_order.location_id, v_order.id,
      public.kitchen_ticket_source_084(v_order.order_channel, v_order.external_source, v_order.kellner_id),
      v_order.id
    );
  end loop;
end $$;

revoke all on function public.enqueue_kitchen_ticket_atomic(uuid,uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.advance_kitchen_ticket_item_atomic(uuid,uuid,uuid,uuid,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.enqueue_kitchen_ticket_atomic(uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.advance_kitchen_ticket_item_atomic(uuid,uuid,uuid,uuid,uuid,text,uuid) to service_role;

commit;
