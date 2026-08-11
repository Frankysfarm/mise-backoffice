BEGIN;

-- Security-definer predicates avoid recursive RLS joins while exposing no data.
CREATE OR REPLACE FUNCTION public.delivery_current_driver_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.mise_drivers
  WHERE auth_user_id = auth.uid()
  ORDER BY id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.delivery_can_access_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.auth_user_id = auth.uid() AND e.tenant_id = p_tenant_id
  );
$$;

CREATE OR REPLACE FUNCTION public.delivery_can_access_location(p_location_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.locations l
    JOIN public.employees e ON e.tenant_id = l.tenant_id
    WHERE l.id = p_location_id AND e.auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.delivery_can_access_location_text(p_location_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.locations l
    JOIN public.employees e ON e.tenant_id = l.tenant_id
    WHERE l.id::text = p_location_id AND e.auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.delivery_can_access_driver(p_driver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_driver_id = public.delivery_current_driver_id()
    OR EXISTS (
      SELECT 1
      FROM public.mise_driver_tenants membership
      JOIN public.employees e ON e.tenant_id = membership.tenant_id
      WHERE membership.driver_id = p_driver_id
        AND e.auth_user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.delivery_driver_owns_batch(p_batch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mise_delivery_batches b
    WHERE b.id = p_batch_id
      AND b.driver_id = public.delivery_current_driver_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.delivery_can_access_batch(p_batch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mise_delivery_batches b
    WHERE b.id = p_batch_id
      AND (
        b.driver_id = public.delivery_current_driver_id()
        OR public.delivery_can_access_location(b.location_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION
  public.delivery_current_driver_id(),
  public.delivery_can_access_tenant(uuid),
  public.delivery_can_access_location(uuid),
  public.delivery_can_access_location_text(text),
  public.delivery_can_access_driver(uuid),
  public.delivery_driver_owns_batch(uuid),
  public.delivery_can_access_batch(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.delivery_current_driver_id(),
  public.delivery_can_access_tenant(uuid),
  public.delivery_can_access_location(uuid),
  public.delivery_can_access_location_text(text),
  public.delivery_can_access_driver(uuid),
  public.delivery_driver_owns_batch(uuid),
  public.delivery_can_access_batch(uuid)
  TO authenticated, service_role;

-- Tables that are exclusively reached through authenticated server endpoints.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'customer_coupons',
    'customer_notification_queue',
    'customer_push_outbox',
    'customer_sessions',
    'delivery_station_kds_filters',
    'delivery_station_locations',
    'delivery_stations',
    'driver_otp_codes',
    'driver_push_outbox',
    'driver_sessions',
    'drivers',
    'mise_batch_offers',
    'mise_driver_invitations',
    'mise_driver_locations',
    'mise_driver_otp_codes',
    'mise_driver_sessions'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS service_role_all ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY service_role_all ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      table_name
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      table_name
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role',
      table_name
    );
  END LOOP;
END;
$$;

-- Immutable order audit: tenant readers, inserts for legitimate status triggers,
-- and no browser-side update/delete capability.
ALTER TABLE public.customer_orders_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_no_modify ON public.customer_orders_audit;
DROP POLICY IF EXISTS audit_service_all ON public.customer_orders_audit;
DROP POLICY IF EXISTS audit_tenant_select ON public.customer_orders_audit;
DROP POLICY IF EXISTS audit_tenant_insert ON public.customer_orders_audit;
CREATE POLICY audit_service_all ON public.customer_orders_audit
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY audit_tenant_select ON public.customer_orders_audit
  FOR SELECT TO authenticated
  USING (public.delivery_can_access_tenant(tenant_id));
CREATE POLICY audit_tenant_insert ON public.customer_orders_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.delivery_can_access_tenant(tenant_id));
REVOKE ALL PRIVILEGES ON TABLE public.customer_orders_audit
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.customer_orders_audit TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_orders_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.customer_orders_audit_id_seq TO authenticated, service_role;

-- Location-scoped operational tables with text location identifiers.
ALTER TABLE public.customer_notification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_recovery_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cnc_service_all ON public.customer_notification_config;
DROP POLICY IF EXISTS cnc_location_select ON public.customer_notification_config;
CREATE POLICY cnc_service_all ON public.customer_notification_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY cnc_location_select ON public.customer_notification_config
  FOR SELECT TO authenticated
  USING (public.delivery_can_access_location_text(location_id));

DROP POLICY IF EXISTS alert_rules_service_all ON public.delivery_alert_rules;
DROP POLICY IF EXISTS alert_rules_location_select ON public.delivery_alert_rules;
CREATE POLICY alert_rules_service_all ON public.delivery_alert_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY alert_rules_location_select ON public.delivery_alert_rules
  FOR SELECT TO authenticated
  USING (public.delivery_can_access_location_text(location_id));

DROP POLICY IF EXISTS alerts_service_all ON public.delivery_alerts;
DROP POLICY IF EXISTS alerts_location_select ON public.delivery_alerts;
CREATE POLICY alerts_service_all ON public.delivery_alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY alerts_location_select ON public.delivery_alerts
  FOR SELECT TO authenticated
  USING (public.delivery_can_access_location_text(location_id));

DROP POLICY IF EXISTS recovery_events_service_all ON public.delivery_recovery_events;
DROP POLICY IF EXISTS recovery_events_location_select ON public.delivery_recovery_events;
CREATE POLICY recovery_events_service_all ON public.delivery_recovery_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY recovery_events_location_select ON public.delivery_recovery_events
  FOR SELECT TO authenticated
  USING (public.delivery_can_access_location_text(location_id));

REVOKE ALL PRIVILEGES ON TABLE
  public.customer_notification_config,
  public.delivery_alert_rules,
  public.delivery_alerts,
  public.delivery_recovery_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
  public.customer_notification_config,
  public.delivery_alert_rules,
  public.delivery_alerts,
  public.delivery_recovery_events
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.customer_notification_config,
  public.delivery_alert_rules,
  public.delivery_alerts,
  public.delivery_recovery_events
  TO service_role;

ALTER TABLE public.delivery_setting_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS setting_defaults_service_all ON public.delivery_setting_defaults;
DROP POLICY IF EXISTS setting_defaults_auth_select ON public.delivery_setting_defaults;
CREATE POLICY setting_defaults_service_all ON public.delivery_setting_defaults
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY setting_defaults_auth_select ON public.delivery_setting_defaults
  FOR SELECT TO authenticated USING (true);
REVOKE ALL PRIVILEGES ON TABLE public.delivery_setting_defaults
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.delivery_setting_defaults TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_setting_defaults TO service_role;

-- Delivery zones: public storefront reads active rows; tenant employees manage
-- only zones belonging to their tenant.
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS zones_service_all ON public.delivery_zones;
DROP POLICY IF EXISTS zones_public_active ON public.delivery_zones;
DROP POLICY IF EXISTS zones_tenant_all ON public.delivery_zones;
CREATE POLICY zones_service_all ON public.delivery_zones
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY zones_public_active ON public.delivery_zones
  FOR SELECT TO anon USING (aktiv);
CREATE POLICY zones_tenant_all ON public.delivery_zones
  FOR ALL TO authenticated
  USING (
    public.delivery_can_access_tenant(tenant_id)
    AND public.delivery_can_access_location(location_id)
  )
  WITH CHECK (
    public.delivery_can_access_tenant(tenant_id)
    AND public.delivery_can_access_location(location_id)
  );
REVOKE ALL PRIVILEGES ON TABLE public.delivery_zones
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.delivery_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_zones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_zones TO service_role;

-- Kitchen timing and driver shifts are visible within a tenant/location.
ALTER TABLE public.kitchen_timings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kitchen_timings_service_all ON public.kitchen_timings;
DROP POLICY IF EXISTS kitchen_timings_location_all ON public.kitchen_timings;
CREATE POLICY kitchen_timings_service_all ON public.kitchen_timings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY kitchen_timings_location_all ON public.kitchen_timings
  FOR ALL TO authenticated
  USING (public.delivery_can_access_location(location_id))
  WITH CHECK (public.delivery_can_access_location(location_id));
REVOKE ALL PRIVILEGES ON TABLE public.kitchen_timings
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kitchen_timings TO authenticated, service_role;

ALTER TABLE public.driver_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS driver_shifts_service_all ON public.driver_shifts;
DROP POLICY IF EXISTS driver_shifts_auth_select ON public.driver_shifts;
CREATE POLICY driver_shifts_service_all ON public.driver_shifts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY driver_shifts_auth_select ON public.driver_shifts
  FOR SELECT TO authenticated
  USING (
    driver_id = public.delivery_current_driver_id()
    OR public.delivery_can_access_location(location_id)
  );
REVOKE ALL PRIVILEGES ON TABLE public.driver_shifts
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.driver_shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.driver_shifts TO service_role;

-- Core driver identity and tenant membership.
ALTER TABLE public.mise_driver_tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS driver_tenants_service_all ON public.mise_driver_tenants;
DROP POLICY IF EXISTS driver_tenants_auth_select ON public.mise_driver_tenants;
CREATE POLICY driver_tenants_service_all ON public.mise_driver_tenants
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY driver_tenants_auth_select ON public.mise_driver_tenants
  FOR SELECT TO authenticated
  USING (
    driver_id = public.delivery_current_driver_id()
    OR public.delivery_can_access_tenant(tenant_id)
  );
REVOKE ALL PRIVILEGES ON TABLE public.mise_driver_tenants
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.mise_driver_tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mise_driver_tenants TO service_role;

ALTER TABLE public.mise_drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mise_drivers_service_all ON public.mise_drivers;
DROP POLICY IF EXISTS mise_drivers_auth_select ON public.mise_drivers;
DROP POLICY IF EXISTS mise_drivers_self_update ON public.mise_drivers;
CREATE POLICY mise_drivers_service_all ON public.mise_drivers
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY mise_drivers_auth_select ON public.mise_drivers
  FOR SELECT TO authenticated USING (public.delivery_can_access_driver(id));
CREATE POLICY mise_drivers_self_update ON public.mise_drivers
  FOR UPDATE TO authenticated
  USING (id = public.delivery_current_driver_id())
  WITH CHECK (id = public.delivery_current_driver_id());
REVOKE ALL PRIVILEGES ON TABLE public.mise_drivers
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.mise_drivers TO authenticated;
GRANT UPDATE (state, last_active_at) ON TABLE public.mise_drivers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mise_drivers TO service_role;

-- Active batches and stops: tenant staff can read; the authenticated assigned
-- driver can update only lifecycle timestamps/state columns used by the UI.
ALTER TABLE public.mise_delivery_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS batches_service_all ON public.mise_delivery_batches;
DROP POLICY IF EXISTS batches_auth_select ON public.mise_delivery_batches;
DROP POLICY IF EXISTS batches_driver_update ON public.mise_delivery_batches;
CREATE POLICY batches_service_all ON public.mise_delivery_batches
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY batches_auth_select ON public.mise_delivery_batches
  FOR SELECT TO authenticated USING (public.delivery_can_access_batch(id));
CREATE POLICY batches_driver_update ON public.mise_delivery_batches
  FOR UPDATE TO authenticated
  USING (public.delivery_driver_owns_batch(id))
  WITH CHECK (public.delivery_driver_owns_batch(id));
REVOKE ALL PRIVILEGES ON TABLE public.mise_delivery_batches
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.mise_delivery_batches TO authenticated;
GRANT UPDATE (state, accepted_at, picked_up_at, completed_at, updated_at)
  ON TABLE public.mise_delivery_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mise_delivery_batches TO service_role;

ALTER TABLE public.mise_delivery_batch_stops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS batch_stops_service_all ON public.mise_delivery_batch_stops;
DROP POLICY IF EXISTS batch_stops_auth_select ON public.mise_delivery_batch_stops;
DROP POLICY IF EXISTS batch_stops_driver_update ON public.mise_delivery_batch_stops;
CREATE POLICY batch_stops_service_all ON public.mise_delivery_batch_stops
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY batch_stops_auth_select ON public.mise_delivery_batch_stops
  FOR SELECT TO authenticated USING (public.delivery_can_access_batch(batch_id));
CREATE POLICY batch_stops_driver_update ON public.mise_delivery_batch_stops
  FOR UPDATE TO authenticated
  USING (public.delivery_driver_owns_batch(batch_id))
  WITH CHECK (public.delivery_driver_owns_batch(batch_id));
REVOKE ALL PRIVILEGES ON TABLE public.mise_delivery_batch_stops
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.mise_delivery_batch_stops TO authenticated;
GRANT UPDATE (arrived_at, completed_at)
  ON TABLE public.mise_delivery_batch_stops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mise_delivery_batch_stops TO service_role;

COMMIT;
