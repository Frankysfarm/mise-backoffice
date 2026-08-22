BEGIN;

-- Repair the partially applied tour-modification migration.
ALTER TABLE public.tour_modifications
  ADD COLUMN IF NOT EXISTS location_id uuid;

-- 35 legacy batches referenced by the audit log have no location_id, but every
-- one has stops from exactly one order location. Repair that unambiguous drift.
WITH inferred AS (
  SELECT
    batch.id AS batch_id,
    MIN(orders.location_id::text)::uuid AS location_id
  FROM public.mise_delivery_batches batch
  JOIN public.mise_delivery_batch_stops stop ON stop.batch_id = batch.id
  JOIN public.customer_orders orders ON orders.id = stop.order_id
  WHERE batch.location_id IS NULL
    AND orders.location_id IS NOT NULL
  GROUP BY batch.id
  HAVING COUNT(DISTINCT orders.location_id) = 1
)
UPDATE public.mise_delivery_batches batch
SET location_id = inferred.location_id
FROM inferred
WHERE batch.id = inferred.batch_id;

UPDATE public.tour_modifications modification
SET location_id = batch.location_id
FROM public.mise_delivery_batches batch
WHERE modification.batch_id = batch.id
  AND modification.location_id IS NULL;

ALTER TABLE public.tour_modifications
  ALTER COLUMN location_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tour_modifications_location_id_fkey'
      AND conrelid = 'public.tour_modifications'::regclass
  ) THEN
    ALTER TABLE public.tour_modifications
      ADD CONSTRAINT tour_modifications_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_tour_modifications_batch
  ON public.tour_modifications(batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tour_modifications_location
  ON public.tour_modifications(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tour_modifications_order
  ON public.tour_modifications(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_batches_last_modified
  ON public.mise_delivery_batches(last_modified_at DESC)
  WHERE last_modified_at IS NOT NULL;

ALTER TABLE public.tour_modifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tour_mods_all ON public.tour_modifications;
DROP POLICY IF EXISTS service_role_all_tour_modifications ON public.tour_modifications;
DROP POLICY IF EXISTS authenticated_select_tour_modifications ON public.tour_modifications;

CREATE POLICY service_role_all_tour_modifications
  ON public.tour_modifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY authenticated_select_tour_modifications
  ON public.tour_modifications FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.location_id = tour_modifications.location_id)
  );

REVOKE ALL PRIVILEGES ON TABLE public.tour_modifications
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tour_modifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tour_modifications TO service_role;

CREATE OR REPLACE VIEW public.v_active_tours_open_stops
WITH (security_invoker = true) AS
SELECT
  b.id AS batch_id,
  b.location_id,
  b.driver_id,
  b.state,
  b.stop_count,
  b.total_eta_min,
  b.modification_count,
  b.last_modified_at,
  s.id AS stop_id,
  s.order_id,
  s.type AS stop_type,
  s.sequence,
  s.lat,
  s.lng,
  s.address,
  s.completed_at IS NULL AS is_open
FROM public.mise_delivery_batches b
JOIN public.mise_delivery_batch_stops s ON s.batch_id = b.id
WHERE b.state IN ('pending_acceptance', 'assigned', 'at_restaurant', 'on_route')
  AND s.completed_at IS NULL
ORDER BY b.id, s.sequence;

REVOKE ALL PRIVILEGES ON TABLE public.v_active_tours_open_stops
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_active_tours_open_stops TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.increment_batch_modification_count(p_batch_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.mise_delivery_batches
  SET modification_count = modification_count + 1,
      last_modified_at = now()
  WHERE id = p_batch_id;
$$;

REVOKE ALL ON FUNCTION public.increment_batch_modification_count(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_batch_modification_count(uuid) TO service_role;

-- Rule-based and legacy stamp loyalty configuration is public-read-only when
-- active. Redemption data contains customer PII and is never directly public.
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_program_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_program_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_stamp_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loyalty_programs_service_all ON public.loyalty_programs;
DROP POLICY IF EXISTS loyalty_programs_public_active ON public.loyalty_programs;
DROP POLICY IF EXISTS loyalty_programs_employee_select ON public.loyalty_programs;
CREATE POLICY loyalty_programs_service_all ON public.loyalty_programs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY loyalty_programs_public_active ON public.loyalty_programs
  FOR SELECT TO anon USING (
    is_active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );
CREATE POLICY loyalty_programs_employee_select ON public.loyalty_programs
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.tenant_id = loyalty_programs.tenant_id)
  );

DROP POLICY IF EXISTS loyalty_rules_service_all ON public.loyalty_program_rules;
DROP POLICY IF EXISTS loyalty_rules_public_active ON public.loyalty_program_rules;
DROP POLICY IF EXISTS loyalty_rules_employee_select ON public.loyalty_program_rules;
CREATE POLICY loyalty_rules_service_all ON public.loyalty_program_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY loyalty_rules_public_active ON public.loyalty_program_rules
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.loyalty_programs p
      WHERE p.id = loyalty_program_rules.program_id
        AND p.is_active
        AND (p.starts_at IS NULL OR p.starts_at <= now())
        AND (p.ends_at IS NULL OR p.ends_at > now()))
  );
