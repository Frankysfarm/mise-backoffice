-- 071_multitenant_customer_launch_hardening.sql
-- Launch hardening for a true multi-restaurant setup:
--   * one Supabase identity may own one customer profile per restaurant
--   * customer/order links can never cross tenant boundaries
--   * loyalty counters are applied exactly once and can be rebuilt from orders
--   * public/authenticated clients cannot bypass server-side order validation
--   * sensitive tenant tables are service-only instead of Data-API readable
--   * driver assignments must belong to the order/batch restaurant

begin;

-- Campaigns are individual records. The original table-level uniqueness on
-- (tenant_id, konfig_typ) made the backoffice's multi-campaign editor lie: a
-- restaurant could not save "Cola bei jeder Bestellung" alongside "jede 3.
-- Bestellung", because both are normal selection campaigns. Keep an ordinary
-- tenant/type index for list performance, but allow independently configured
-- campaigns and let the eligibility function apply its deterministic priority.
alter table public.free_product_configs
  drop constraint if exists free_product_configs_tenant_konfig_key;

create index if not exists free_product_configs_tenant_konfig_idx
  on public.free_product_configs (tenant_id, konfig_typ);

-- ---------------------------------------------------------------------------
-- 1. Customer identities are tenant-scoped, not globally unique.
-- ---------------------------------------------------------------------------

alter table public.customer_profiles
  drop constraint if exists customer_profiles_auth_user_id_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.customer_profiles'::regclass
      and conname = 'customer_profiles_tenant_auth_user_key'
  ) then
    alter table public.customer_profiles
      add constraint customer_profiles_tenant_auth_user_key
      unique (tenant_id, auth_user_id);
  end if;
end $$;

-- Required for a composite FK from orders. The primary key still remains the
-- canonical row identity; this additional key makes the tenant part explicit.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.customer_profiles'::regclass
      and conname = 'customer_profiles_id_tenant_key'
  ) then
    alter table public.customer_profiles
      add constraint customer_profiles_id_tenant_key unique (id, tenant_id);
  end if;
end $$;

-- Emails are login identifiers. Normalize the existing CRM rows first, then
-- prevent case/whitespace variants from creating two accounts in one tenant.
update public.customer_profiles
set email = lower(btrim(email))
where email is not null
  and email is distinct from lower(btrim(email));

create unique index if not exists customer_profiles_tenant_email_normalized_uidx
  on public.customer_profiles (tenant_id, lower(btrim(email)))
  where email is not null and btrim(email) <> '';

create index if not exists customer_profiles_tenant_phone_normalized_idx
  on public.customer_profiles (tenant_id, regexp_replace(telefon, '\D', '', 'g'))
  where telefon is not null and regexp_replace(telefon, '\D', '', 'g') <> '';

alter table public.customer_orders
  drop constraint if exists customer_orders_customer_profile_tenant_fkey;

alter table public.customer_orders
  add constraint customer_orders_customer_profile_tenant_fkey
  foreign key (customer_profile_id, tenant_id)
  references public.customer_profiles (id, tenant_id)
  on delete set null (customer_profile_id);

create index if not exists customer_orders_profile_tenant_created_idx
  on public.customer_orders (customer_profile_id, tenant_id, created_at desc)
  where customer_profile_id is not null;

-- ---------------------------------------------------------------------------
-- 2. One profile linker and one idempotent loyalty counter.
-- ---------------------------------------------------------------------------

-- The old installation had two BEFORE INSERT profile triggers. One of them
-- incremented counters for every submitted order and the other linked again.
drop trigger if exists trg_customer_orders_link_profile on public.customer_orders;
drop trigger if exists trg_loyalty_on_order_insert on public.customer_orders;
drop trigger if exists trg_loyalty_on_order_update on public.customer_orders;

create or replace function public.fn_link_or_create_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_profile_id uuid;
  v_location_tenant uuid;
  v_email text;
  v_phone text;
