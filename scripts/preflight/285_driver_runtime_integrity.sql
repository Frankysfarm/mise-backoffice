\set ON_ERROR_STOP on
-- Read-only readiness checks for migration 285. Any non-zero affected count
-- must be resolved before applying the unique indexes in a disposable/staging
-- rehearsal; this script never mutates rows.

SELECT 'drivers_with_multiple_active_batches' AS check_name,count(*) AS affected
FROM (
  SELECT driver_id FROM public.mise_delivery_batches
  WHERE driver_id IS NOT NULL
    AND state IN ('pending_acceptance','assigned','at_pickup','in_progress')
  GROUP BY driver_id HAVING count(*)>1
) conflicts;

SELECT 'duplicate_existing_nonnull_push_dedupe_keys' AS check_name,count(*) AS affected
FROM (
  SELECT to_jsonb(p)->>'dedupe_key' AS dedupe_key FROM public.mise_push_outbox p
  WHERE to_jsonb(p)->>'dedupe_key' IS NOT NULL
  GROUP BY to_jsonb(p)->>'dedupe_key' HAVING count(*)>1
) conflicts;

SELECT 'assignment_wakes_without_authority_reference' AS check_name,count(*) AS affected
FROM public.mise_push_outbox
WHERE type IN ('assign','order_assigned')
  AND NOT (data ? 'assignment_id' OR data ? 'batch_id' OR data ? 'order_id');

SELECT 'malformed_assignment_reference_uuid' AS check_name,count(*) AS affected
FROM public.mise_push_outbox
WHERE type IN ('assign','order_assigned') AND (
  (data ? 'assignment_id' AND NOT (data->>'assignment_id' ~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'))
  OR (data ? 'batch_id' AND NOT (data->>'batch_id' ~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'))
);

SELECT 'active_assignment_without_active_batch' AS check_name,count(*) AS affected
FROM public.dispatch_offer_assignments a
LEFT JOIN public.mise_delivery_batches b ON b.id=a.batch_id
WHERE a.state IN ('assigned','accepted','picked_up','in_progress')
  AND (b.id IS NULL OR b.driver_id IS DISTINCT FROM a.driver_id
    OR b.state NOT IN ('pending_acceptance','assigned','at_pickup','in_progress'));

SELECT 'in_progress_order_missing_dropoff' AS check_name,count(*) AS affected
FROM public.dispatch_offer_assignments a
WHERE a.state='in_progress' AND NOT EXISTS (
  SELECT 1 FROM public.mise_delivery_batch_stops s
  WHERE s.batch_id=a.batch_id AND s.order_id=a.order_id AND s.type='dropoff'
);
