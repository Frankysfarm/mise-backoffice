\set ON_ERROR_STOP on

DO $assert$
BEGIN
  IF (SELECT count(*) FROM dispatch_offer_assignments) <> 2 THEN
    RAISE EXCEPTION 'expected two winning assignments';
  END IF;
  IF EXISTS (
    SELECT order_id FROM dispatch_offer_assignments
    GROUP BY order_id HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'an order has more than one assignment';
  END IF;
  IF (SELECT count(*) FROM mise_delivery_batches) <> 2
     OR (SELECT count(*) FROM mise_delivery_batch_stops) <> 4
     OR (SELECT count(*) FROM mise_push_outbox) <> 2 THEN
    RAISE EXCEPTION 'atomic write counts diverged';
  END IF;
  IF EXISTS (
    SELECT 1 FROM customer_orders
    WHERE (mise_batch_id IS NULL) <> (mise_driver_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'half-null order assignment';
  END IF;
END
$assert$;