begin
  select tenant_id into v_location_tenant
  from public.locations
  where id = new.location_id;

  if v_location_tenant is null then
    raise exception 'Order location has no tenant';
  end if;

  if new.tenant_id is null then
    new.tenant_id := v_location_tenant;
  elsif new.tenant_id <> v_location_tenant then
    raise exception 'Order tenant does not match location tenant';
  end if;

  v_email := nullif(lower(btrim(new.kunde_email)), '');
  v_phone := nullif(btrim(new.kunde_telefon), '');
  new.kunde_email := v_email;
  new.kunde_telefon := v_phone;

  if new.customer_profile_id is not null then
    select id into v_profile_id
    from public.customer_profiles
    where id = new.customer_profile_id
      and tenant_id = new.tenant_id;

    if v_profile_id is null then
      raise exception 'Customer profile does not belong to order tenant';
    end if;
    return new;
  end if;

  if v_email is not null then
    select id into v_profile_id
    from public.customer_profiles
    where tenant_id = new.tenant_id
      and lower(btrim(email)) = v_email
    order by created_at, id
    limit 1;
  end if;

  if v_profile_id is null and v_phone is not null then
    select id into v_profile_id
    from public.customer_profiles
    where tenant_id = new.tenant_id
      and regexp_replace(telefon, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
    order by created_at, id
    limit 1;
  end if;

  if v_profile_id is null and (v_email is not null or v_phone is not null) then
    begin
      insert into public.customer_profiles (tenant_id, name, email, telefon)
      values (new.tenant_id, nullif(btrim(new.kunde_name), ''), v_email, v_phone)
      returning id into v_profile_id;
    exception when unique_violation then
      -- A simultaneous checkout may have created the same profile first.
      if v_email is not null then
        select id into v_profile_id
        from public.customer_profiles
        where tenant_id = new.tenant_id
          and lower(btrim(email)) = v_email
        order by created_at, id
        limit 1;
      end if;
      if v_profile_id is null and v_phone is not null then
        select id into v_profile_id
        from public.customer_profiles
        where tenant_id = new.tenant_id
          and regexp_replace(telefon, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
        order by created_at, id
        limit 1;
      end if;
      if v_profile_id is null then
        raise;
      end if;
    end;
  end if;

  if v_profile_id is not null then
    update public.customer_profiles
    set name = coalesce(nullif(btrim(name), ''), nullif(btrim(new.kunde_name), '')),
        email = coalesce(email, v_email),
        telefon = coalesce(telefon, v_phone),
        letzter_besuch = greatest(coalesce(letzter_besuch, '-infinity'::timestamptz), now())
    where id = v_profile_id;
  end if;

  new.customer_profile_id := v_profile_id;
  return new;
end;
$$;

-- Keep only the deterministic linker. The trigger name sorts before the
-- loyalty trigger below, so NEW.customer_profile_id is ready first.
drop trigger if exists trg_link_customer_profile_on_order on public.customer_orders;
create trigger trg_link_customer_profile_on_order
before insert or update of location_id, tenant_id, customer_profile_id, kunde_email, kunde_telefon
on public.customer_orders
for each row execute function public.fn_link_or_create_customer_profile();

alter table public.customer_orders
  add column if not exists loyalty_counted boolean not null default false;

create or replace function public.fn_apply_customer_loyalty_once()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_old_counted boolean := false;
  v_new_should_count boolean := false;
  v_profile_changed boolean := false;
  v_old_amount numeric := 0;
  v_new_amount numeric := 0;
  v_old_rewards integer := 0;
  v_new_rewards integer := 0;
begin
  if tg_op = 'UPDATE' then
    v_old_counted := coalesce(old.loyalty_counted, false);
    v_profile_changed := old.customer_profile_id is distinct from new.customer_profile_id;
    v_old_amount := coalesce(old.gesamtbetrag, 0);
    v_old_rewards := coalesce(old.reward_items_count, 0);
  end if;

  v_new_amount := coalesce(new.gesamtbetrag, 0);
  v_new_rewards := coalesce(new.reward_items_count, 0);
  v_new_should_count := new.customer_profile_id is not null
    and new.status <> 'storniert'
    and (coalesce(new.bezahlt, false) or new.status in ('geliefert', 'abgeholt'));

  if v_profile_changed and v_old_counted and old.customer_profile_id is not null then
    update public.customer_profiles
    set anzahl_bestellungen = greatest(0, coalesce(anzahl_bestellungen, 0) - 1),
        umsatz_total = greatest(0, coalesce(umsatz_total, 0) - v_old_amount),
        bonus_points = greatest(0, coalesce(bonus_points, 0) - 1),
        loyalty_rewards_claimed = greatest(0, coalesce(loyalty_rewards_claimed, 0) - v_old_rewards)
    where id = old.customer_profile_id
      and tenant_id = old.tenant_id;
    v_old_counted := false;
  end if;

  if v_new_should_count and not v_old_counted then
    update public.customer_profiles
    set anzahl_bestellungen = coalesce(anzahl_bestellungen, 0) + 1,
        umsatz_total = coalesce(umsatz_total, 0) + v_new_amount,
        bonus_points = coalesce(bonus_points, 0) + 1,
        loyalty_rewards_claimed = coalesce(loyalty_rewards_claimed, 0) + v_new_rewards,
        letzter_besuch = now()
    where id = new.customer_profile_id
      and tenant_id = new.tenant_id;
    new.loyalty_counted := true;
  elsif not v_new_should_count and v_old_counted then
    update public.customer_profiles
    set anzahl_bestellungen = greatest(0, coalesce(anzahl_bestellungen, 0) - 1),
        umsatz_total = greatest(0, coalesce(umsatz_total, 0) - v_old_amount),
        bonus_points = greatest(0, coalesce(bonus_points, 0) - 1),
        loyalty_rewards_claimed = greatest(0, coalesce(loyalty_rewards_claimed, 0) - v_old_rewards)
    where id = new.customer_profile_id
      and tenant_id = new.tenant_id;
    new.loyalty_counted := false;
  elsif v_new_should_count and v_old_counted then
    -- A corrected total/reward count must be reflected without adding a stamp.
    update public.customer_profiles
    set umsatz_total = greatest(0, coalesce(umsatz_total, 0) + v_new_amount - v_old_amount),
        loyalty_rewards_claimed = greatest(0, coalesce(loyalty_rewards_claimed, 0) + v_new_rewards - v_old_rewards),
        letzter_besuch = now()
    where id = new.customer_profile_id
      and tenant_id = new.tenant_id;
    new.loyalty_counted := true;
  else
    new.loyalty_counted := false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_z_customer_order_loyalty on public.customer_orders;
create trigger trg_z_customer_order_loyalty
before insert or update of status, bezahlt, customer_profile_id, tenant_id, gesamtbetrag, reward_items_count
on public.customer_orders
for each row execute function public.fn_apply_customer_loyalty_once();

-- Repair existing counters from the orders as the source of truth. Completed
-- cash orders count even if an old terminal forgot to set bezahlt=true.
update public.customer_orders
set loyalty_counted = customer_profile_id is not null
  and status <> 'storniert'
  and (coalesce(bezahlt, false) or status in ('geliefert', 'abgeholt'));

with totals as (
  select customer_profile_id,
         count(*)::integer as order_count,
         coalesce(sum(gesamtbetrag), 0) as revenue,
         coalesce(sum(reward_items_count), 0)::integer as claimed,
         max(coalesce(bestellt_am, created_at)) as last_visit
  from public.customer_orders
  where loyalty_counted
    and customer_profile_id is not null
  group by customer_profile_id
)
update public.customer_profiles p
set anzahl_bestellungen = coalesce(t.order_count, 0),
    umsatz_total = coalesce(t.revenue, 0),
    bonus_points = coalesce(t.order_count, 0),
    loyalty_rewards_claimed = coalesce(t.claimed, 0),
    letzter_besuch = coalesce(t.last_visit, p.letzter_besuch)
from (select p0.id, x.order_count, x.revenue, x.claimed, x.last_visit
      from public.customer_profiles p0
      left join totals x on x.customer_profile_id = p0.id) t
where p.id = t.id;

-- ---------------------------------------------------------------------------
-- 3. Driver assignments must be active for the same restaurant.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_order_driver_tenant()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.mise_driver_id is not null and not exists (
    select 1
    from public.mise_driver_tenants dt
    where dt.driver_id = new.mise_driver_id
      and dt.tenant_id = new.tenant_id
      and dt.status = 'active'
  ) then
    raise exception 'Driver is not active for order tenant';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_order_driver_tenant on public.customer_orders;
create trigger trg_enforce_order_driver_tenant
before insert or update of mise_driver_id, tenant_id
on public.customer_orders
for each row execute function public.enforce_order_driver_tenant();

create or replace function public.enforce_batch_driver_tenant()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_tenant_id uuid;
begin
  if new.driver_id is null then
    return new;
  end if;
  select tenant_id into v_tenant_id from public.locations where id = new.location_id;
  if v_tenant_id is null or not exists (
    select 1 from public.mise_driver_tenants dt
    where dt.driver_id = new.driver_id
      and dt.tenant_id = v_tenant_id
      and dt.status = 'active'
  ) then
    raise exception 'Driver is not active for delivery batch tenant';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_batch_driver_tenant on public.mise_delivery_batches;
create trigger trg_enforce_batch_driver_tenant
before insert or update of driver_id, location_id
on public.mise_delivery_batches
for each row execute function public.enforce_batch_driver_tenant();

-- Existing historical assignments are deliberately not rewritten here. The
-- trigger prevents every new cross-tenant assignment; remediation of legacy
-- operational rows needs a separate, reviewed runbook rather than a schema
-- migration that silently changes order status.

-- ---------------------------------------------------------------------------
-- 4. Data-API and RLS hardening.
-- ---------------------------------------------------------------------------

-- These tables are accessed by authenticated server actions/service routes.
-- They contain accounting data, secrets/tokens or operational internals and do
-- not need direct browser access.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    '_debug_status_log',
    'bank_transactions', 'belege', 'domain_purchases', 'dsfinvk_exports',
    'kiosk_login_tokens', 'coverage_requirements',
    'customer_free_product_redemptions', 'free_product_configs', 'mise_alerts',
    'mise_dispatch_config', 'mise_frank_decisions', 'mise_print_jobs',
    'mise_push_outbox', 'owner_push_subscriptions', 'void_logs'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
  end loop;
end $$;

-- Postal-code cache contains no tenant/customer data. It remains publicly
-- readable, but writes are service-only and RLS is explicit.
alter table public.plz_cache enable row level security;
revoke all on table public.plz_cache from anon, authenticated;
grant select on table public.plz_cache to anon, authenticated;
drop policy if exists plz_cache_public_read on public.plz_cache;
create policy plz_cache_public_read
on public.plz_cache for select to anon, authenticated using (true);

-- Public token lookups are performed by server routes with the service role.
-- Never allow Data API clients to enumerate voucher balances, fiscal audit
-- tokens or hospitality-receipt personal data. Backoffice employees retain
-- least-privilege CRUD access, restricted to their own tenant.
drop policy if exists bew_public_by_token on public.bewirtungsbelege;
drop policy if exists bew_tenant_rw on public.bewirtungsbelege;
drop policy if exists bewirtungsbelege_tenant_rw on public.bewirtungsbelege;
revoke all on table public.bewirtungsbelege from anon, authenticated;
grant select, insert, update, delete on table public.bewirtungsbelege to authenticated;
create policy bewirtungsbelege_tenant_rw
on public.bewirtungsbelege
for all
to authenticated
using (
  exists (
    select 1
    from public.pos_transactions tx
    where tx.id = transaction_id
      and tx.tenant_id = (select public.current_tenant_id())
  )
)
with check (
  exists (
    select 1
    from public.pos_transactions tx
    where tx.id = transaction_id
      and tx.tenant_id = (select public.current_tenant_id())
  )
);

drop policy if exists gc_public_balance_check on public.gift_cards;
drop policy if exists gc_tenant_rw on public.gift_cards;
drop policy if exists gift_cards_tenant_rw on public.gift_cards;
revoke all on table public.gift_cards from anon, authenticated;
grant select, insert, update, delete on table public.gift_cards to authenticated;
create policy gift_cards_tenant_rw
on public.gift_cards
for all
to authenticated
using (tenant_id = (select public.current_tenant_id()))
with check (tenant_id = (select public.current_tenant_id()));

drop policy if exists kpt_public_by_token on public.kassenpruefung_tokens;
drop policy if exists kpt_tenant_rw on public.kassenpruefung_tokens;
drop policy if exists kassenpruefung_tokens_tenant_rw on public.kassenpruefung_tokens;
revoke all on table public.kassenpruefung_tokens from anon, authenticated;
grant select, insert, update, delete on table public.kassenpruefung_tokens to authenticated;
create policy kassenpruefung_tokens_tenant_rw
on public.kassenpruefung_tokens
for all
to authenticated
using (tenant_id = (select public.current_tenant_id()))
with check (tenant_id = (select public.current_tenant_id()));

drop policy if exists orders_public_insert on public.customer_orders;
drop policy if exists orders_authenticated_tenant_insert on public.customer_orders;
create policy orders_authenticated_tenant_insert
on public.customer_orders
for insert
to authenticated
with check (
  tenant_id = (select public.current_tenant_id())
  and exists (
    select 1 from public.locations l
    where l.id = location_id
      and l.tenant_id = (select public.current_tenant_id())
  )
);

drop policy if exists order_items_insert on public.order_items;
drop policy if exists order_items_authenticated_tenant_insert on public.order_items;
create policy order_items_authenticated_tenant_insert
on public.order_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.customer_orders o
    where o.id = order_id
      and o.tenant_id = (select public.current_tenant_id())
  )
);

