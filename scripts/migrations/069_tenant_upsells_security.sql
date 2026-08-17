-- tenant_upsells used to be writable by anon with RLS disabled. Lock writes to
-- manager-plus employees while retaining public read access to active offers.

BEGIN;

ALTER TABLE public.tenant_upsells ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_upsells_service_all ON public.tenant_upsells;
DROP POLICY IF EXISTS tenant_upsells_public_active ON public.tenant_upsells;
DROP POLICY IF EXISTS tenant_upsells_employee_select ON public.tenant_upsells;
DROP POLICY IF EXISTS tenant_upsells_manager_write ON public.tenant_upsells;

CREATE POLICY tenant_upsells_service_all ON public.tenant_upsells
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY tenant_upsells_public_active ON public.tenant_upsells
  FOR SELECT TO anon
  USING (aktiv = true);

CREATE POLICY tenant_upsells_employee_select ON public.tenant_upsells
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees employee
      WHERE employee.auth_user_id = auth.uid()
        AND employee.tenant_id = tenant_upsells.tenant_id
    )
  );

CREATE POLICY tenant_upsells_manager_write ON public.tenant_upsells
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees employee
      WHERE employee.auth_user_id = auth.uid()
        AND employee.tenant_id = tenant_upsells.tenant_id
        AND employee.rolle IN ('manager', 'backoffice', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees employee
      WHERE employee.auth_user_id = auth.uid()
        AND employee.tenant_id = tenant_upsells.tenant_id
        AND employee.rolle IN ('manager', 'backoffice', 'admin')
    )
  );

REVOKE ALL ON TABLE public.tenant_upsells FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tenant_upsells TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_upsells TO authenticated;
GRANT ALL ON TABLE public.tenant_upsells TO service_role;

COMMIT;
