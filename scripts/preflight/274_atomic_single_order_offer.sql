\set ON_ERROR_STOP on

-- Read-only preflight. Liefert ausschließlich Aggregate und Schema-Metadaten.
BEGIN TRANSACTION READ ONLY;

SELECT 'half_null_assignment' AS check_name, count(*) AS affected
FROM customer_orders
WHERE (mise_batch_id IS NULL) <> (mise_driver_id IS NULL)
UNION ALL
SELECT 'batch_driver_mismatch', count(*)
FROM customer_orders o
JOIN mise_delivery_batches b ON b.id = o.mise_batch_id
WHERE o.mise_driver_id IS DISTINCT FROM b.driver_id
UNION ALL
SELECT 'duplicate_stop_key_groups', count(*)
FROM (
  SELECT batch_id, order_id, type
  FROM mise_delivery_batch_stops
  GROUP BY batch_id, order_id, type
  HAVING count(*) > 1
) duplicates
UNION ALL
SELECT 'orders_with_multiple_active_batches', count(*)
FROM (
  SELECT s.order_id
  FROM mise_delivery_batch_stops s
  JOIN mise_delivery_batches b ON b.id = s.batch_id
  WHERE b.state NOT IN ('completed', 'cancelled')
  GROUP BY s.order_id
  HAVING count(DISTINCT s.batch_id) > 1
) duplicates;

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mise_push_outbox'
  ) AS push_outbox_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mise_delivery_batches'
      AND column_name = 'location_id'
  ) AS batch_location_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mise_drivers'
      AND column_name = 'last_position_at'
  ) AS driver_position_time_exists;

WITH required(table_name, column_name, expected_type) AS (
  VALUES
    ('customer_orders', 'id', 'uuid'),
    ('customer_orders', 'location_id', 'uuid'),
    ('customer_orders', 'typ', 'USER-DEFINED'),
    ('customer_orders', 'status', 'USER-DEFINED'),
    ('customer_orders', 'mise_batch_id', 'uuid'),
    ('customer_orders', 'mise_driver_id', 'uuid'),
    ('customer_orders', 'updated_at', 'timestamp with time zone'),
    ('locations', 'id', 'uuid'),
    ('locations', 'tenant_id', 'uuid'),
    ('mise_drivers', 'id', 'uuid'),
    ('mise_drivers', 'active', 'boolean'),
    ('mise_drivers', 'state', 'text'),
    ('mise_drivers', 'last_position_at', 'timestamp with time zone'),
    ('mise_drivers', 'updated_at', 'timestamp with time zone'),
    ('mise_driver_tenants', 'driver_id', 'uuid'),
    ('mise_driver_tenants', 'tenant_id', 'uuid'),
    ('mise_driver_tenants', 'status', 'text'),
    ('mise_delivery_batches', 'id', 'uuid'),
    ('mise_delivery_batches', 'driver_id', 'uuid'),
    ('mise_delivery_batches', 'state', 'text'),
    ('mise_delivery_batches', 'location_id', 'uuid'),
    ('mise_delivery_batches', 'accepted_at', 'timestamp with time zone'),
    ('mise_delivery_batches', 'cancelled_at', 'timestamp with time zone'),
    ('mise_delivery_batch_stops', 'batch_id', 'uuid'),
    ('mise_delivery_batch_stops', 'order_id', 'uuid'),
    ('mise_delivery_batch_stops', 'type', 'text'),
    ('mise_delivery_batch_stops', 'sequence', 'integer'),
    ('mise_push_outbox', 'driver_id', 'uuid'),
    ('mise_push_outbox', 'type', 'text'),
    ('mise_push_outbox', 'title', 'text'),
    ('mise_push_outbox', 'body', 'text'),
    ('mise_push_outbox', 'sound', 'text'),
    ('mise_push_outbox', 'priority', 'text'),
    ('mise_push_outbox', 'data', 'jsonb')
)
SELECT
  r.table_name,
  r.column_name,
  r.expected_type,
  c.data_type AS actual_type,
  CASE
    WHEN c.column_name IS NULL THEN 'MISSING'
    WHEN c.data_type <> r.expected_type THEN 'TYPE_MISMATCH'
    ELSE 'OK'
  END AS result
FROM required r
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = r.table_name
 AND c.column_name = r.column_name
ORDER BY result DESC, r.table_name, r.column_name;

SELECT event_object_table, trigger_name, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'customer_orders'
  AND action_timing = 'AFTER'
  AND event_manipulation = 'UPDATE'
ORDER BY trigger_name;

SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'smart_dispatch_order',
    'fn_frank_assign_nearest_driver',
    'fn_create_delivery_batch',
    'fn_dispatch_create_offer_v1',
    'fn_dispatch_transition_offer_v1',
    'fn_dispatch_expire_offers_v1'
  )
ORDER BY p.proname;

ROLLBACK;
