\set ON_ERROR_STOP on

-- Deterministischer Metadaten-/Vertragstest. Erwartet Migration 274.
-- Verändert keine Geschäftsdaten.
BEGIN;

DO $test$
DECLARE
  v_definition text;
  v_legacy_trigger_definition text;
  v_frank_trigger_definition text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_orders'
      AND column_name = 'dispatch_version' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'dispatch_version missing or nullable';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_dispatch_offer_active_order'
      AND indexdef LIKE '%UNIQUE INDEX%'
      AND indexdef LIKE '%WHERE%'
  ) THEN
    RAISE EXCEPTION 'active-order unique index missing';
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_dispatch_create_offer_v1';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'fn_dispatch_create_offer_v1 missing';
  END IF;
  IF v_definition NOT LIKE '%FOR UPDATE%'
     OR v_definition NOT LIKE '%dispatch_version = p_expected_order_version%'
     OR v_definition NOT LIKE '%INSERT INTO public.mise_push_outbox%'
     OR v_definition NOT LIKE '%INSERT INTO public.dispatch_offer_audit%' THEN
    RAISE EXCEPTION 'atomic offer function is missing a required guard/write';
  END IF;

  IF has_function_privilege('anon',
      'public.fn_dispatch_create_offer_v1(uuid,uuid,uuid,bigint,uuid,uuid,text,integer,numeric,numeric,text,numeric,numeric,text,text,text)',
      'EXECUTE')
     OR has_function_privilege('authenticated',
      'public.fn_dispatch_create_offer_v1(uuid,uuid,uuid,bigint,uuid,uuid,text,integer,numeric,numeric,text,numeric,numeric,text,text,text)',
      'EXECUTE') THEN
    RAISE EXCEPTION 'untrusted role can execute atomic offer RPC';
  END IF;

  IF NOT has_function_privilege('service_role',
      'public.fn_dispatch_create_offer_v1(uuid,uuid,uuid,bigint,uuid,uuid,text,integer,numeric,numeric,text,numeric,numeric,text,text,text)',
      'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute atomic offer RPC';
  END IF;

  IF has_function_privilege('authenticated',
      'public.fn_dispatch_transition_offer_v1(uuid,uuid,bigint,text,uuid,uuid)',
      'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute lifecycle RPC';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.dispatch_writer_gates'::regclass
      AND pg_get_constraintdef(c.oid) LIKE '%legacy_db%'
      AND pg_get_constraintdef(c.oid) LIKE '%frank_db%'
      AND pg_get_constraintdef(c.oid) LIKE '%frank_js%'
      AND pg_get_constraintdef(c.oid) LIKE '%atomic_v1%'
  ) THEN
    RAISE EXCEPTION 'writer gate does not enumerate every inventoried writer';
  END IF;

  SELECT pg_get_functiondef(to_regprocedure('public.create_dispatch_batch()'))
    INTO v_legacy_trigger_definition;
  SELECT pg_get_functiondef(to_regprocedure('public.fn_trigger_frank_on_ready()'))
    INTO v_frank_trigger_definition;
  IF v_legacy_trigger_definition IS NOT NULL
     AND v_legacy_trigger_definition NOT LIKE
       '%fn_dispatch_writer_allows_location_v1%legacy_db%' THEN
    RAISE EXCEPTION 'legacy DB trigger wrapper is not tenant gated';
  END IF;
  IF v_legacy_trigger_definition IS NOT NULL
     AND (v_legacy_trigger_definition NOT LIKE '%pg_advisory_xact_lock%'
          OR v_legacy_trigger_definition NOT LIKE '%27401%') THEN
    RAISE EXCEPTION 'legacy DB trigger wrapper does not lock the tenant switch boundary';
  END IF;
  IF v_frank_trigger_definition IS NOT NULL
     AND v_frank_trigger_definition NOT LIKE
       '%fn_dispatch_writer_allows_location_v1%frank_db%' THEN
    RAISE EXCEPTION 'Frank DB trigger wrapper is not tenant gated';
  END IF;
  IF v_frank_trigger_definition IS NOT NULL
     AND (v_frank_trigger_definition NOT LIKE '%pg_advisory_xact_lock%'
          OR v_frank_trigger_definition NOT LIKE '%27401%') THEN
    RAISE EXCEPTION 'Frank DB trigger wrapper does not lock the tenant switch boundary';
  END IF;

  SELECT pg_get_functiondef(
    'public.fn_dispatch_transition_offer_v1(uuid,uuid,bigint,text,uuid,uuid)'::regprocedure
  ) INTO v_definition;
  IF v_definition NOT LIKE '%SINGLE_WRITER_GATE_CLOSED%'
     OR v_definition NOT LIKE '%27401%' THEN
    RAISE EXCEPTION 'lifecycle transition is not serialized with writer switch';
  END IF;

  SELECT pg_get_functiondef(
    'public.fn_dispatch_expire_offers_v1(integer)'::regprocedure
  ) INTO v_definition;
  IF v_definition NOT LIKE '%dispatch_writer_gates%'
     OR v_definition NOT LIKE '%atomic_v1%' THEN
    RAISE EXCEPTION 'expiry worker is not constrained to atomic tenants';
  END IF;
END
$test$;

ROLLBACK;
