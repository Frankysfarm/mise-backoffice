-- Migration 274: P0 atomic, idempotent single-order offer foundation.
-- Default-off: without an enabled tenant gate every existing writer keeps its
-- current behaviour. An enabled gate elects exactly one writer for that tenant.

ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS dispatch_version bigint NOT NULL DEFAULT 0;

ALTER TABLE mise_delivery_batches
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS route_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Existing order triggers use unqualified public objects. Give every trigger
-- function on customer_orders its own deterministic path so it remains
-- resolvable when invoked by the hardened dispatch RPCs below.
DO $migration$
DECLARE
  v_trigger_function regprocedure;
BEGIN
  FOR v_trigger_function IN
    SELECT t.tgfoid::regprocedure
    FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'public.customer_orders'::regclass
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = public, pg_catalog',
      v_trigger_function
    );
  END LOOP;
END
$migration$;

CREATE TABLE IF NOT EXISTS dispatch_writer_gates (
  tenant_id uuid PRIMARY KEY,
  writer text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_writer_gates_writer_check
    CHECK (writer IN ('legacy_db', 'frank_db', 'frank_js', 'atomic_v1'))
);

COMMENT ON TABLE dispatch_writer_gates IS
  'Default-off tenant writer election. Missing/disabled row preserves all legacy behaviour.';

CREATE OR REPLACE FUNCTION fn_dispatch_writer_for_tenant_v1(
  p_tenant_id uuid
) RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT g.writer
  FROM public.dispatch_writer_gates g
  WHERE g.tenant_id = p_tenant_id
    AND g.enabled = true
$$;

CREATE OR REPLACE FUNCTION fn_dispatch_writer_allows_location_v1(
  p_location_id uuid,
  p_expected_writer text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT CASE
    -- No enabled row is the compatibility/default-off state.
    WHEN selected.writer IS NULL THEN true
    ELSE selected.writer = p_expected_writer
  END
  FROM (
    SELECT public.fn_dispatch_writer_for_tenant_v1(l.tenant_id) AS writer
    FROM public.locations l
    WHERE l.id = p_location_id
  ) selected
$$;

-- Gate the two production DB trigger wrappers without dropping either trigger.
-- These definitions intentionally preserve the inventoried 2026-07-24 trigger
-- semantics and only add the tenant writer predicate. Environments without the
-- legacy wrapper are left untouched.
DO $migration$
BEGIN
  IF pg_catalog.to_regprocedure('public.create_dispatch_batch()') IS NOT NULL THEN
    EXECUTE $function$
      CREATE OR REPLACE FUNCTION public.create_dispatch_batch()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = pg_catalog, pg_temp
      AS $body$
      DECLARE
        v_tenant_id uuid;
      BEGIN
        IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
        IF NEW.status::text <> 'fertig' THEN RETURN NEW; END IF;
        IF NEW.typ::text <> 'lieferung' THEN RETURN NEW; END IF;
        IF OLD.status::text = 'fertig' THEN RETURN NEW; END IF;
        SELECT l.tenant_id INTO v_tenant_id
        FROM public.locations l
        WHERE l.id = NEW.location_id;
        IF v_tenant_id IS NOT NULL THEN
          PERFORM pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(v_tenant_id::text, 27401)
          );
        END IF;
        IF NOT public.fn_dispatch_writer_allows_location_v1(
          NEW.location_id, 'legacy_db'
        ) THEN
          RETURN NEW;
        END IF;
        PERFORM public.smart_dispatch_order(NEW.id);
        RETURN NEW;
      END
      $body$
    $function$;
  END IF;

  IF pg_catalog.to_regprocedure('public.fn_trigger_frank_on_ready()') IS NOT NULL THEN
    EXECUTE $function$
      CREATE OR REPLACE FUNCTION public.fn_trigger_frank_on_ready()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = pg_catalog, pg_temp
      AS $body$
      DECLARE
        v_tenant_id uuid;
      BEGIN
        IF NEW.status::text = 'fertig'
           AND coalesce(OLD.status::text, '') <> 'fertig'
           AND NEW.typ::text = 'lieferung' THEN
          SELECT l.tenant_id INTO v_tenant_id
          FROM public.locations l
          WHERE l.id = NEW.location_id;
          IF v_tenant_id IS NOT NULL THEN
            PERFORM pg_catalog.pg_advisory_xact_lock(
              pg_catalog.hashtextextended(v_tenant_id::text, 27401)
            );
          END IF;
          IF public.fn_dispatch_writer_allows_location_v1(
               NEW.location_id, 'frank_db'
             ) THEN
            PERFORM public.fn_frank_assign_nearest_driver(NEW.id);
          END IF;
        END IF;
        RETURN NEW;
      END
      $body$
    $function$;
  END IF;