drop policy if exists customer_profiles_service on public.customer_profiles;
drop policy if exists customer_profiles_self on public.customer_profiles;
drop policy if exists customer_profiles_update_self on public.customer_profiles;
drop policy if exists cp_tenant_rw on public.customer_profiles;
drop policy if exists customer_profiles_self_select on public.customer_profiles;
drop policy if exists customer_profiles_self_update on public.customer_profiles;
drop policy if exists customer_profiles_backoffice on public.customer_profiles;

create policy customer_profiles_self_select
on public.customer_profiles
for select
to authenticated
using (auth_user_id = (select auth.uid()));

create policy customer_profiles_self_update
on public.customer_profiles
for update
to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));

create policy customer_profiles_backoffice
on public.customer_profiles
for all
to authenticated
using (tenant_id = (select public.current_tenant_id()) and (select public.is_backoffice()))
with check (tenant_id = (select public.current_tenant_id()) and (select public.is_backoffice()));

-- Remove deprecated auth.role() branches. The service role bypasses RLS on
-- these non-FORCE-RLS tables; putting it in public policies only increases the
-- attack surface and hides missing tenant predicates.
drop policy if exists orders_tenant_update on public.customer_orders;
create policy orders_tenant_update
on public.customer_orders
for update
to authenticated
using (
  tenant_id = (select public.current_tenant_id())
  and exists (
    select 1 from public.locations l
    where l.id = location_id
      and l.tenant_id = (select public.current_tenant_id())
  )
)
with check (
  tenant_id = (select public.current_tenant_id())
  and exists (
    select 1 from public.locations l
    where l.id = location_id
      and l.tenant_id = (select public.current_tenant_id())
  )
);

