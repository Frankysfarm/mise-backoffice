\set ON_ERROR_STOP on

BEGIN;
\ir ../migrations/276_atomic_single_writer_v2.sql
DO $dry_contract$
BEGIN
  IF to_regprocedure(
    'public.fn_dispatch_assign_orders_v2(uuid,uuid,bigint,uuid,bigint,uuid,text,jsonb,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'dry-run migration did not create assignment RPC';
  END IF;
END
$dry_contract$;
ROLLBACK;

DO $verify_rollback$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dispatch_writer_gates'
      AND column_name = 'active_writer_id'
  ) THEN
    RAISE EXCEPTION 'migration dry-run did not roll schema back';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM dispatch_writer_gates
    WHERE writer = 'atomic_v1' AND enabled
  ) THEN
    RAISE EXCEPTION 'migration dry-run did not roll data back';
  END IF;
END
$verify_rollback$;
