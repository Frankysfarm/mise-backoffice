\set ON_ERROR_STOP on

BEGIN;

DO $test$
DECLARE
  v_definition text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uq_dispatch_offer_active_order'
      AND indexdef LIKE '%assigned%' AND indexdef LIKE '%picked_up%'
      AND indexdef LIKE '%in_progress%'
  ) THEN
    RAISE EXCEPTION 'canonical active-order constraint missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uq_dispatch_offer_active_driver'
  ) THEN
    RAISE EXCEPTION 'single-order driver reservation still blocks multi-order trips';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dispatch_writer_gates'
      AND column_name = 'active_writer_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dispatch_writer_gates'
      AND column_name = 'writer_epoch'
  ) THEN
    RAISE EXCEPTION 'explicit writer identity/epoch missing';
  END IF;
  SELECT pg_get_functiondef(
    'public.fn_dispatch_assign_orders_v2(uuid,uuid,bigint,uuid,bigint,uuid,text,jsonb,text,text)'::regprocedure
  ) INTO v_definition;
  IF v_definition NOT LIKE '%FOR UPDATE%'
     OR v_definition NOT LIKE '%WRITER_LEASE_STALE_OR_NOT_OWNER%'
     OR v_definition NOT LIKE '%INSERT INTO public.mise_delivery_batches%'
     OR v_definition NOT LIKE '%INSERT INTO public.mise_delivery_batch_stops%'
     OR v_definition NOT LIKE '%UPDATE public.customer_orders%'
     OR v_definition NOT LIKE '%UPDATE public.mise_drivers%'
     OR v_definition NOT LIKE '%INSERT INTO public.dispatch_offer_assignments%'
     OR v_definition NOT LIKE '%INSERT INTO public.dispatch_offer_audit%'
     OR v_definition NOT LIKE '%INSERT INTO public.mise_push_outbox%'
     OR v_definition NOT LIKE '%dispatch_assignment_requests_v2%' THEN
    RAISE EXCEPTION 'assignment RPC is missing a required guard/write';
  END IF;
  IF has_function_privilege('authenticated',
      'public.fn_dispatch_assign_orders_v2(uuid,uuid,bigint,uuid,bigint,uuid,text,jsonb,text,text)',
      'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role can execute assignment RPC';
  END IF;
  IF NOT has_function_privilege('service_role',
      'public.fn_dispatch_assign_orders_v2(uuid,uuid,bigint,uuid,bigint,uuid,text,jsonb,text,text)',
      'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute assignment RPC';
  END IF;
  IF has_function_privilege('service_role',
      'public.fn_dispatch_create_offer_v1(uuid,uuid,uuid,bigint,uuid,uuid,text,integer,numeric,numeric,text,numeric,numeric,text,text,text)',
      'EXECUTE') THEN
    RAISE EXCEPTION 'obsolete Atomic-v1 writer remains executable';
  END IF;
  IF to_regprocedure(
    'public.fn_dispatch_pickup_assignment_v2(uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid)'
  ) IS NULL OR to_regprocedure(
    'public.fn_dispatch_start_delivery_v2(uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid)'
  ) IS NULL OR to_regprocedure(
    'public.fn_dispatch_cancel_order_v2(uuid,uuid,bigint,bigint,bigint,bigint,uuid,bigint,uuid,text)'
  ) IS NULL OR to_regprocedure(
    'public.fn_dispatch_reassign_before_pickup_v2(uuid,uuid,bigint,bigint,bigint,bigint,uuid,bigint,uuid,bigint,uuid,uuid,text,text)'
  ) IS NULL OR to_regprocedure(
    'public.fn_dispatch_complete_delivery_v2(uuid,uuid,bigint,bigint,bigint,bigint,uuid,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'hardened canonical lifecycle RPC missing';
  END IF;
  IF to_regprocedure(
    'public.fn_dispatch_cancel_order_v2(uuid,uuid,bigint,uuid,text)'
  ) IS NOT NULL OR to_regprocedure(
    'public.fn_dispatch_complete_delivery_v2(uuid,uuid,bigint,bigint,uuid)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'under-authorized lifecycle overload remains installed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dispatch_offer_assignments'
      AND column_name='tenant_id' AND is_nullable='NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.customer_orders'::regclass
      AND conname='customer_orders_v2_claim_pair_check'
      AND convalidated
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.mise_drivers'::regclass
      AND conname='mise_drivers_v2_capacity_check'
      AND convalidated
  ) THEN
    RAISE EXCEPTION 'hard tenant/claim/capacity constraints missing';
  END IF;
END
$test$;

ROLLBACK;