drop policy if exists batches_tenant_read on public.delivery_batches;
create policy batches_tenant_read
on public.delivery_batches
for select
to authenticated
using (
  exists (
    select 1 from public.locations l
    where l.id = location_id
      and l.tenant_id = (select public.current_tenant_id())
  )
  or fahrer_id = (select public.current_employee_id())
);

drop policy if exists deliveries_service_write on public.email_campaign_deliveries;
drop policy if exists outbox_service_all on public.email_outbox;
drop policy if exists pal_service_all on public.pruefung_access_log;

drop policy if exists register_tenant_read on public.pos_registers;
create policy register_tenant_read
on public.pos_registers
for select
to authenticated
using (
  exists (
    select 1 from public.locations l
    where l.id = location_id
      and l.tenant_id = (select public.current_tenant_id())
  )
);

drop policy if exists trans_tenant_read on public.pos_transactions;
create policy trans_tenant_read
on public.pos_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.pos_registers r
    join public.locations l on l.id = r.location_id
    where r.id = register_id
      and l.tenant_id = (select public.current_tenant_id())
  )
);

drop policy if exists tenant_modules_read on public.tenant_modules;
drop policy if exists tenant_modules_write on public.tenant_modules;
create policy tenant_modules_read
on public.tenant_modules
for select
to authenticated
using (tenant_id = (select public.current_tenant_id()));
create policy tenant_modules_write
on public.tenant_modules
for all
to authenticated
using (
  tenant_id = (select public.current_tenant_id())
  and (select public.is_backoffice())
)
with check (
  tenant_id = (select public.current_tenant_id())
  and (select public.is_backoffice())
);

