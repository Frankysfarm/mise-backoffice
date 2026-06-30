-- =====================================================================
-- Free-Product-Bonus System
-- Pro Bestellung 1x Gratis-Produkt — Anti-Cheat: max 1x / 7 Tage / Kunde
-- =====================================================================

-- ENUM für Trigger-Modi
do $$ begin
  if not exists (select 1 from pg_type where typname = 'fp_trigger_mode') then
    create type fp_trigger_mode as enum ('immer', 'ab_betrag', 'nach_sekunden');
  end if;
  if not exists (select 1 from pg_type where typname = 'fp_placement') then
    create type fp_placement as enum ('cart', 'checkout', 'popup');
  end if;
end $$;

-- Haupt-Konfiguration pro Tenant
create table if not exists free_product_configs (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  aktiv           boolean not null default false,
  eligible_item_ids  uuid[] not null default '{}',
  trigger_mode    fp_trigger_mode not null default 'immer',
  trigger_ab_betrag  numeric(10,2),
  trigger_nach_sekunden integer,
  placement       fp_placement not null default 'popup',
  cooldown_tage   integer not null default 7,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (tenant_id)
);

create trigger trg_fp_config_updated
  before update on free_product_configs
  for each row execute function set_updated_at();

-- Einlösungs-Tracking für Anti-Cheat
create table if not exists customer_free_product_redemptions (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  order_id        uuid references customer_orders(id) on delete set null,
  menu_item_id    uuid not null references menu_items(id) on delete restrict,
  kunde_email     text,
  kunde_telefon   text,
  item_name       text not null,
  item_preis      numeric(10,2) not null default 0,
  eingeloest_am   timestamptz default now(),
  constraint chk_fp_kunde_ident check (
    kunde_email is not null or kunde_telefon is not null
  )
);

create index if not exists idx_fp_redeem_tenant_email
  on customer_free_product_redemptions(tenant_id, kunde_email, eingeloest_am desc)
  where kunde_email is not null;

create index if not exists idx_fp_redeem_tenant_tel
  on customer_free_product_redemptions(tenant_id, kunde_telefon, eingeloest_am desc)
  where kunde_telefon is not null;

create index if not exists idx_fp_redeem_order
  on customer_free_product_redemptions(order_id);

-- customer_orders: gratis_produkt-Spalten hinzufügen
alter table customer_orders
  add column if not exists gratis_produkt_item_id  uuid references menu_items(id) on delete set null,
  add column if not exists gratis_produkt_name     text,
  add column if not exists gratis_produkt_wert     numeric(10,2) default 0;

-- RPC: check_free_product_eligibility
create or replace function check_free_product_eligibility(
  p_tenant_id      uuid,
  p_bestellwert    numeric default 0,
  p_kunde_email    text    default null,
  p_kunde_telefon  text    default null
)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  cfg   free_product_configs%rowtype;
  last_redeem timestamptz;
  cooldown_ends timestamptz;
begin
  select * into cfg
    from free_product_configs
    where tenant_id = p_tenant_id and aktiv = true
    limit 1;

  if not found then
    return jsonb_build_object('eligible', false, 'reason', 'feature_inactive');
  end if;

  if array_length(cfg.eligible_item_ids, 1) is null then
    return jsonb_build_object('eligible', false, 'reason', 'no_items_configured');
  end if;

  if cfg.trigger_mode = 'ab_betrag' and cfg.trigger_ab_betrag is not null then
    if p_bestellwert < cfg.trigger_ab_betrag then
      return jsonb_build_object(
        'eligible', false,
        'reason', 'min_betrag_not_reached',
        'trigger_ab_betrag', cfg.trigger_ab_betrag
      );
    end if;
  end if;

  if p_kunde_email is not null or p_kunde_telefon is not null then
    select max(r.eingeloest_am) into last_redeem
      from customer_free_product_redemptions r
      where r.tenant_id = p_tenant_id
        and (
          (p_kunde_email    is not null and r.kunde_email    = p_kunde_email)    or
          (p_kunde_telefon  is not null and r.kunde_telefon  = p_kunde_telefon)
        )
        and r.eingeloest_am > now() - (cfg.cooldown_tage || ' days')::interval;

    if last_redeem is not null then
      cooldown_ends := last_redeem + (cfg.cooldown_tage || ' days')::interval;
      return jsonb_build_object(
        'eligible', false,
        'reason', 'cooldown_active',
        'cooldown_ends_at', cooldown_ends
      );
    end if;
  end if;

  return jsonb_build_object(
    'eligible', true,
    'reason', null,
    'eligible_item_ids', cfg.eligible_item_ids,
    'placement', cfg.placement::text,
    'trigger_mode', cfg.trigger_mode::text,
    'trigger_nach_sekunden', cfg.trigger_nach_sekunden
  );
end $$;

grant execute on function check_free_product_eligibility(uuid, numeric, text, text)
  to anon, authenticated, service_role;

-- RPC: redeem_free_product
create or replace function redeem_free_product(
  p_tenant_id     uuid,
  p_order_id      uuid,
  p_menu_item_id  uuid,
  p_kunde_email   text default null,
  p_kunde_telefon text default null
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  cfg        free_product_configs%rowtype;
  item_rec   menu_items%rowtype;
  existing   integer;
begin
  select * into cfg
    from free_product_configs
    where tenant_id = p_tenant_id and aktiv = true limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'feature_inactive');
  end if;

  if not (p_menu_item_id = any(cfg.eligible_item_ids)) then
    return jsonb_build_object('ok', false, 'error', 'item_not_eligible');
  end if;

  select count(*) into existing
    from customer_free_product_redemptions
    where order_id = p_order_id;
  if existing > 0 then
    return jsonb_build_object('ok', false, 'error', 'already_redeemed_for_order');
  end if;

  select * into item_rec from menu_items where id = p_menu_item_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'item_not_found');
  end if;

  insert into customer_free_product_redemptions (
    tenant_id, order_id, menu_item_id,
    kunde_email, kunde_telefon,
    item_name, item_preis
  ) values (
    p_tenant_id, p_order_id, p_menu_item_id,
    p_kunde_email, p_kunde_telefon,
    item_rec.name, item_rec.preis
  );

  return jsonb_build_object(
    'ok', true,
    'item_name', item_rec.name,
    'item_preis', item_rec.preis
  );
end $$;

grant execute on function redeem_free_product(uuid, uuid, uuid, text, text)
  to anon, authenticated, service_role;

-- RLS
alter table free_product_configs enable row level security;
alter table customer_free_product_redemptions enable row level security;

create policy "fp_config_public_read" on free_product_configs
  for select using (true);

create policy "fp_config_tenant_write" on free_product_configs
  for all using (
    tenant_id = current_setting('app.tenant_id')::uuid
  ) with check (
    tenant_id = current_setting('app.tenant_id')::uuid
  );

create policy "fp_redemptions_public_insert" on customer_free_product_redemptions
  for insert with check (true);

create policy "fp_redemptions_tenant_read" on customer_free_product_redemptions
  for select using (
    tenant_id = current_setting('app.tenant_id')::uuid
    or auth.role() = 'service_role'
  );
