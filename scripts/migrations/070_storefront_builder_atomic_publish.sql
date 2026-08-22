-- Atomic, conflict-safe persistence for the storefront page builder.
-- Only the service role may call this function; authorization and tenant
-- membership are checked by the server action before the RPC is invoked.

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_storefront_builder(
  p_tenant_id uuid,
  p_expected_revision integer,
  p_builder jsonb,
  p_theme jsonb DEFAULT NULL,
  p_theme_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_revision integer;
  v_updated_id uuid;
BEGIN
  IF p_expected_revision < 0
     OR jsonb_typeof(p_builder) <> 'object'
     OR jsonb_typeof(p_builder -> 'draft') <> 'object'
     OR coalesce(p_builder #>> '{draft,revision}', '') !~ '^[0-9]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_builder_payload');
  END IF;

  v_next_revision := (p_builder #>> '{draft,revision}')::integer;
  IF v_next_revision <> p_expected_revision + 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_next_revision');
  END IF;

  UPDATE public.tenants tenant
  SET storefront_settings = CASE
        WHEN p_theme IS NULL THEN
          jsonb_set(coalesce(tenant.storefront_settings, '{}'::jsonb), '{storefront_builder}', p_builder, true)
        ELSE
          jsonb_set(
            jsonb_set(coalesce(tenant.storefront_settings, '{}'::jsonb), '{storefront_builder}', p_builder, true),
            '{theme}',
            p_theme,
            true
          )
      END,
      storefront_theme_id = coalesce(p_theme_id, tenant.storefront_theme_id)
  WHERE tenant.id = p_tenant_id
    AND CASE
      WHEN coalesce(tenant.storefront_settings #>> '{storefront_builder,draft,revision}', '') ~ '^[0-9]+$'
        THEN (tenant.storefront_settings #>> '{storefront_builder,draft,revision}')::integer
      ELSE 0
    END = p_expected_revision
  RETURNING tenant.id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'conflict', true, 'error', 'revision_conflict');
  END IF;

  RETURN jsonb_build_object('ok', true, 'revision', v_next_revision);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_storefront_builder(uuid, integer, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_storefront_builder(uuid, integer, jsonb, jsonb, text) TO service_role;

COMMIT;