drop policy if exists tenants_read_own on public.tenants;
create policy tenants_read_own
on public.tenants
for select
to authenticated
using (id = (select public.current_tenant_id()));

-- ---------------------------------------------------------------------------
-- 5. Persistent, privacy-preserving rate limit for branded login emails.
-- ---------------------------------------------------------------------------

create table if not exists public.customer_auth_requests (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email_hash text not null check (length(email_hash) = 64),
  ip_hash text not null check (length(ip_hash) = 64),
  requested_at timestamptz not null default now()
);

alter table public.customer_auth_requests enable row level security;
revoke all on table public.customer_auth_requests from anon, authenticated;

create index if not exists customer_auth_requests_email_recent_idx
  on public.customer_auth_requests (tenant_id, email_hash, requested_at desc);
create index if not exists customer_auth_requests_ip_recent_idx
  on public.customer_auth_requests (tenant_id, ip_hash, requested_at desc);

create or replace function public.reserve_customer_auth_request(
  p_tenant_id uuid,
  p_email_hash text,
  p_ip_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_email_count integer;
  v_ip_count integer;
begin
  if p_tenant_id is null
     or p_email_hash !~ '^[0-9a-f]{64}$'
     or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_email_hash, 0));

  select count(*) into v_email_count
  from public.customer_auth_requests
  where tenant_id = p_tenant_id
    and email_hash = p_email_hash
    and requested_at >= now() - interval '10 minutes';

  select count(*) into v_ip_count
  from public.customer_auth_requests
  where tenant_id = p_tenant_id
    and ip_hash = p_ip_hash
    and requested_at >= now() - interval '10 minutes';

  if v_email_count >= 3 or v_ip_count >= 15 then
    return false;
  end if;

  insert into public.customer_auth_requests (tenant_id, email_hash, ip_hash)
  values (p_tenant_id, p_email_hash, p_ip_hash);
  return true;
end;
$$;

revoke all on function public.reserve_customer_auth_request(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reserve_customer_auth_request(uuid, text, text) to service_role;

-- Storefront promotion checks and redemptions are mediated by server routes;
-- browsers must neither enumerate campaign rules nor call SECURITY DEFINER
-- redemption functions directly.
revoke all on function public.check_free_product_eligibility(uuid, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.check_free_product_eligibility(uuid, numeric, text, text)
  to service_role;
revoke all on function public.redeem_free_product(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.redeem_free_product(uuid, uuid, uuid, text, text)
  to service_role;

commit;