CREATE POLICY loyalty_rules_employee_select ON public.loyalty_program_rules
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.loyalty_programs p
      JOIN public.employees e ON e.tenant_id = p.tenant_id
      WHERE p.id = loyalty_program_rules.program_id AND e.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS loyalty_items_service_all ON public.loyalty_program_items;
DROP POLICY IF EXISTS loyalty_items_public_active ON public.loyalty_program_items;
DROP POLICY IF EXISTS loyalty_items_employee_select ON public.loyalty_program_items;
CREATE POLICY loyalty_items_service_all ON public.loyalty_program_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY loyalty_items_public_active ON public.loyalty_program_items
  FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM public.loyalty_program_rules r
      JOIN public.loyalty_programs p ON p.id = r.program_id
      WHERE r.id = loyalty_program_items.rule_id
        AND p.is_active
        AND (p.starts_at IS NULL OR p.starts_at <= now())
        AND (p.ends_at IS NULL OR p.ends_at > now()))
  );
CREATE POLICY loyalty_items_employee_select ON public.loyalty_program_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.loyalty_program_rules r
      JOIN public.loyalty_programs p ON p.id = r.program_id
      JOIN public.employees e ON e.tenant_id = p.tenant_id
      WHERE r.id = loyalty_program_items.rule_id AND e.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS loyalty_redemptions_service_all ON public.loyalty_redemptions;
DROP POLICY IF EXISTS loyalty_redemptions_employee_select ON public.loyalty_redemptions;
CREATE POLICY loyalty_redemptions_service_all ON public.loyalty_redemptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY loyalty_redemptions_employee_select ON public.loyalty_redemptions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.loyalty_programs p
      JOIN public.employees e ON e.tenant_id = p.tenant_id
      WHERE p.id = loyalty_redemptions.program_id AND e.auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS loyalty_stamp_service_all ON public.loyalty_stamp_programs;
DROP POLICY IF EXISTS loyalty_stamp_public_active ON public.loyalty_stamp_programs;
DROP POLICY IF EXISTS loyalty_stamp_employee_select ON public.loyalty_stamp_programs;
CREATE POLICY loyalty_stamp_service_all ON public.loyalty_stamp_programs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY loyalty_stamp_public_active ON public.loyalty_stamp_programs
  FOR SELECT TO anon USING (active);
CREATE POLICY loyalty_stamp_employee_select ON public.loyalty_stamp_programs
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.tenant_id = loyalty_stamp_programs.tenant_id)
  );

REVOKE ALL PRIVILEGES ON TABLE
  public.loyalty_programs,
  public.loyalty_program_rules,
  public.loyalty_program_items,
  public.loyalty_redemptions,
  public.loyalty_stamp_programs
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
  public.loyalty_programs,
  public.loyalty_program_rules,
  public.loyalty_program_items,
  public.loyalty_stamp_programs
  TO anon, authenticated;
GRANT SELECT ON TABLE public.loyalty_redemptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.loyalty_programs,
  public.loyalty_program_rules,
  public.loyalty_program_items,
  public.loyalty_redemptions,
  public.loyalty_stamp_programs
  TO service_role;

