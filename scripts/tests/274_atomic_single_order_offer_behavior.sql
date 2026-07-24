\set ON_ERROR_STOP on

BEGIN;

INSERT INTO tenants (id, name, slug)
VALUES (
  '11000000-0000-0000-0000-000000000001',
  'P0 atomic offer test tenant',
  'p0-atomic-offer-test'
);

INSERT INTO dispatch_writer_gates (tenant_id, writer, enabled)
VALUES
  ('11000000-0000-0000-0000-000000000001', 'atomic_v1', true),
  ('11000000-0000-0000-0000-000000000099', 'atomic_v1', true);

INSERT INTO locations (id, tenant_id, name)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'P0 atomic offer test location'
);

INSERT INTO mise_drivers (id, name, active, state, last_position_at)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'P0 atomic offer test driver',
  true,
  'idle',
  now()
);
INSERT INTO mise_driver_tenants (driver_id, tenant_id, status)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'active'
);

INSERT INTO customer_orders (
  id, location_id, tenant_id, bestellnummer, kunde_name, typ, status
)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'P0-ATOMIC-TEST',
  'P0 atomic offer test customer',
  'lieferung',
  'fertig'
);

DO $test$
DECLARE
  v_first jsonb;
  v_replay jsonb;
  v_conflict jsonb;
  v_cross_tenant jsonb;
  v_key_mismatch jsonb;
  v_first_batch uuid;
BEGIN
  v_cross_tenant := fn_dispatch_create_offer_v1(
    '11000000-0000-0000-0000-000000000099',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    0,
    '40000000-0000-0000-0000-000000000099',
    '50000000-0000-0000-0000-000000000099',
    'test-v1',
    20,
    52.0, 13.0, 'pickup',
    52.01, 13.01, 'dropoff',
    'offer', 'body'
  );
  IF v_cross_tenant->>'reason_code' <> 'TENANT_ORDER_MISMATCH' THEN
    RAISE EXCEPTION 'cross-tenant order was not rejected: %', v_cross_tenant;
  END IF;

  v_first := fn_dispatch_create_offer_v1(
    '11000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    0,
    '40000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    'test-v1',
    20,
    52.0, 13.0, 'pickup',
    52.01, 13.01, 'dropoff',
    'offer', 'body'
  );

  IF NOT coalesce((v_first->>'ok')::boolean, false)
     OR coalesce((v_first->>'idempotent_replay')::boolean, true) THEN
    RAISE EXCEPTION 'first offer failed: %', v_first;
  END IF;
  v_first_batch := (v_first->>'batch_id')::uuid;

  v_replay := fn_dispatch_create_offer_v1(
    '11000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    0,
    '40000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    'test-v1',
    20,
    52.0, 13.0, 'pickup',
    52.01, 13.01, 'dropoff',
    'offer', 'body'
  );

  IF NOT coalesce((v_replay->>'idempotent_replay')::boolean, false)
     OR (v_replay->>'batch_id')::uuid <> v_first_batch THEN
    RAISE EXCEPTION 'idempotent replay diverged: %', v_replay;
  END IF;

  v_key_mismatch := fn_dispatch_create_offer_v1(
    '11000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    0,
    '40000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    'test-v1',
    20,
    52.0, 13.0, 'pickup',
    52.01, 13.01, 'different-dropoff',
    'offer', 'body'
  );
  IF v_key_mismatch->>'reason_code'
       <> 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' THEN
    RAISE EXCEPTION 'idempotency mismatch was not rejected: %', v_key_mismatch;
  END IF;

  v_conflict := fn_dispatch_create_offer_v1(
    '11000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    0,
    '40000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000002',
    'test-v1',
    20,
    52.0, 13.0, 'pickup',
    52.01, 13.01, 'dropoff',
    'offer', 'body'
  );

  IF v_conflict->>'reason_code' <> 'ORDER_VERSION_CONFLICT' THEN
    RAISE EXCEPTION 'expected version conflict, got: %', v_conflict;
  END IF;
END
$test$;

