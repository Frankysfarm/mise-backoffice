-- Run after migration 070. All writes are rolled back.
BEGIN;

DO $$
DECLARE
  v_tenant_id uuid;
  v_revision integer;
  v_result jsonb;
  v_builder jsonb;
BEGIN
  SELECT tenant.id,
         CASE
           WHEN coalesce(tenant.storefront_settings #>> '{storefront_builder,draft,revision}', '') ~ '^[0-9]+$'
             THEN (tenant.storefront_settings #>> '{storefront_builder,draft,revision}')::integer
           ELSE 0
         END
  INTO v_tenant_id, v_revision
  FROM public.tenants tenant
  ORDER BY tenant.id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION '070 test requires at least one tenant';
  END IF;

  v_builder := jsonb_build_object(
    'draft', jsonb_build_object('revision', v_revision + 1),
    'published', NULL,
    'publishedAt', NULL,
    'history', '[]'::jsonb
  );

  v_result := public.apply_storefront_builder(v_tenant_id, v_revision, v_builder, NULL, NULL);
  IF coalesce((v_result ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'first atomic update failed: %', v_result;
  END IF;

  v_result := public.apply_storefront_builder(v_tenant_id, v_revision, v_builder, NULL, NULL);
  IF coalesce((v_result ->> 'conflict')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'stale update was not rejected: %', v_result;
  END IF;

  IF has_function_privilege('anon', 'public.apply_storefront_builder(uuid,integer,jsonb,jsonb,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.apply_storefront_builder(uuid,integer,jsonb,jsonb,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'builder RPC is executable outside service_role';
  END IF;
END;
$$;

ROLLBACK;
