-- Storefront promotion integrity
-- Distinguishes recurring free-product campaigns from account loyalty rewards,
-- fixes Nth-order semantics, and makes redemption deterministic and auditable.

BEGIN;

ALTER TABLE public.customer_free_product_redemptions
  ADD COLUMN IF NOT EXISTS config_id uuid
    REFERENCES public.free_product_configs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fp_redemption_config_customer
  ON public.customer_free_product_redemptions(config_id, kunde_email, kunde_telefon, eingeloest_am DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fp_redemption_order
  ON public.customer_free_product_redemptions(order_id)
  WHERE order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_free_product_eligibility(
  p_tenant_id uuid,
  p_bestellwert numeric DEFAULT 0,
  p_kunde_email text DEFAULT NULL,
  p_kunde_telefon text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.free_product_configs%rowtype;
  v_email text := NULLIF(lower(trim(p_kunde_email)), '');
  v_phone text := NULLIF(regexp_replace(coalesce(p_kunde_telefon, ''), '[^0-9+]', '', 'g'), '');
  v_order_count integer;
  v_redemption_count integer;
  v_last_redeem timestamptz;
BEGIN
  FOR cfg IN
    SELECT c.*
    FROM public.free_product_configs c
    WHERE c.tenant_id = p_tenant_id
      AND c.aktiv
    ORDER BY
      CASE c.trigger_mode
        WHEN 'nach_x_bestellungen' THEN 0
        WHEN 'erster_kauf' THEN 1
        WHEN 'ab_betrag' THEN 2
        WHEN 'immer' THEN 3
        WHEN 'nach_sekunden' THEN 4
        ELSE 5
      END,
      CASE c.konfig_typ WHEN 'auswahl' THEN 0 WHEN 'treue' THEN 1 ELSE 2 END,
      c.created_at,
      c.id
  LOOP
    IF coalesce(array_length(cfg.eligible_item_ids, 1), 0) = 0 THEN
      CONTINUE;
    END IF;

    SELECT count(*) INTO v_redemption_count
    FROM public.customer_free_product_redemptions r
    WHERE r.tenant_id = p_tenant_id
      AND (r.config_id = cfg.id OR (r.config_id IS NULL AND r.konfig_typ = cfg.konfig_typ));

    IF cfg.max_nutzungen_gesamt IS NOT NULL
       AND v_redemption_count >= cfg.max_nutzungen_gesamt THEN
      CONTINUE;
    END IF;

    IF cfg.trigger_mode IN ('erster_kauf', 'nach_x_bestellungen')
       AND v_email IS NULL AND v_phone IS NULL THEN
      CONTINUE;
    END IF;

    IF cfg.trigger_mode IN ('erster_kauf', 'nach_x_bestellungen') THEN
      SELECT count(*) INTO v_order_count
      FROM public.customer_orders o
      WHERE o.tenant_id = p_tenant_id
        AND o.status NOT IN ('storniert', 'cancelled')
        AND (
          (v_email IS NOT NULL AND lower(trim(o.kunde_email)) = v_email)
          OR (v_phone IS NOT NULL AND regexp_replace(coalesce(o.kunde_telefon, ''), '[^0-9+]', '', 'g') = v_phone)
        );
    ELSE
      v_order_count := 0;
    END IF;

    IF cfg.trigger_mode = 'erster_kauf' AND v_order_count <> 0 THEN
      CONTINUE;
    END IF;

    -- The RPC is called before the new order exists. Therefore +1 means
    -- "jede 3. Bestellung" is redeemed on order 3, 6, 9 ... (not 4, 7, 10).
    IF cfg.trigger_mode = 'nach_x_bestellungen' THEN
      IF coalesce(cfg.trigger_nach_bestellungen, 0) < 1
         OR (v_order_count + 1) % cfg.trigger_nach_bestellungen <> 0 THEN
        CONTINUE;
      END IF;

      SELECT count(*) INTO v_redemption_count
      FROM public.customer_free_product_redemptions r
      WHERE r.tenant_id = p_tenant_id
        AND (r.config_id = cfg.id OR (r.config_id IS NULL AND r.konfig_typ = cfg.konfig_typ))
        AND (
          (v_email IS NOT NULL AND lower(trim(r.kunde_email)) = v_email)
          OR (v_phone IS NOT NULL AND regexp_replace(coalesce(r.kunde_telefon, ''), '[^0-9+]', '', 'g') = v_phone)
        );
      IF v_redemption_count >= ((v_order_count + 1) / cfg.trigger_nach_bestellungen) THEN
        CONTINUE;
      END IF;
    END IF;

    IF cfg.trigger_mode = 'ab_betrag'
       AND cfg.trigger_ab_betrag IS NOT NULL
       AND coalesce(p_bestellwert, 0) < cfg.trigger_ab_betrag THEN
      CONTINUE;
    END IF;

    IF coalesce(cfg.cooldown_tage, 0) > 0 AND (v_email IS NOT NULL OR v_phone IS NOT NULL) THEN
      SELECT max(r.eingeloest_am) INTO v_last_redeem
      FROM public.customer_free_product_redemptions r
      WHERE r.tenant_id = p_tenant_id
        AND (r.config_id = cfg.id OR (r.config_id IS NULL AND r.konfig_typ = cfg.konfig_typ))
        AND (
          (v_email IS NOT NULL AND lower(trim(r.kunde_email)) = v_email)
          OR (v_phone IS NOT NULL AND regexp_replace(coalesce(r.kunde_telefon, ''), '[^0-9+]', '', 'g') = v_phone)
        )
        AND r.eingeloest_am > now() - make_interval(days => cfg.cooldown_tage);
      IF v_last_redeem IS NOT NULL THEN
        CONTINUE;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'eligible', true,
      'reason', null,
      'config_id', cfg.id,
      'eligible_item_ids', cfg.eligible_item_ids,
      'placement', cfg.placement::text,
      'trigger_mode', cfg.trigger_mode::text,
      'trigger_nach_sekunden', cfg.trigger_nach_sekunden,
      'trigger_nach_bestellungen', cfg.trigger_nach_bestellungen,
      'anzeige_titel', cfg.anzeige_titel,
      'anzeige_text', cfg.anzeige_text,
      'konfig_typ', cfg.konfig_typ
    );
  END LOOP;

  RETURN jsonb_build_object('eligible', false, 'reason', 'not_eligible');
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_free_product(
  p_tenant_id uuid,
  p_order_id uuid,
  p_menu_item_id uuid,
  p_kunde_email text DEFAULT NULL,
  p_kunde_telefon text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.free_product_configs%rowtype;
  candidate public.free_product_configs%rowtype;
  item_rec public.menu_items%rowtype;
  order_rec public.customer_orders%rowtype;
  v_email text;
  v_phone text;
  v_order_count integer;
  v_redemption_count integer;
  v_last_redeem timestamptz;
  v_eligible boolean := false;
BEGIN
  SELECT * INTO order_rec
  FROM public.customer_orders
  WHERE id = p_order_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;
  IF order_rec.status IN ('geliefert', 'abgeholt', 'storniert', 'abgeschlossen', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_closed');
  END IF;

  v_email := NULLIF(lower(trim(coalesce(order_rec.kunde_email, p_kunde_email))), '');
  v_phone := NULLIF(regexp_replace(coalesce(order_rec.kunde_telefon, p_kunde_telefon, ''), '[^0-9+]', '', 'g'), '');

  SELECT item.* INTO item_rec
  FROM public.menu_items item
  JOIN public.locations location ON location.id = item.location_id
  WHERE item.id = p_menu_item_id
    AND location.tenant_id = p_tenant_id
    AND item.verfuegbar;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'item_not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.customer_free_product_redemptions WHERE order_id = p_order_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed_for_order');
  END IF;

  FOR candidate IN
    SELECT c.*
    FROM public.free_product_configs c
    WHERE c.tenant_id = p_tenant_id
      AND c.aktiv
      AND p_menu_item_id = ANY(c.eligible_item_ids)
    ORDER BY
      CASE c.trigger_mode
        WHEN 'nach_x_bestellungen' THEN 0
        WHEN 'erster_kauf' THEN 1
        WHEN 'ab_betrag' THEN 2
        WHEN 'immer' THEN 3
        WHEN 'nach_sekunden' THEN 4
        ELSE 5
      END,
      CASE c.konfig_typ WHEN 'auswahl' THEN 0 WHEN 'treue' THEN 1 ELSE 2 END,
      c.created_at,
      c.id
    FOR UPDATE
  LOOP
    v_eligible := true;

    SELECT count(*) INTO v_redemption_count
    FROM public.customer_free_product_redemptions r
    WHERE r.tenant_id = p_tenant_id
      AND (r.config_id = candidate.id OR (r.config_id IS NULL AND r.konfig_typ = candidate.konfig_typ));
    IF candidate.max_nutzungen_gesamt IS NOT NULL
       AND v_redemption_count >= candidate.max_nutzungen_gesamt THEN
      v_eligible := false;
    END IF;

    IF v_eligible AND candidate.trigger_mode IN ('erster_kauf', 'nach_x_bestellungen')
       AND v_email IS NULL AND v_phone IS NULL THEN
      v_eligible := false;
    END IF;

    IF v_eligible AND candidate.trigger_mode IN ('erster_kauf', 'nach_x_bestellungen') THEN
      SELECT count(*) INTO v_order_count
      FROM public.customer_orders o
      WHERE o.tenant_id = p_tenant_id
        AND o.status NOT IN ('storniert', 'cancelled')
        AND (
          (v_email IS NOT NULL AND lower(trim(o.kunde_email)) = v_email)
          OR (v_phone IS NOT NULL AND regexp_replace(coalesce(o.kunde_telefon, ''), '[^0-9+]', '', 'g') = v_phone)
        );
    ELSE
      v_order_count := 0;
    END IF;

    IF v_eligible AND candidate.trigger_mode = 'erster_kauf' AND v_order_count <> 1 THEN
      v_eligible := false;
    END IF;

    IF v_eligible AND candidate.trigger_mode = 'nach_x_bestellungen' THEN
      IF coalesce(candidate.trigger_nach_bestellungen, 0) < 1
         OR v_order_count < 1
         OR v_order_count % candidate.trigger_nach_bestellungen <> 0 THEN
        v_eligible := false;
      ELSE
        SELECT count(*) INTO v_redemption_count
        FROM public.customer_free_product_redemptions r
        WHERE r.tenant_id = p_tenant_id
          AND (r.config_id = candidate.id OR (r.config_id IS NULL AND r.konfig_typ = candidate.konfig_typ))
          AND (
            (v_email IS NOT NULL AND lower(trim(r.kunde_email)) = v_email)
            OR (v_phone IS NOT NULL AND regexp_replace(coalesce(r.kunde_telefon, ''), '[^0-9+]', '', 'g') = v_phone)
          );
        IF v_redemption_count >= (v_order_count / candidate.trigger_nach_bestellungen) THEN
          v_eligible := false;
        END IF;
      END IF;
    END IF;

    IF v_eligible AND candidate.trigger_mode = 'ab_betrag'
       AND candidate.trigger_ab_betrag IS NOT NULL
       AND coalesce(order_rec.zwischensumme, 0) < candidate.trigger_ab_betrag THEN
      v_eligible := false;
    END IF;

    IF v_eligible AND coalesce(candidate.cooldown_tage, 0) > 0 AND (v_email IS NOT NULL OR v_phone IS NOT NULL) THEN
      SELECT max(r.eingeloest_am) INTO v_last_redeem
      FROM public.customer_free_product_redemptions r
      WHERE r.tenant_id = p_tenant_id
        AND (r.config_id = candidate.id OR (r.config_id IS NULL AND r.konfig_typ = candidate.konfig_typ))
        AND (
          (v_email IS NOT NULL AND lower(trim(r.kunde_email)) = v_email)
          OR (v_phone IS NOT NULL AND regexp_replace(coalesce(r.kunde_telefon, ''), '[^0-9+]', '', 'g') = v_phone)
        )
        AND r.eingeloest_am > now() - make_interval(days => candidate.cooldown_tage);
      IF v_last_redeem IS NOT NULL THEN
        v_eligible := false;
      END IF;
    END IF;

    IF v_eligible THEN
      cfg := candidate;
      EXIT;
    END IF;
  END LOOP;

  IF NOT v_eligible OR cfg.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'promotion_not_eligible');
  END IF;

  INSERT INTO public.customer_free_product_redemptions (
    tenant_id, config_id, order_id, menu_item_id, kunde_email, kunde_telefon,
    item_name, item_preis, konfig_typ
  ) VALUES (
    p_tenant_id, cfg.id, p_order_id, p_menu_item_id, v_email, v_phone,
    item_rec.name, item_rec.preis, cfg.konfig_typ
  );

  UPDATE public.customer_orders
  SET gratis_produkt_item_id = p_menu_item_id,
      gratis_produkt_name = item_rec.name,
      gratis_produkt_wert = item_rec.preis
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'ok', true,
    'config_id', cfg.id,
    'item_name', item_rec.name,
    'item_preis', item_rec.preis,
    'konfig_typ', cfg.konfig_typ
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_free_product_eligibility(uuid, numeric, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_free_product_eligibility(uuid, numeric, text, text)
  TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.redeem_free_product(uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_free_product(uuid, uuid, uuid, text, text)
  TO service_role;

COMMIT;