-- Free-product configuration remains public-read-only when active. All PII
-- writes go through the hardened capability RPC below.
ALTER TABLE public.free_product_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_free_product_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fp_config_public_read ON public.free_product_configs;
DROP POLICY IF EXISTS fp_config_tenant_write ON public.free_product_configs;
DROP POLICY IF EXISTS fp_config_service_all ON public.free_product_configs;
DROP POLICY IF EXISTS fp_config_public_active ON public.free_product_configs;
DROP POLICY IF EXISTS fp_config_employee_select ON public.free_product_configs;
CREATE POLICY fp_config_service_all ON public.free_product_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY fp_config_public_active ON public.free_product_configs
  FOR SELECT TO anon USING (aktiv);
CREATE POLICY fp_config_employee_select ON public.free_product_configs
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.tenant_id = free_product_configs.tenant_id)
  );

DROP POLICY IF EXISTS fp_redemptions_public_insert ON public.customer_free_product_redemptions;
DROP POLICY IF EXISTS fp_redemptions_tenant_read ON public.customer_free_product_redemptions;
DROP POLICY IF EXISTS fp_redemptions_service_all ON public.customer_free_product_redemptions;
DROP POLICY IF EXISTS fp_redemptions_employee_select ON public.customer_free_product_redemptions;
CREATE POLICY fp_redemptions_service_all ON public.customer_free_product_redemptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY fp_redemptions_employee_select ON public.customer_free_product_redemptions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid()
        AND e.tenant_id = customer_free_product_redemptions.tenant_id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_fp_redeem_order_once
  ON public.customer_free_product_redemptions(order_id) WHERE order_id IS NOT NULL;

REVOKE ALL PRIVILEGES ON TABLE
  public.free_product_configs,
  public.customer_free_product_redemptions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.free_product_configs TO anon, authenticated;
GRANT SELECT ON TABLE public.customer_free_product_redemptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.free_product_configs,
  public.customer_free_product_redemptions
  TO service_role;

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
  item_rec public.menu_items%rowtype;
  order_rec public.customer_orders%rowtype;
  last_redeem timestamptz;
BEGIN
  SELECT * INTO cfg
  FROM public.free_product_configs
  WHERE tenant_id = p_tenant_id AND aktiv
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'feature_inactive');
  END IF;

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

  IF NOT (p_menu_item_id = ANY(cfg.eligible_item_ids)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'item_not_eligible');
  END IF;

  SELECT item.* INTO item_rec
  FROM public.menu_items item
  JOIN public.locations location ON location.id = item.location_id
  WHERE item.id = p_menu_item_id
    AND location.tenant_id = p_tenant_id
    AND item.verfuegbar;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'item_not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.customer_free_product_redemptions
    WHERE order_id = p_order_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed_for_order');
  END IF;

  SELECT MAX(redemption.eingeloest_am) INTO last_redeem
  FROM public.customer_free_product_redemptions redemption
  WHERE redemption.tenant_id = p_tenant_id
    AND (
      (order_rec.kunde_email IS NOT NULL AND redemption.kunde_email = order_rec.kunde_email)
      OR (order_rec.kunde_telefon IS NOT NULL AND redemption.kunde_telefon = order_rec.kunde_telefon)
    )
    AND redemption.eingeloest_am > now() - (cfg.cooldown_tage || ' days')::interval;
  IF last_redeem IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cooldown_active');
  END IF;

  INSERT INTO public.customer_free_product_redemptions (
    tenant_id, order_id, menu_item_id, kunde_email, kunde_telefon, item_name, item_preis
  ) VALUES (
    p_tenant_id, p_order_id, p_menu_item_id,
    order_rec.kunde_email, order_rec.kunde_telefon, item_rec.name, item_rec.preis
  );

  UPDATE public.customer_orders
  SET gratis_produkt_item_id = p_menu_item_id,
      gratis_produkt_name = item_rec.name,
      gratis_produkt_wert = item_rec.preis
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true, 'item_name', item_rec.name, 'item_preis', item_rec.preis);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_free_product(uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_free_product(uuid, uuid, uuid, text, text)
  TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.check_free_product_eligibility(uuid, numeric, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_free_product_eligibility(uuid, numeric, text, text)
  TO anon, authenticated, service_role;

COMMIT;