END
$migration$;

CREATE TABLE IF NOT EXISTS dispatch_offer_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid NOT NULL REFERENCES customer_orders(id) ON DELETE RESTRICT,
  batch_id            uuid NOT NULL REFERENCES mise_delivery_batches(id) ON DELETE RESTRICT,
  driver_id           uuid NOT NULL REFERENCES mise_drivers(id) ON DELETE RESTRICT,
  state               text NOT NULL DEFAULT 'offered',
  decision_id         uuid NOT NULL,
  idempotency_key     uuid NOT NULL,
  request_fingerprint text NOT NULL,
  expected_order_version bigint NOT NULL,
  assignment_version  bigint NOT NULL DEFAULT 1,
  lease_expires_at    timestamptz NOT NULL,
  received_by_app_at  timestamptz,
  algorithm_version   text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_offer_assignments_state_check
    CHECK (state IN ('offered', 'accepted', 'expired', 'declined', 'cancelled',
                    'picked_up', 'in_progress', 'completed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dispatch_offer_idempotency
  ON dispatch_offer_assignments (idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dispatch_offer_active_order
  ON dispatch_offer_assignments (order_id)
  WHERE state IN ('offered', 'accepted', 'picked_up', 'in_progress');

CREATE UNIQUE INDEX IF NOT EXISTS uq_dispatch_offer_active_driver
  ON dispatch_offer_assignments (driver_id)
  WHERE state IN ('offered', 'accepted', 'picked_up', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_dispatch_offer_expiry
  ON dispatch_offer_assignments (lease_expires_at)
  WHERE state = 'offered';

CREATE TABLE IF NOT EXISTS dispatch_offer_audit (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id           uuid NOT NULL,
  idempotency_key       uuid NOT NULL,
  order_id              uuid NOT NULL REFERENCES customer_orders(id) ON DELETE RESTRICT,
  batch_id              uuid REFERENCES mise_delivery_batches(id) ON DELETE SET NULL,
  driver_id             uuid REFERENCES mise_drivers(id) ON DELETE SET NULL,
  outcome               text NOT NULL,
  reason_code           text NOT NULL,
  expected_order_version bigint NOT NULL,
  algorithm_version     text NOT NULL,
  details               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_offer_audit_outcome_check
    CHECK (outcome IN ('offered', 'accepted', 'declined', 'expired', 'completed',
                       'conflict', 'rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dispatch_offer_audit_decision
  ON dispatch_offer_audit (decision_id);

CREATE TABLE IF NOT EXISTS dispatch_offer_transition_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transition_key        uuid NOT NULL UNIQUE,
  request_fingerprint   text NOT NULL,
  offer_id              uuid NOT NULL REFERENCES dispatch_offer_assignments(id) ON DELETE RESTRICT,
  action                text NOT NULL,
  result                jsonb NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION fn_dispatch_set_writer_v1(
  p_tenant_id uuid,
  p_writer text,
  p_enabled boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_previous public.dispatch_writer_gates%ROWTYPE;
BEGIN
  IF p_writer NOT IN ('legacy_db', 'frank_db', 'frank_js', 'atomic_v1') THEN
    RAISE EXCEPTION 'INVALID_DISPATCH_WRITER';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t WHERE t.id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'DISPATCH_TENANT_NOT_FOUND';
  END IF;

  -- Switching and atomic offer creation use the same tenant lock. This closes
  -- DB-trigger/atomic races at the switch boundary. The runbook additionally
  -- requires draining pre-gate JS work before enabling a gate.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text, 27401)
  );

  SELECT * INTO v_previous
  FROM public.dispatch_writer_gates
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF coalesce(v_previous.enabled, false)
     AND v_previous.writer = 'atomic_v1'
     AND (NOT p_enabled OR p_writer <> 'atomic_v1')
     AND EXISTS (
       SELECT 1
       FROM public.dispatch_offer_assignments a
       JOIN public.customer_orders o ON o.id = a.order_id
       JOIN public.locations l ON l.id = o.location_id
       WHERE l.tenant_id = p_tenant_id
         AND a.state IN ('offered', 'accepted', 'picked_up', 'in_progress')
     ) THEN
    RAISE EXCEPTION 'ACTIVE_ATOMIC_OFFERS_BLOCK_WRITER_SWITCH';
  END IF;

  INSERT INTO public.dispatch_writer_gates (tenant_id, writer, enabled, updated_at)
  VALUES (p_tenant_id, p_writer, p_enabled, now())
  ON CONFLICT (tenant_id) DO UPDATE
    SET writer = EXCLUDED.writer,
        enabled = EXCLUDED.enabled,
        updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'tenant_id', p_tenant_id,
    'writer', p_writer,
    'enabled', p_enabled,
    'previous_writer', v_previous.writer,
    'previous_enabled', coalesce(v_previous.enabled, false)
  );
END;
$$;

ALTER TABLE dispatch_offer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_offer_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_offer_transition_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_writer_gates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dispatch_offer_assignments_service_role
  ON dispatch_offer_assignments;
CREATE POLICY dispatch_offer_assignments_service_role
  ON dispatch_offer_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS dispatch_offer_audit_service_role
  ON dispatch_offer_audit;
CREATE POLICY dispatch_offer_audit_service_role
  ON dispatch_offer_audit
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS dispatch_offer_transition_requests_service_role
  ON dispatch_offer_transition_requests;
CREATE POLICY dispatch_offer_transition_requests_service_role
  ON dispatch_offer_transition_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS dispatch_writer_gates_service_role ON dispatch_writer_gates;
CREATE POLICY dispatch_writer_gates_service_role
  ON dispatch_writer_gates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION fn_dispatch_create_offer_v1(
  p_tenant_id uuid,
  p_order_id uuid,
  p_driver_id uuid,
  p_expected_order_version bigint,
  p_decision_id uuid,
  p_idempotency_key uuid,
  p_algorithm_version text,
  p_offer_ttl_seconds integer,
  p_pickup_lat numeric,
  p_pickup_lng numeric,
  p_pickup_address text,
  p_dropoff_lat numeric,
  p_dropoff_lng numeric,
  p_dropoff_address text,
  p_push_title text,
  p_push_body text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_existing public.dispatch_offer_assignments%ROWTYPE;
  v_order public.customer_orders%ROWTYPE;
  v_driver public.mise_drivers%ROWTYPE;
  v_order_tenant_id uuid;
  v_batch_id uuid;
  v_assignment_id uuid;
  v_expires_at timestamptz;
  v_request_fingerprint text;
BEGIN
  IF p_idempotency_key IS NULL OR p_decision_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'MISSING_IDEMPOTENCY');
  END IF;
  IF p_algorithm_version IS NULL OR btrim(p_algorithm_version) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'MISSING_ALGORITHM_VERSION');
  END IF;
  IF p_offer_ttl_seconds < 10 OR p_offer_ttl_seconds > 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'INVALID_OFFER_TTL');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text, 27401)
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.dispatch_writer_gates
    WHERE tenant_id = p_tenant_id
      AND writer = 'atomic_v1'
      AND enabled = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'SINGLE_WRITER_GATE_CLOSED');
  END IF;

  -- Gleiche Keys über mehrere Worker/Prozesse serialisieren. Der Lock lebt bis
  -- zum Ende dieser RPC-Transaktion und schützt damit Recheck + alle Writes.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key::text, 274)
  );

  v_request_fingerprint := md5(pg_catalog.concat_ws('|',
    p_tenant_id::text,
    p_order_id::text,
    p_driver_id::text,
    p_expected_order_version::text,
    p_algorithm_version,
    p_offer_ttl_seconds::text,
    p_pickup_lat::text,
    p_pickup_lng::text,
    coalesce(p_pickup_address, ''),
    p_dropoff_lat::text,
    p_dropoff_lng::text,
    coalesce(p_dropoff_address, ''),
    coalesce(p_push_title, ''),
    coalesce(p_push_body, '')
  ));

  SELECT * INTO v_existing
  FROM public.dispatch_offer_assignments
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.request_fingerprint <> v_request_fingerprint THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason_code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
      );
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'assignment_id', v_existing.id,
      'offer_id', v_existing.id,
      'assignment_version', v_existing.assignment_version,
      'batch_id', v_existing.batch_id,
      'state', v_existing.state,
      'lease_expires_at', v_existing.lease_expires_at
    );
  END IF;

  SELECT * INTO v_order
  FROM public.customer_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ORDER_NOT_FOUND');
  END IF;
  IF v_order.typ::text <> 'lieferung' OR v_order.status::text <> 'fertig' THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ORDER_NOT_READY');
  END IF;
  IF v_order.dispatch_version <> p_expected_order_version THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason_code', 'ORDER_VERSION_CONFLICT',
      'current_order_version', v_order.dispatch_version
    );
  END IF;
  IF v_order.mise_batch_id IS NOT NULL OR v_order.mise_driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ORDER_ALREADY_ASSIGNED');
  END IF;
  IF v_order.location_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ORDER_LOCATION_MISSING');
  END IF;
  SELECT l.tenant_id INTO v_order_tenant_id
  FROM public.locations l
  WHERE l.id = v_order.location_id;
  IF v_order_tenant_id IS NULL OR v_order_tenant_id <> p_tenant_id THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'TENANT_ORDER_MISMATCH');
  END IF;
  IF p_pickup_lat IS NULL OR p_pickup_lng IS NULL
     OR p_dropoff_lat IS NULL OR p_dropoff_lng IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ROUTE_COORDINATES_MISSING');
  END IF;

  SELECT * INTO v_driver
  FROM public.mise_drivers
  WHERE id = p_driver_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_driver.active
     OR v_driver.state NOT IN ('idle', 'returning') THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'DRIVER_NOT_ELIGIBLE');
  END IF;
  IF v_driver.last_position_at IS NULL
     OR v_driver.last_position_at < now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'DRIVER_GPS_STALE');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.mise_driver_tenants mdt
    WHERE mdt.driver_id = p_driver_id
      AND mdt.tenant_id = p_tenant_id
      AND mdt.status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'TENANT_DRIVER_MISMATCH');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dispatch_offer_assignments
    WHERE driver_id = p_driver_id
      AND state IN ('offered', 'accepted', 'picked_up', 'in_progress')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'DRIVER_ALREADY_RESERVED');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.mise_delivery_batches
    WHERE driver_id = p_driver_id
      AND state NOT IN ('completed', 'cancelled')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'DRIVER_HAS_ACTIVE_BATCH');
  END IF;

  v_expires_at := clock_timestamp() + make_interval(secs => p_offer_ttl_seconds);

  INSERT INTO public.mise_delivery_batches (
    driver_id, state, location_id, offer_expires_at, route_version, updated_at
  ) VALUES (
    p_driver_id, 'pending_acceptance', v_order.location_id,
    v_expires_at, 1, now()
  ) RETURNING id INTO v_batch_id;

  INSERT INTO public.mise_delivery_batch_stops (
    batch_id, order_id, type, sequence, lat, lng, address
  ) VALUES
    (v_batch_id, p_order_id, 'pickup', 0,
     p_pickup_lat, p_pickup_lng, p_pickup_address),
    (v_batch_id, p_order_id, 'dropoff', 1,
     p_dropoff_lat, p_dropoff_lng, p_dropoff_address);

  UPDATE public.customer_orders
  SET mise_batch_id = v_batch_id,
      mise_driver_id = p_driver_id,
      dispatch_version = dispatch_version + 1,
      updated_at = now()
  WHERE id = p_order_id
    AND dispatch_version = p_expected_order_version
    AND mise_batch_id IS NULL
    AND mise_driver_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '40001',
      MESSAGE = 'ORDER_COMPARE_AND_SET_CONFLICT';
  END IF;

  INSERT INTO public.dispatch_offer_assignments (
    order_id, batch_id, driver_id, state, decision_id, idempotency_key,
    request_fingerprint, expected_order_version, assignment_version,
    lease_expires_at, algorithm_version
  ) VALUES (
    p_order_id, v_batch_id, p_driver_id, 'offered', p_decision_id,
    p_idempotency_key, v_request_fingerprint, p_expected_order_version, 1,
    v_expires_at,
    p_algorithm_version
  ) RETURNING id INTO v_assignment_id;

  INSERT INTO public.dispatch_offer_audit (
    decision_id, idempotency_key, order_id, batch_id, driver_id, outcome,
    reason_code, expected_order_version, algorithm_version, details
  ) VALUES (
    p_decision_id, p_idempotency_key, p_order_id, v_batch_id, p_driver_id,
    'offered', 'ATOMIC_SINGLE_ORDER_OFFER', p_expected_order_version,
    p_algorithm_version,
    jsonb_build_object('offer_ttl_seconds', p_offer_ttl_seconds)
  );

  INSERT INTO public.mise_push_outbox (
    driver_id, type, title, body, sound, priority, data
  ) VALUES (
    p_driver_id, 'order_assigned', p_push_title, p_push_body,
    'default', 'high',
    jsonb_build_object(
      'order_id', p_order_id,
      'batch_id', v_batch_id,
      'driver_id', p_driver_id,
      'decision_id', p_decision_id,
      'assignment_id', v_assignment_id,
      'offer_id', v_assignment_id,
      'assignment_version', 1,
      'requires_acceptance', true,
      'offer_expires_at', v_expires_at
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent_replay', false,
    'assignment_id', v_assignment_id,
    'offer_id', v_assignment_id,
    'assignment_version', 1,
    'batch_id', v_batch_id,
    'state', 'offered',
    'lease_expires_at', v_expires_at,
    'order_version', p_expected_order_version + 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION fn_dispatch_transition_offer_v1(
  p_tenant_id uuid,
  p_offer_id uuid,
  p_expected_assignment_version bigint,
  p_action text,
  p_transition_key uuid,
  p_actor_driver_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_offer public.dispatch_offer_assignments%ROWTYPE;
  v_order_tenant_id uuid;
  v_effective_action text;
  v_expired_during_request boolean := false;
  v_request_fingerprint text;
  v_existing_request public.dispatch_offer_transition_requests%ROWTYPE;
  v_result jsonb;
BEGIN
  IF p_action NOT IN (
    'accept', 'decline', 'expire', 'picked_up', 'in_progress',
    'complete', 'cancel'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'INVALID_ACTION');
  END IF;
  IF p_transition_key IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'MISSING_TRANSITION_KEY');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_transition_key::text, 275)
  );
  v_request_fingerprint := md5(pg_catalog.concat_ws('|',
    p_tenant_id::text, p_offer_id::text,
    p_expected_assignment_version::text, p_action,
    coalesce(p_actor_driver_id::text, '')
  ));
  SELECT * INTO v_existing_request
  FROM public.dispatch_offer_transition_requests
  WHERE transition_key = p_transition_key;
  IF FOUND THEN
    IF v_existing_request.request_fingerprint <> v_request_fingerprint THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason_code', 'TRANSITION_KEY_REUSED_WITH_DIFFERENT_REQUEST'
      );
    END IF;
    RETURN v_existing_request.result || jsonb_build_object('idempotent_replay', true);
  END IF;

  SELECT * INTO v_offer
  FROM public.dispatch_offer_assignments
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'OFFER_NOT_FOUND');
  END IF;

  SELECT l.tenant_id INTO v_order_tenant_id
  FROM public.customer_orders o
  JOIN public.locations l ON l.id = o.location_id
  WHERE o.id = v_offer.order_id;

  IF v_order_tenant_id IS NULL OR v_order_tenant_id <> p_tenant_id THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'TENANT_OFFER_MISMATCH');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text, 27401)
  );
  IF public.fn_dispatch_writer_for_tenant_v1(p_tenant_id)
     IS DISTINCT FROM 'atomic_v1' THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'SINGLE_WRITER_GATE_CLOSED');
  END IF;

  IF v_offer.assignment_version <> p_expected_assignment_version THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason_code', 'ASSIGNMENT_VERSION_CONFLICT',
      'current_assignment_version', v_offer.assignment_version,
      'state', v_offer.state
    );
  END IF;
  IF p_action IN ('accept', 'decline', 'picked_up', 'in_progress', 'complete', 'cancel')
     AND p_actor_driver_id IS DISTINCT FROM v_offer.driver_id THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ACTOR_DRIVER_MISMATCH');
  END IF;

  v_effective_action := p_action;
  IF v_offer.state = 'offered'
     AND v_offer.lease_expires_at <= clock_timestamp() THEN
    v_effective_action := 'expire';
    v_expired_during_request := p_action <> 'expire';
  END IF;

  IF v_effective_action = 'accept' THEN
    IF v_offer.state <> 'offered' THEN
      RETURN jsonb_build_object('ok', false, 'reason_code', 'INVALID_STATE_TRANSITION');
    END IF;
    UPDATE public.dispatch_offer_assignments
    SET state = 'accepted',
        assignment_version = assignment_version + 1,
        updated_at = now()
    WHERE id = v_offer.id
      AND state = 'offered'
      AND assignment_version = p_expected_assignment_version;

    UPDATE public.mise_delivery_batches
    SET state = 'assigned', accepted_at = now(), updated_at = now()
    WHERE id = v_offer.batch_id AND state = 'pending_acceptance';
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001',
        MESSAGE = 'BATCH_ACCEPT_COMPARE_AND_SET_CONFLICT';
    END IF;

    UPDATE public.mise_drivers
    SET state = 'assigned', updated_at = now()
    WHERE id = v_offer.driver_id AND state IN ('idle', 'returning');
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001',
        MESSAGE = 'DRIVER_ACCEPT_COMPARE_AND_SET_CONFLICT';
    END IF;
  ELSIF v_effective_action IN ('decline', 'expire', 'cancel') THEN
    IF (v_effective_action IN ('decline', 'expire') AND v_offer.state <> 'offered')
       OR (v_effective_action = 'cancel'
           AND v_offer.state NOT IN ('offered', 'accepted')) THEN
      RETURN jsonb_build_object('ok', false, 'reason_code', 'INVALID_STATE_TRANSITION');
    END IF;
    UPDATE public.dispatch_offer_assignments
    SET state = CASE WHEN v_effective_action = 'decline' THEN 'declined'
                     WHEN v_effective_action = 'expire' THEN 'expired'
                     ELSE 'cancelled' END,
        assignment_version = assignment_version + 1,
        updated_at = now()
    WHERE id = v_offer.id
      AND state = v_offer.state
      AND assignment_version = p_expected_assignment_version;

    UPDATE public.mise_delivery_batches
    SET state = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE id = v_offer.batch_id
      AND state = CASE WHEN v_offer.state = 'offered'
                       THEN 'pending_acceptance' ELSE 'assigned' END;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001',
        MESSAGE = 'BATCH_RELEASE_COMPARE_AND_SET_CONFLICT';
    END IF;

    UPDATE public.customer_orders
    SET mise_batch_id = NULL,
        mise_driver_id = NULL,
        dispatch_version = dispatch_version + 1,
        updated_at = now()
    WHERE id = v_offer.order_id
      AND mise_batch_id = v_offer.batch_id
      AND mise_driver_id = v_offer.driver_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001',
        MESSAGE = 'ORDER_RELEASE_COMPARE_AND_SET_CONFLICT';
    END IF;
    UPDATE public.mise_drivers
    SET state = 'idle', updated_at = now()
    WHERE id = v_offer.driver_id
      AND v_offer.state = 'accepted'
      AND state = 'assigned';
  ELSIF v_effective_action = 'picked_up' THEN
    IF v_offer.state <> 'accepted' THEN
      RETURN jsonb_build_object('ok', false, 'reason_code', 'INVALID_STATE_TRANSITION');
    END IF;
    UPDATE public.dispatch_offer_assignments
    SET state = 'picked_up', assignment_version = assignment_version + 1,
        updated_at = now()
    WHERE id = v_offer.id AND state = 'accepted'
      AND assignment_version = p_expected_assignment_version;
    UPDATE public.mise_delivery_batches
    SET state = 'picked_up', picked_up_at = now(), updated_at = now()
    WHERE id = v_offer.batch_id AND state IN ('assigned', 'at_restaurant');
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001',
        MESSAGE = 'BATCH_PICKUP_COMPARE_AND_SET_CONFLICT';
    END IF;
  ELSIF v_effective_action = 'in_progress' THEN
    IF v_offer.state <> 'picked_up' THEN
      RETURN jsonb_build_object('ok', false, 'reason_code', 'INVALID_STATE_TRANSITION');
    END IF;
    UPDATE public.dispatch_offer_assignments
    SET state = 'in_progress', assignment_version = assignment_version + 1,
        updated_at = now()
    WHERE id = v_offer.id AND state = 'picked_up'
      AND assignment_version = p_expected_assignment_version;
    UPDATE public.mise_delivery_batches
    SET state = 'in_progress', updated_at = now()
    WHERE id = v_offer.batch_id AND state = 'picked_up';
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001',
        MESSAGE = 'BATCH_PROGRESS_COMPARE_AND_SET_CONFLICT';
    END IF;
  ELSIF v_effective_action = 'complete' THEN
    IF v_offer.state <> 'in_progress' THEN
      RETURN jsonb_build_object('ok', false, 'reason_code', 'INVALID_STATE_TRANSITION');
    END IF;
    UPDATE public.dispatch_offer_assignments
    SET state = 'completed', assignment_version = assignment_version + 1,
        updated_at = now()
    WHERE id = v_offer.id AND state = 'in_progress'
      AND assignment_version = p_expected_assignment_version;
    UPDATE public.mise_delivery_batches
    SET state = 'completed', completed_at = now(), updated_at = now()
    WHERE id = v_offer.batch_id AND state = 'in_progress';
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001',
        MESSAGE = 'BATCH_COMPLETE_COMPARE_AND_SET_CONFLICT';
    END IF;
    UPDATE public.customer_orders
    SET status = 'geliefert', geliefert_am = now(),
        dispatch_version = dispatch_version + 1, updated_at = now()
    WHERE id = v_offer.order_id
      AND mise_batch_id = v_offer.batch_id
      AND mise_driver_id = v_offer.driver_id
      AND status::text <> 'geliefert';
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001',
        MESSAGE = 'ORDER_COMPLETE_COMPARE_AND_SET_CONFLICT';
    END IF;
    UPDATE public.mise_drivers
    SET state = 'returning', updated_at = now()
    WHERE id = v_offer.driver_id AND state = 'assigned';
  END IF;

  INSERT INTO public.dispatch_offer_audit (
    decision_id, idempotency_key, order_id, batch_id, driver_id, outcome,
    reason_code, expected_order_version, algorithm_version, details
  ) VALUES (
    gen_random_uuid(), gen_random_uuid(), v_offer.order_id, v_offer.batch_id,
    v_offer.driver_id,
    CASE WHEN v_effective_action = 'accept' THEN 'accepted'
         WHEN v_effective_action = 'decline' THEN 'declined'
         WHEN v_effective_action = 'expire' THEN 'expired'
         WHEN v_effective_action = 'complete' THEN 'completed'
         ELSE 'offered' END,
    'OFFER_' || upper(v_effective_action),
    v_offer.expected_order_version, v_offer.algorithm_version,
    jsonb_build_object(
      'offer_id', v_offer.id,
      'from_assignment_version', p_expected_assignment_version,
      'to_assignment_version', p_expected_assignment_version + 1
    )
  );

  IF v_expired_during_request THEN
    v_result := jsonb_build_object(
      'ok', false,
      'reason_code', 'OFFER_EXPIRED',
      'offer_id', v_offer.id,
      'assignment_version', p_expected_assignment_version + 1,
      'state', 'expired'
    );
  ELSE
    v_result := jsonb_build_object(
      'ok', true,
      'idempotent_replay', false,
      'offer_id', v_offer.id,
      'assignment_version', p_expected_assignment_version + 1,
      'state', CASE WHEN v_effective_action = 'accept' THEN 'accepted'
                    WHEN v_effective_action = 'decline' THEN 'declined'
                    WHEN v_effective_action = 'expire' THEN 'expired'
                    WHEN v_effective_action = 'picked_up' THEN 'picked_up'
                    WHEN v_effective_action = 'in_progress' THEN 'in_progress'
                    WHEN v_effective_action = 'complete' THEN 'completed'
                    ELSE 'cancelled' END
    );
  END IF;

  INSERT INTO public.dispatch_offer_transition_requests (
    transition_key, request_fingerprint, offer_id, action, result
  ) VALUES (
    p_transition_key, v_request_fingerprint, v_offer.id, p_action, v_result
  );
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION fn_dispatch_expire_offers_v1(
  p_limit integer DEFAULT 100
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_row record;
  v_result jsonb;
  v_count integer := 0;
BEGIN
  IF p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'INVALID_EXPIRY_LIMIT';
  END IF;

  FOR v_row IN
    SELECT a.id, a.assignment_version, l.tenant_id
    FROM public.dispatch_offer_assignments a
    JOIN public.customer_orders o ON o.id = a.order_id
    JOIN public.locations l ON l.id = o.location_id
    JOIN public.dispatch_writer_gates g
      ON g.tenant_id = l.tenant_id
     AND g.writer = 'atomic_v1'
     AND g.enabled = true
    WHERE a.state = 'offered'
      AND a.lease_expires_at <= clock_timestamp()
    ORDER BY a.lease_expires_at
    LIMIT p_limit
    FOR UPDATE OF a SKIP LOCKED
  LOOP
    v_result := public.fn_dispatch_transition_offer_v1(
      v_row.tenant_id, v_row.id, v_row.assignment_version, 'expire',
      gen_random_uuid(), NULL
    );
    IF coalesce((v_result->>'ok')::boolean, false) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION fn_dispatch_ack_offer_v1(
  p_tenant_id uuid,
  p_offer_id uuid,
  p_driver_id uuid,
  p_assignment_version bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_offer public.dispatch_offer_assignments%ROWTYPE;
  v_tenant_id uuid;
BEGIN
  SELECT * INTO v_offer
  FROM public.dispatch_offer_assignments
  WHERE id = p_offer_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'OFFER_NOT_FOUND');
  END IF;
  SELECT l.tenant_id INTO v_tenant_id
  FROM public.customer_orders o
  JOIN public.locations l ON l.id = o.location_id
  WHERE o.id = v_offer.order_id;
  IF v_tenant_id IS DISTINCT FROM p_tenant_id
     OR v_offer.driver_id IS DISTINCT FROM p_driver_id THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'OFFER_ACK_FORBIDDEN');
  END IF;
  IF v_offer.assignment_version <> p_assignment_version THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason_code', 'ASSIGNMENT_VERSION_CONFLICT',
      'current_assignment_version', v_offer.assignment_version
    );
  END IF;
  IF v_offer.state <> 'offered' THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'OFFER_NOT_ACTIVE');
  END IF;
  UPDATE public.dispatch_offer_assignments
  SET received_by_app_at = coalesce(received_by_app_at, now()),
      updated_at = now()
  WHERE id = v_offer.id;
  RETURN jsonb_build_object(
    'ok', true, 'offer_id', v_offer.id,
    'assignment_version', v_offer.assignment_version,
    'received_by_app', true
  );
