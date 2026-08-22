\set ON_ERROR_STOP on

begin;

do $$
declare
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_location_a uuid;
  v_location_b uuid;
  v_auth_user uuid;
  v_profile_a uuid;
  v_profile_b uuid;
  v_order uuid;
  v_item_a uuid;
  v_item_b uuid;
  v_config uuid;
  v_config_always uuid;
  v_promotion jsonb;
  v_count integer;
  v_revenue numeric;
begin
  select tenant_id, id into v_tenant_a, v_location_a
  from public.locations where aktiv order by created_at limit 1;
  select tenant_id, id into v_tenant_b, v_location_b
  from public.locations where aktiv and tenant_id <> v_tenant_a order by created_at limit 1;
  select id into v_auth_user from auth.users order by created_at limit 1;

  if v_tenant_a is null or v_tenant_b is null or v_auth_user is null then
    raise exception '071 test requires two tenants/locations and one auth user';
  end if;

  insert into public.customer_profiles (tenant_id, auth_user_id, email, name)
  values (v_tenant_a, v_auth_user, 'launch-071-a@example.invalid', 'Test A')
  returning id into v_profile_a;

  -- Same identity in a second restaurant must be allowed.
  insert into public.customer_profiles (tenant_id, auth_user_id, email, name)
  values (v_tenant_b, v_auth_user, 'launch-071-b@example.invalid', 'Test B')
  returning id into v_profile_b;

  -- Paid order receives one stamp exactly once.
  insert into public.customer_orders (
    tenant_id, location_id, typ, status, kunde_name, kunde_email,
    zwischensumme, gesamtbetrag, zahlungsart, bezahlt, customer_profile_id
  ) values (
    v_tenant_a, v_location_a, 'lieferung', 'neu', 'Launch Test',
    'launch-071-a@example.invalid', 12.50, 12.50, 'bar', true, v_profile_a
  ) returning id into v_order;

  select anzahl_bestellungen, umsatz_total into v_count, v_revenue
  from public.customer_profiles where id = v_profile_a;
  if v_count <> 1 or v_revenue <> 12.50 then
    raise exception 'loyalty insert expected 1/12.50, got %/%', v_count, v_revenue;
  end if;

  update public.customer_orders set status = 'bestätigt' where id = v_order;
  select anzahl_bestellungen into v_count from public.customer_profiles where id = v_profile_a;
  if v_count <> 1 then raise exception 'loyalty double counted after status update'; end if;

  update public.customer_orders set status = 'storniert' where id = v_order;
  select anzahl_bestellungen, umsatz_total into v_count, v_revenue
  from public.customer_profiles where id = v_profile_a;
  if v_count <> 0 or v_revenue <> 0 then
    raise exception 'loyalty cancellation did not reverse';
  end if;

  insert into public.customer_orders (
    tenant_id, location_id, typ, status, kunde_name, kunde_email,
    zwischensumme, gesamtbetrag, zahlungsart, bezahlt, customer_profile_id
  ) values (
    v_tenant_a, v_location_a, 'lieferung', 'geliefert', 'Launch Cash Test',
    'launch-071-a@example.invalid', 8.50, 8.50, 'bar', false, v_profile_a
  ) returning id into v_order;
  select anzahl_bestellungen into v_count from public.customer_profiles where id = v_profile_a;
  if v_count <> 1 then raise exception 'completed cash order was not counted'; end if;

  -- A profile from another restaurant must be rejected at DB level.
  begin
    update public.customer_orders set customer_profile_id = v_profile_b where id = v_order;
    raise exception 'cross-tenant customer profile link unexpectedly succeeded';
  exception when foreign_key_violation or raise_exception then
    if sqlerrm = 'cross-tenant customer profile link unexpectedly succeeded' then raise; end if;
  end;

  -- The current recurring free-product system must implement "every second
  -- order" exactly, reject products from another restaurant and allow only
  -- one redemption per order.
  select mi.id into v_item_a
  from public.menu_items mi
  join public.locations l on l.id = mi.location_id
  where l.tenant_id = v_tenant_a and mi.verfuegbar
  order by mi.created_at limit 1;
  select mi.id into v_item_b
  from public.menu_items mi
  join public.locations l on l.id = mi.location_id
  where l.tenant_id = v_tenant_b and mi.verfuegbar
  order by mi.created_at limit 1;
  if v_item_a is null or v_item_b is null then
    raise exception '071 promotion test requires one available item per tenant';
  end if;

  update public.free_product_configs set aktiv = false where tenant_id = v_tenant_a;
  insert into public.free_product_configs (
    tenant_id, aktiv, eligible_item_ids, trigger_mode,
    trigger_nach_bestellungen, placement, cooldown_tage,
    anzeige_titel, anzeige_text, konfig_typ
  ) values (
    v_tenant_a, true, array[v_item_a], 'nach_x_bestellungen',
    2, 'checkout', 0, '071 test', '071 test', 'auswahl'
  )
  returning id into v_config;

  -- Two campaigns of the same type are a supported backoffice use case:
  -- e.g. Cola on every order plus a larger gift every third order.
  insert into public.free_product_configs (
    tenant_id, aktiv, eligible_item_ids, trigger_mode,
    placement, cooldown_tage, anzeige_titel, anzeige_text, konfig_typ
  ) values (
    v_tenant_a, true, array[v_item_a], 'immer',
    'checkout', 0, '071 always test', '071 always test', 'auswahl'
  ) returning id into v_config_always;

  if v_config_always is null then
    raise exception 'parallel promotion campaign was not created';
  end if;

  select public.check_free_product_eligibility(
    v_tenant_a, 25, 'launch-071-a@example.invalid', null
  ) into v_promotion;
  if not coalesce((v_promotion->>'eligible')::boolean, false)
     or (v_promotion->>'config_id')::uuid <> v_config then
    raise exception 'second-order promotion eligibility failed: %', v_promotion;
  end if;

  insert into public.customer_orders (
    tenant_id, location_id, typ, status, kunde_name, kunde_email,
    zwischensumme, gesamtbetrag, zahlungsart, bezahlt, customer_profile_id
  ) values (
    v_tenant_a, v_location_a, 'lieferung', 'neu', 'Launch Promotion Test',
    'launch-071-a@example.invalid', 25, 25, 'bar', false, v_profile_a
  ) returning id into v_order;

  select public.redeem_free_product(
    v_tenant_a, v_order, v_item_b, 'launch-071-a@example.invalid', null
  ) into v_promotion;
  if v_promotion->>'error' <> 'item_not_found' then
    raise exception 'cross-tenant promotion item was not rejected: %', v_promotion;
  end if;

  select public.redeem_free_product(
    v_tenant_a, v_order, v_item_a, 'launch-071-a@example.invalid', null
  ) into v_promotion;
  if not coalesce((v_promotion->>'ok')::boolean, false) then
    raise exception 'valid promotion redemption failed: %', v_promotion;
  end if;

  select public.redeem_free_product(
    v_tenant_a, v_order, v_item_a, 'launch-071-a@example.invalid', null
  ) into v_promotion;
  if v_promotion->>'error' <> 'already_redeemed_for_order' then
    raise exception 'duplicate promotion redemption was not rejected: %', v_promotion;
  end if;

  if has_table_privilege('anon', 'public.belege', 'SELECT') then
    raise exception 'anon still has accounting table access';
  end if;
  if has_table_privilege('authenticated', 'public.owner_push_subscriptions', 'SELECT') then
    raise exception 'authenticated still has push-secret access';
  end if;
  if has_table_privilege('anon', 'public.mise_push_outbox', 'SELECT') then
    raise exception 'anon still has driver push-outbox access';
  end if;
  if not has_table_privilege('anon', 'public.plz_cache', 'SELECT')
     or has_table_privilege('anon', 'public.plz_cache', 'INSERT') then
    raise exception 'PLZ cache privileges are not read-only';
  end if;
  if has_function_privilege('authenticated', 'public.reserve_customer_auth_request(uuid,text,text)', 'EXECUTE') then
    raise exception 'authenticated can execute login rate limiter directly';
  end if;
  if has_function_privilege('anon', 'public.check_free_product_eligibility(uuid,numeric,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.redeem_free_product(uuid,uuid,uuid,text,text)', 'EXECUTE') then
    raise exception 'browser roles can execute promotion SECURITY DEFINER functions';
  end if;
  if has_table_privilege('anon', 'public.gift_cards', 'SELECT')
     or has_table_privilege('anon', 'public.kassenpruefung_tokens', 'SELECT')
     or has_table_privilege('anon', 'public.bewirtungsbelege', 'SELECT') then
    raise exception 'anon can enumerate token/accounting tables';
  end if;
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%auth.role()%'
        or coalesce(with_check, '') like '%auth.role()%'
      )
  ) then
    raise exception 'deprecated auth.role() RLS branch remains';
  end if;
end $$;

rollback;
