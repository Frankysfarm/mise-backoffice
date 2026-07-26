\set ON_ERROR_STOP on

BEGIN TRANSACTION READ ONLY;

DO $stop_gate$
DECLARE
  v_affected bigint;
BEGIN
  SELECT count(*) INTO v_affected
  FROM (
    SELECT order_id FROM dispatch_offer_assignments
    WHERE state IN ('offered','accepted','assigned','picked_up','in_progress')
    GROUP BY order_id HAVING count(*) > 1
  ) d;
  IF v_affected > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_ACTIVE_ASSIGNMENT_DUPLICATES:%', v_affected;
  END IF;

  SELECT count(*) INTO v_affected FROM customer_orders
  WHERE (mise_batch_id IS NULL) <> (mise_driver_id IS NULL);
  IF v_affected > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_HALF_NULL_ORDER_CLAIMS:%', v_affected;
  END IF;

  SELECT count(*) INTO v_affected FROM dispatch_offer_assignments a
  LEFT JOIN customer_orders o ON o.id=a.order_id
  LEFT JOIN locations l ON l.id=o.location_id
  WHERE a.state IN ('offered','accepted','assigned','picked_up','in_progress')
    AND (a.tenant_id IS NULL OR l.tenant_id IS DISTINCT FROM a.tenant_id);
  IF v_affected > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_ASSIGNMENT_TENANT_MISMATCH:%', v_affected;
  END IF;

  SELECT count(*) INTO v_affected FROM mise_drivers
  WHERE current_capacity < 0 OR max_capacity < 0
     OR current_capacity > max_capacity;
  IF v_affected > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_DRIVER_CAPACITY_OUT_OF_BOUNDS:%', v_affected;
  END IF;

  SELECT count(*) INTO v_affected FROM dispatch_writer_gates
  WHERE writer='atomic_v1' AND enabled;
  IF v_affected > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_ATOMIC_V1_GATE_ENABLED:%', v_affected;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='dispatch_offer_assignments'
      AND column_name='tenant_id' AND is_nullable<>'NO'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT_ASSIGNMENT_TENANT_NULLABLE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.customer_orders'::regclass
      AND conname='customer_orders_v2_claim_pair_check'
      AND convalidated
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.mise_drivers'::regclass
      AND conname='mise_drivers_v2_capacity_check'
      AND convalidated
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='uq_dispatch_offer_active_order'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT_REQUIRED_DB_CONSTRAINT_MISSING';
  END IF;
END
$stop_gate$;

SELECT 'preflight_stop_gate' AS check_name, 0::bigint AS affected,
       'PASS' AS result;

ROLLBACK;