END;
$$;

REVOKE ALL ON FUNCTION fn_dispatch_create_offer_v1(
  uuid, uuid, uuid, bigint, uuid, uuid, text, integer,
  numeric, numeric, text, numeric, numeric, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION fn_dispatch_create_offer_v1(
  uuid, uuid, uuid, bigint, uuid, uuid, text, integer,
  numeric, numeric, text, numeric, numeric, text, text, text
) TO service_role;

REVOKE ALL ON FUNCTION fn_dispatch_transition_offer_v1(
  uuid, uuid, bigint, text, uuid, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_dispatch_transition_offer_v1(
  uuid, uuid, bigint, text, uuid, uuid
) TO service_role;

REVOKE ALL ON FUNCTION fn_dispatch_expire_offers_v1(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_dispatch_expire_offers_v1(integer)
  TO service_role;

REVOKE ALL ON FUNCTION fn_dispatch_ack_offer_v1(uuid, uuid, uuid, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_dispatch_ack_offer_v1(uuid, uuid, uuid, bigint)
  TO service_role;

REVOKE ALL ON FUNCTION fn_dispatch_writer_for_tenant_v1(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_dispatch_writer_for_tenant_v1(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION fn_dispatch_writer_allows_location_v1(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_dispatch_writer_allows_location_v1(uuid, text)
  TO service_role;

REVOKE ALL ON FUNCTION fn_dispatch_set_writer_v1(uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_dispatch_set_writer_v1(uuid, text, boolean)
  TO service_role;

COMMENT ON FUNCTION fn_dispatch_create_offer_v1(
  uuid, uuid, uuid, bigint, uuid, uuid, text, integer,
  numeric, numeric, text, numeric, numeric, text, text, text
) IS
  'Atomarer, idempotenter Single-Order-Offer. Erst via P0_ATOMIC_OFFER_ENABLED aktivieren.';
