BEGIN;

-- Keep newly created tables private unless a migration opts them into browser
-- access. Historical Supabase defaults granted every table to anon.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon;

-- The tracking page now reads this view server-side. Anonymous SELECT on the
-- whole view allowed bulk enumeration of order IDs and customer delivery data.
REVOKE ALL PRIVILEGES ON TABLE public.v_order_tracking FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.v_order_tracking TO authenticated, service_role;
ALTER VIEW public.v_order_tracking SET (security_invoker = true);

-- Customer chat: anonymous customers use the UUID-capability API. Staff and
-- assigned drivers retain direct realtime/database access to their own orders.
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
DO $drop$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_messages'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.order_messages', p.policyname);
  END LOOP;
END
$drop$;
CREATE POLICY order_messages_service_all ON public.order_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY order_messages_auth_select ON public.order_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customer_orders o
    WHERE o.id = order_messages.order_id
      AND (
        public.delivery_can_access_location(o.location_id)
        OR public.delivery_can_access_driver(o.mise_driver_id)
        OR public.delivery_can_access_batch(o.mise_batch_id)
      )
  ));
CREATE POLICY order_messages_auth_insert ON public.order_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.customer_orders o
    WHERE o.id = order_messages.order_id
      AND (
        public.delivery_can_access_location(o.location_id)
        OR public.delivery_can_access_driver(o.mise_driver_id)
        OR public.delivery_can_access_batch(o.mise_batch_id)
      )
  ));
CREATE POLICY order_messages_auth_update ON public.order_messages
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customer_orders o
    WHERE o.id = order_messages.order_id
      AND (
        public.delivery_can_access_location(o.location_id)
        OR public.delivery_can_access_driver(o.mise_driver_id)
        OR public.delivery_can_access_batch(o.mise_batch_id)
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.customer_orders o
    WHERE o.id = order_messages.order_id
      AND (
        public.delivery_can_access_location(o.location_id)
        OR public.delivery_can_access_driver(o.mise_driver_id)
        OR public.delivery_can_access_batch(o.mise_batch_id)
      )
  ));
REVOKE ALL PRIVILEGES ON TABLE public.order_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.order_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_messages TO service_role;

-- Invitation rows contain email addresses and bearer tokens. There is no
-- anonymous direct-table call site; invitation processing runs server-side.
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;
DO $drop$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant_invitations'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.tenant_invitations', p.policyname);
  END LOOP;
END
$drop$;
CREATE POLICY tenant_invitations_service_all ON public.tenant_invitations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY tenant_invitations_manager_all ON public.tenant_invitations
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.is_manager_plus())
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.is_manager_plus());
REVOKE ALL PRIVILEGES ON TABLE public.tenant_invitations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_invitations TO authenticated, service_role;

-- Push endpoints and encryption keys are written through /api/push/subscribe.
ALTER TABLE public.customer_push_subscriptions ENABLE ROW LEVEL SECURITY;
DO $drop$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customer_push_subscriptions'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.customer_push_subscriptions', p.policyname);
  END LOOP;
END
$drop$;
CREATE POLICY customer_push_subscriptions_service_all ON public.customer_push_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY customer_push_subscriptions_tenant_select ON public.customer_push_subscriptions
  FOR SELECT TO authenticated
  USING (public.delivery_can_access_tenant(tenant_id));
REVOKE ALL PRIVILEGES ON TABLE public.customer_push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.customer_push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_push_subscriptions TO service_role;

-- Voucher validation/redemption already runs through server APIs. Direct
-- anonymous reads exposed all codes and direct redemption inserts were forgeable.
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
DO $drop$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vouchers'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.vouchers', p.policyname);
  END LOOP;
END
$drop$;
CREATE POLICY vouchers_service_all ON public.vouchers
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY vouchers_tenant_select ON public.vouchers
  FOR SELECT TO authenticated
  USING (public.delivery_can_access_tenant(tenant_id));
CREATE POLICY vouchers_manager_write ON public.vouchers
  FOR ALL TO authenticated
  USING (public.delivery_can_access_tenant(tenant_id) AND public.is_manager_plus())
  WITH CHECK (public.delivery_can_access_tenant(tenant_id) AND public.is_manager_plus());
REVOKE ALL PRIVILEGES ON TABLE public.vouchers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vouchers TO authenticated, service_role;

ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;
DO $drop$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'voucher_redemptions'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.voucher_redemptions', p.policyname);
  END LOOP;
END
$drop$;
CREATE POLICY voucher_redemptions_service_all ON public.voucher_redemptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY voucher_redemptions_tenant_select ON public.voucher_redemptions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vouchers v
    WHERE v.id = voucher_redemptions.voucher_id
      AND public.delivery_can_access_tenant(v.tenant_id)
  ));
REVOKE ALL PRIVILEGES ON TABLE public.voucher_redemptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.voucher_redemptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.voucher_redemptions TO service_role;

COMMIT;