DO $assert$
BEGIN
  IF (SELECT count(*) FROM dispatch_offer_assignments
      WHERE order_id = '30000000-0000-0000-0000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'expected exactly one assignment';
  END IF;
  IF (SELECT count(*) FROM mise_delivery_batches b
      JOIN dispatch_offer_assignments a ON a.batch_id = b.id
      WHERE a.order_id = '30000000-0000-0000-0000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'expected exactly one batch';
  END IF;
  IF (SELECT count(*) FROM mise_delivery_batch_stops
      WHERE order_id = '30000000-0000-0000-0000-000000000001') <> 2 THEN
    RAISE EXCEPTION 'expected exactly two stops';
  END IF;
  IF (SELECT count(*) FROM dispatch_offer_audit
      WHERE order_id = '30000000-0000-0000-0000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'expected exactly one audit row';
  END IF;
  IF (SELECT count(*) FROM mise_push_outbox
      WHERE data->>'order_id' = '30000000-0000-0000-0000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'expected exactly one push outbox row';
  END IF;
  IF (SELECT dispatch_version FROM customer_orders
      WHERE id = '30000000-0000-0000-0000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'expected order version 1';
  END IF;
END
$assert$;

DO $lifecycle$
DECLARE
  v_offer_id uuid;
  v_accept jsonb;
  v_replay jsonb;
  v_picked jsonb;
  v_progress jsonb;
  v_complete jsonb;
BEGIN
  SELECT id INTO v_offer_id
  FROM dispatch_offer_assignments
  WHERE order_id = '30000000-0000-0000-0000-000000000001';

  v_accept := fn_dispatch_transition_offer_v1(
    '11000000-0000-0000-0000-000000000001',
    v_offer_id, 1, 'accept',
    '60000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001'
  );
  IF NOT coalesce((v_accept->>'ok')::boolean, false)
     OR v_accept->>'state' <> 'accepted'
     OR (v_accept->>'assignment_version')::bigint <> 2 THEN
    RAISE EXCEPTION 'accept failed: %', v_accept;
  END IF;

  v_replay := fn_dispatch_transition_offer_v1(
    '11000000-0000-0000-0000-000000000001',
    v_offer_id, 1, 'accept',
    '60000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001'
  );
  IF NOT coalesce((v_replay->>'idempotent_replay')::boolean, false)
     OR v_replay->>'state' <> 'accepted' THEN
    RAISE EXCEPTION 'accept replay failed: %', v_replay;
  END IF;

  v_picked := fn_dispatch_transition_offer_v1(
    '11000000-0000-0000-0000-000000000001',
    v_offer_id, 2, 'picked_up',
    '60000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001'
  );
  v_progress := fn_dispatch_transition_offer_v1(
    '11000000-0000-0000-0000-000000000001',
    v_offer_id, 3, 'in_progress',
    '60000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001'
  );
  v_complete := fn_dispatch_transition_offer_v1(
    '11000000-0000-0000-0000-000000000001',
    v_offer_id, 4, 'complete',
    '60000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001'
  );
  IF v_picked->>'state' <> 'picked_up'
     OR v_progress->>'state' <> 'in_progress'
     OR v_complete->>'state' <> 'completed' THEN
    RAISE EXCEPTION 'lifecycle did not complete: %, %, %',
      v_picked, v_progress, v_complete;
  END IF;
  IF (SELECT state FROM mise_drivers
      WHERE id = '20000000-0000-0000-0000-000000000001') <> 'returning' THEN
    RAISE EXCEPTION 'driver was not returned atomically';
  END IF;
  IF (SELECT status FROM customer_orders
      WHERE id = '30000000-0000-0000-0000-000000000001') <> 'geliefert' THEN
    RAISE EXCEPTION 'order was not completed atomically';
  END IF;
END
$lifecycle$;

-- Failure injection: ein Outbox-Fehler muss alle vorherigen Writes der RPC
-- zurückrollen. Der umgebende DO-Block fängt nur den erwarteten Fehler.
INSERT INTO mise_drivers (id, name, active, state, last_position_at)
VALUES (
  '20000000-0000-0000-0000-000000000002',
  'P0 atomic rollback test driver',
  true,
  'idle',
  now()
);
INSERT INTO mise_driver_tenants (driver_id, tenant_id, status)
VALUES (
  '20000000-0000-0000-0000-000000000002',
  '11000000-0000-0000-0000-000000000001',
  'active'
);

INSERT INTO customer_orders (
  id, location_id, tenant_id, bestellnummer, kunde_name, typ, status
)
VALUES (
  '30000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'P0-ATOMIC-ROLLBACK',
  'P0 atomic rollback test customer',
  'lieferung',
  'fertig'
);

CREATE FUNCTION fail_second_offer_push() RETURNS trigger
LANGUAGE plpgsql AS $trigger$
BEGIN
  IF NEW.data->>'order_id' = '30000000-0000-0000-0000-000000000002' THEN
    RAISE EXCEPTION 'injected outbox failure';
  END IF;
  RETURN NEW;
END
$trigger$;

CREATE TRIGGER trg_fail_second_offer_push
BEFORE INSERT ON mise_push_outbox
FOR EACH ROW EXECUTE FUNCTION fail_second_offer_push();

DO $failure$
BEGIN
  PERFORM fn_dispatch_create_offer_v1(
    '11000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    0,
    '40000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000003',
    'test-v1',
    20,
    52.0, 13.0, 'pickup',
    52.01, 13.01, 'dropoff',
    'offer', 'body'
  );
  RAISE EXCEPTION 'expected injected outbox failure';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM <> 'injected outbox failure' THEN
      RAISE;
    END IF;
END
$failure$;

DO $rollback_assert$
BEGIN
  IF EXISTS (
    SELECT 1 FROM customer_orders
    WHERE id = '30000000-0000-0000-0000-000000000002'
      AND (mise_batch_id IS NOT NULL OR mise_driver_id IS NOT NULL
           OR dispatch_version <> 0)
  ) THEN
    RAISE EXCEPTION 'failed offer left an order claim';
  END IF;
  IF EXISTS (
    SELECT 1 FROM dispatch_offer_assignments
    WHERE order_id = '30000000-0000-0000-0000-000000000002'
  ) THEN
    RAISE EXCEPTION 'failed offer left an assignment';
  END IF;
  IF EXISTS (
    SELECT 1 FROM mise_delivery_batch_stops
    WHERE order_id = '30000000-0000-0000-0000-000000000002'
  ) THEN
    RAISE EXCEPTION 'failed offer left stops';
  END IF;
END
$rollback_assert$;

DROP TRIGGER trg_fail_second_offer_push ON mise_push_outbox;

DO $writer_switch$
DECLARE
  v_offer jsonb;
  v_closed jsonb;
  v_expire jsonb;
BEGIN
  v_offer := fn_dispatch_create_offer_v1(
    '11000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    0,
    '40000000-0000-0000-0000-000000000004',
    '50000000-0000-0000-0000-000000000004',
    'test-v1', 20,
    52.0, 13.0, 'pickup',
    52.01, 13.01, 'dropoff',
    'offer', 'body'
  );
  IF coalesce((v_offer->>'ok')::boolean, false) IS NOT true THEN
    RAISE EXCEPTION 'switch test offer failed: %', v_offer;
  END IF;

  BEGIN
    PERFORM fn_dispatch_set_writer_v1(
      '11000000-0000-0000-0000-000000000001', 'legacy_db', true
    );
    RAISE EXCEPTION 'active offer did not block writer switch';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'ACTIVE_ATOMIC_OFFERS_BLOCK_WRITER_SWITCH' THEN
        RAISE;
      END IF;
  END;

  v_expire := fn_dispatch_transition_offer_v1(
    '11000000-0000-0000-0000-000000000001',
    (v_offer->>'offer_id')::uuid,
    (v_offer->>'assignment_version')::bigint,
    'expire',
    '60000000-0000-0000-0000-000000000005',
    NULL
  );
  IF coalesce((v_expire->>'ok')::boolean, false) IS NOT true
     OR v_expire->>'state' <> 'expired' THEN
    RAISE EXCEPTION 'switch test expire failed: %', v_expire;
  END IF;
  PERFORM fn_dispatch_set_writer_v1(
    '11000000-0000-0000-0000-000000000001', 'legacy_db', true
  );

  v_closed := fn_dispatch_create_offer_v1(
    '11000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    1,
    '40000000-0000-0000-0000-000000000005',
    '50000000-0000-0000-0000-000000000005',
    'test-v1', 20,
    52.0, 13.0, 'pickup',
    52.01, 13.01, 'dropoff',
    'offer', 'body'
  );
  IF v_closed->>'reason_code' <> 'SINGLE_WRITER_GATE_CLOSED' THEN
    RAISE EXCEPTION 'atomic writer ran after switch-back: %', v_closed;
  END IF;
  IF public.fn_dispatch_writer_allows_location_v1(
       '10000000-0000-0000-0000-000000000001', 'legacy_db'
     ) IS NOT true
     OR public.fn_dispatch_writer_allows_location_v1(
       '10000000-0000-0000-0000-000000000001', 'frank_db'
     ) IS NOT false THEN
    RAISE EXCEPTION 'writer election does not select exactly one DB writer';
  END IF;

  PERFORM fn_dispatch_set_writer_v1(
    '11000000-0000-0000-0000-000000000001', 'atomic_v1', true
  );
END
$writer_switch$;

ROLLBACK;
