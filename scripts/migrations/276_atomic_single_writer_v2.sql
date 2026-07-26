-- T02 / Atomic-v2: one elected tenant writer and one transaction for
-- trip, stops, orders, driver load, assignments, audit, outbox and deadlines.
-- Applying this migration does not activate a tenant. Existing atomic_v1 gates
-- are converted to atomic_v2 in the disabled state and must be elected again.

ALTER TABLE public.dispatch_writer_gates
  DROP CONSTRAINT IF EXISTS dispatch_writer_gates_writer_check,
  DROP CONSTRAINT IF EXISTS dispatch_writer_gate_identity_check;

UPDATE public.dispatch_writer_gates
SET writer = 'atomic_v2',
    enabled = false,
    updated_at = now()
WHERE writer = 'atomic_v1';

ALTER TABLE public.dispatch_writer_gates
  ADD COLUMN IF NOT EXISTS active_writer_id uuid,
  ADD COLUMN IF NOT EXISTS writer_epoch bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS pre_pickup_reassignment_enabled boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT dispatch_writer_gates_writer_check
    CHECK (writer IN ('legacy_db', 'frank_db', 'frank_js', 'atomic_v2')),
  ADD CONSTRAINT dispatch_writer_gate_identity_check CHECK (
    (active_writer_id IS NULL AND lease_expires_at IS NULL)
    OR (enabled AND writer = 'atomic_v2'
      AND active_writer_id IS NOT NULL AND lease_expires_at IS NOT NULL)
  );

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS assignment_deadline_at timestamptz;

ALTER TABLE public.customer_orders
  DROP CONSTRAINT IF EXISTS customer_orders_v2_claim_pair_check;
ALTER TABLE public.customer_orders
  ADD CONSTRAINT customer_orders_v2_claim_pair_check CHECK (
    (mise_batch_id IS NULL) = (mise_driver_id IS NULL)
  ) NOT VALID;
ALTER TABLE public.customer_orders
  VALIDATE CONSTRAINT customer_orders_v2_claim_pair_check;

-- The audited full schema exposes customer_orders.status as an enum while the
-- isolated fixture uses text. Add only the three canonical values written by
-- T02 and leave all legacy labels available for compatibility reads.
DO $enum$
DECLARE
  v_status_type regtype;
  v_label text;
BEGIN
  SELECT a.atttypid::regtype INTO v_status_type
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = 'public.customer_orders'::regclass
    AND a.attname = 'status' AND NOT a.attisdropped;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_type t
    WHERE t.oid = v_status_type::oid AND t.typtype = 'e'
  ) THEN
    FOREACH v_label IN ARRAY ARRAY[
      'assigned', 'picked_up', 'out_for_delivery', 'cancelled', 'delivered'
    ]
    LOOP
      EXECUTE format(
        'ALTER TYPE %s ADD VALUE IF NOT EXISTS %L',
        v_status_type, v_label
      );
    END LOOP;
  END IF;
END
$enum$;

ALTER TABLE public.mise_drivers
  ADD COLUMN IF NOT EXISTS state_version bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_capacity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_capacity integer NOT NULL DEFAULT 4;
ALTER TABLE public.mise_drivers
  DROP CONSTRAINT IF EXISTS mise_drivers_v2_capacity_check;
ALTER TABLE public.mise_drivers
  ADD CONSTRAINT mise_drivers_v2_capacity_check CHECK (
    current_capacity >= 0 AND max_capacity >= 0
    AND current_capacity <= max_capacity
  ) NOT VALID;
ALTER TABLE public.mise_drivers
  VALIDATE CONSTRAINT mise_drivers_v2_capacity_check;

ALTER TABLE public.mise_delivery_batches
  ADD COLUMN IF NOT EXISTS state_version bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_deadline_at timestamptz;

ALTER TABLE public.mise_delivery_batch_stops
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS stop_version bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.mise_delivery_batch_stops
  DROP CONSTRAINT IF EXISTS mise_delivery_batch_stops_v2_state_check;
ALTER TABLE public.mise_delivery_batch_stops
  ADD CONSTRAINT mise_delivery_batch_stops_v2_state_check
    CHECK (state IN ('pending', 'arrived', 'servicing', 'completed', 'cancelled'));

ALTER TABLE public.dispatch_offer_assignments
  DROP CONSTRAINT IF EXISTS dispatch_offer_assignments_state_check;
ALTER TABLE public.dispatch_offer_assignments
  ALTER COLUMN lease_expires_at DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id),
  ADD COLUMN IF NOT EXISTS action_id uuid,
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS pickup_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_deadline_at timestamptz,
  ADD CONSTRAINT dispatch_offer_assignments_state_check CHECK (
    state IN (
      'offered', 'accepted', 'expired', 'declined',
      'assigned', 'picked_up', 'in_progress', 'completed',
      'cancelled', 'reassigned'
    )
  );

UPDATE public.dispatch_offer_assignments a
SET tenant_id = l.tenant_id
FROM public.customer_orders o
JOIN public.locations l ON l.id = o.location_id
WHERE o.id = a.order_id
  AND a.tenant_id IS NULL;

ALTER TABLE public.dispatch_offer_assignments
  ALTER COLUMN tenant_id SET NOT NULL;

DROP INDEX IF EXISTS public.uq_dispatch_offer_active_order;
CREATE UNIQUE INDEX uq_dispatch_offer_active_order
  ON public.dispatch_offer_assignments (order_id)
  WHERE state IN ('offered', 'accepted', 'assigned', 'picked_up', 'in_progress');

-- Atomic-v1 reserved a whole driver for one order. Atomic-v2 permits multiple
-- assignments on one trip and protects capacity with the locked driver row.
DROP INDEX IF EXISTS public.uq_dispatch_offer_active_driver;

ALTER TABLE public.dispatch_offer_audit
  DROP CONSTRAINT IF EXISTS dispatch_offer_audit_outcome_check;
ALTER TABLE public.dispatch_offer_audit
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD CONSTRAINT dispatch_offer_audit_outcome_check CHECK (
    outcome IN (
      'offered', 'accepted', 'declined', 'expired', 'assigned',
      'cancelled', 'reassigned', 'completed', 'conflict', 'rejected'
    )
  );

CREATE TABLE IF NOT EXISTS public.dispatch_assignment_requests_v2 (
  action_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  request_fingerprint text NOT NULL,
  action text NOT NULL,
  correlation_id uuid NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatch_assignment_requests_v2 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dispatch_assignment_requests_v2_service_role
  ON public.dispatch_assignment_requests_v2;
CREATE POLICY dispatch_assignment_requests_v2_service_role
  ON public.dispatch_assignment_requests_v2
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.fn_dispatch_writer_for_tenant_v2(
  p_tenant_id uuid
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT g.writer
  FROM public.dispatch_writer_gates g
  WHERE g.tenant_id = p_tenant_id AND g.enabled
$$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_set_writer_v2(
  p_tenant_id uuid,
  p_writer text,
  p_enabled boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_previous public.dispatch_writer_gates%ROWTYPE;
BEGIN
  IF p_writer NOT IN ('legacy_db', 'frank_db', 'frank_js', 'atomic_v2') THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'INVALID_DISPATCH_WRITER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'DISPATCH_TENANT_NOT_FOUND');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text, 27601)
  );
  SELECT * INTO v_previous
  FROM public.dispatch_writer_gates
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  IF p_enabled AND p_writer = 'atomic_v2' AND EXISTS (
    SELECT 1
    FROM public.dispatch_offer_assignments a
    JOIN public.customer_orders o ON o.id = a.order_id
    JOIN public.locations l ON l.id = o.location_id
    WHERE l.tenant_id = p_tenant_id
      AND a.state IN ('offered', 'accepted')
  ) THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason_code', 'LEGACY_ATOMIC_OFFERS_MUST_DRAIN'
    );
  END IF;

  INSERT INTO public.dispatch_writer_gates (
    tenant_id, writer, enabled, active_writer_id, writer_epoch,
    lease_expires_at, updated_at
  ) VALUES (
    p_tenant_id, p_writer, p_enabled, NULL,
    coalesce(v_previous.writer_epoch, 0), NULL, now()
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    writer = EXCLUDED.writer,
    enabled = EXCLUDED.enabled,
    active_writer_id = NULL,
    lease_expires_at = NULL,
    pre_pickup_reassignment_enabled = false,
    updated_at = now();

  RETURN jsonb_build_object(
    'ok', true, 'tenant_id', p_tenant_id, 'writer', p_writer,
    'enabled', p_enabled, 'previous_writer', v_previous.writer,
    'previous_enabled', coalesce(v_previous.enabled, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_claim_writer_v2(
  p_tenant_id uuid,
  p_writer_id uuid,
  p_lease_seconds integer DEFAULT 30
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_gate public.dispatch_writer_gates%ROWTYPE;
  v_epoch bigint;
  v_expires timestamptz;
BEGIN
  IF p_writer_id IS NULL OR p_lease_seconds < 5 OR p_lease_seconds > 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'INVALID_WRITER_LEASE');
  END IF;
  IF coalesce(current_setting('t02.race_barrier',true),'')<>'' AND
     pg_catalog.to_regprocedure('public.fn_t02_race_barrier(text)') IS NOT NULL THEN
    EXECUTE 'SELECT public.fn_t02_race_barrier($1)'
    USING current_setting('t02.race_barrier',true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text, 27601)
  );
  SELECT * INTO v_gate
  FROM public.dispatch_writer_gates
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND OR NOT v_gate.enabled OR v_gate.writer <> 'atomic_v2' THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'SINGLE_WRITER_GATE_CLOSED');
  END IF;
  IF v_gate.active_writer_id IS NOT NULL
     AND v_gate.active_writer_id <> p_writer_id
     AND v_gate.lease_expires_at > clock_timestamp() THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason_code', 'TENANT_WRITER_ALREADY_ACTIVE',
      'writer_epoch', v_gate.writer_epoch
    );
  END IF;
  v_epoch := CASE
    WHEN v_gate.active_writer_id = p_writer_id THEN v_gate.writer_epoch
    ELSE v_gate.writer_epoch + 1
  END;
  v_expires := clock_timestamp() + make_interval(secs => p_lease_seconds);
  UPDATE public.dispatch_writer_gates
  SET active_writer_id = p_writer_id,
      writer_epoch = v_epoch,
      lease_expires_at = v_expires,
      updated_at = now()
  WHERE tenant_id = p_tenant_id;
  RETURN jsonb_build_object(
    'ok', true, 'tenant_id', p_tenant_id, 'writer_id', p_writer_id,
    'writer_epoch', v_epoch, 'lease_expires_at', v_expires
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_assign_orders_v2(
  p_tenant_id uuid,
  p_writer_id uuid,
  p_writer_epoch bigint,
  p_driver_id uuid,
  p_expected_driver_version bigint,
  p_action_id uuid,
  p_algorithm_version text,
  p_orders jsonb,
  p_push_title text,
  p_push_body text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_existing public.dispatch_assignment_requests_v2%ROWTYPE;
  v_gate public.dispatch_writer_gates%ROWTYPE;
  v_driver public.mise_drivers%ROWTYPE;
  v_order public.customer_orders%ROWTYPE;
  v_item jsonb;
  v_order_ids uuid[];
  v_order_count integer;
  v_seen_orders integer := 0;
  v_location_id uuid;
  v_batch_id uuid;
  v_assignment_ids uuid[] := ARRAY[]::uuid[];
  v_assignment_id uuid;
  v_pickup_deadline timestamptz;
  v_delivery_deadline timestamptz;
  v_fingerprint text;
  v_correlation_id uuid := gen_random_uuid();
  v_result jsonb;
BEGIN
  IF p_action_id IS NULL OR p_writer_id IS NULL
     OR p_algorithm_version IS NULL OR btrim(p_algorithm_version) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'MISSING_MUTATION_ENVELOPE');
  END IF;
  IF jsonb_typeof(p_orders) <> 'array'
     OR jsonb_array_length(p_orders) < 1
     OR jsonb_array_length(p_orders) > 4 THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'INVALID_ORDER_SET');
  END IF;
  v_fingerprint := md5(pg_catalog.concat_ws(
    '|', p_tenant_id::text, p_writer_id::text, p_writer_epoch::text,
    p_driver_id::text, p_expected_driver_version::text,
    p_algorithm_version, p_orders::text,
    coalesce(p_push_title, ''), coalesce(p_push_body, '')
  ));
  IF coalesce(current_setting('t02.race_barrier',true),'')<>'' AND
     pg_catalog.to_regprocedure('public.fn_t02_race_barrier(text)') IS NOT NULL THEN
    EXECUTE 'SELECT public.fn_t02_race_barrier($1)'
    USING current_setting('t02.race_barrier',true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_action_id::text, 27602)
  );
  SELECT * INTO v_existing
  FROM public.dispatch_assignment_requests_v2
  WHERE action_id = p_action_id;
  IF FOUND THEN
    IF v_existing.request_fingerprint <> v_fingerprint THEN
      RETURN jsonb_build_object(
        'ok', false, 'reason_code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',
        'correlation_id', v_existing.correlation_id
      );
    END IF;
    RETURN v_existing.result || jsonb_build_object('idempotent_replay', true);
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text, 27601)
  );
  SELECT * INTO v_gate
  FROM public.dispatch_writer_gates
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND OR NOT v_gate.enabled OR v_gate.writer <> 'atomic_v2'
     OR v_gate.active_writer_id IS DISTINCT FROM p_writer_id
     OR v_gate.writer_epoch <> p_writer_epoch
     OR v_gate.lease_expires_at <= clock_timestamp() THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason_code', 'WRITER_LEASE_STALE_OR_NOT_OWNER',
      'correlation_id', v_correlation_id
    );
  END IF;

  SELECT * INTO v_driver
  FROM public.mise_drivers
  WHERE id = p_driver_id
  FOR UPDATE;
  IF NOT FOUND OR NOT v_driver.active
     OR v_driver.state NOT IN ('idle', 'returning', 'available') THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'DRIVER_NOT_ELIGIBLE',
      'correlation_id', v_correlation_id);
  END IF;
  IF v_driver.state_version <> p_expected_driver_version THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason_code', 'DRIVER_VERSION_CONFLICT',
      'current_driver_version', v_driver.state_version,
      'correlation_id', v_correlation_id
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.mise_driver_tenants
    WHERE driver_id = p_driver_id AND tenant_id = p_tenant_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'TENANT_DRIVER_MISMATCH',
      'correlation_id', v_correlation_id);
  END IF;
  v_order_count := jsonb_array_length(p_orders);
  IF v_driver.current_capacity + v_order_count > v_driver.max_capacity THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'DRIVER_CAPACITY_EXCEEDED',
      'correlation_id', v_correlation_id);
  END IF;
  SELECT array_agg((item->>'order_id')::uuid ORDER BY (item->>'order_id')::uuid)
  INTO v_order_ids
  FROM jsonb_array_elements(p_orders) item;
  IF cardinality(v_order_ids) <> (
    SELECT count(DISTINCT id) FROM unnest(v_order_ids) id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'DUPLICATE_ORDER_ID',
      'correlation_id', v_correlation_id);
  END IF;

  FOR v_order IN
    SELECT o.*
    FROM public.customer_orders o
    WHERE o.id = ANY(v_order_ids)
    ORDER BY o.id
    FOR UPDATE
  LOOP
    v_seen_orders := v_seen_orders + 1;
    SELECT item INTO v_item
    FROM jsonb_array_elements(p_orders) item
    WHERE (item->>'order_id')::uuid = v_order.id;
    IF v_order.typ::text <> 'lieferung'
       OR v_order.status::text NOT IN ('fertig', 'ready')
       OR v_order.mise_batch_id IS NOT NULL OR v_order.mise_driver_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason_code', 'ORDER_NOT_ASSIGNABLE',
        'order_id', v_order.id, 'correlation_id', v_correlation_id);
    END IF;
    IF v_order.dispatch_version <> (v_item->>'expected_order_version')::bigint THEN
      RETURN jsonb_build_object(
        'ok', false, 'reason_code', 'ORDER_VERSION_CONFLICT',
        'order_id', v_order.id, 'current_order_version', v_order.dispatch_version,
        'correlation_id', v_correlation_id
      );
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.locations l
      WHERE l.id = v_order.location_id AND l.tenant_id = p_tenant_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason_code', 'TENANT_ORDER_MISMATCH',
        'order_id', v_order.id, 'correlation_id', v_correlation_id);
    END IF;
    IF v_location_id IS NULL THEN
      v_location_id := v_order.location_id;
    ELSIF v_order.location_id IS DISTINCT FROM v_location_id THEN
      RETURN jsonb_build_object('ok', false, 'reason_code', 'MULTI_LOCATION_TRIP_NOT_SUPPORTED',
        'order_id', v_order.id, 'correlation_id', v_correlation_id);
    END IF;
    IF (v_item->>'pickup_lat') IS NULL OR (v_item->>'pickup_lng') IS NULL
       OR (v_item->>'dropoff_lat') IS NULL OR (v_item->>'dropoff_lng') IS NULL
       OR (v_item->>'pickup_deadline_at') IS NULL
       OR (v_item->>'delivery_deadline_at') IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason_code', 'ORDER_ROUTE_OR_DEADLINE_MISSING',
        'order_id', v_order.id, 'correlation_id', v_correlation_id);
    END IF;
    IF (v_item->>'pickup_lat') !~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$'
       OR (v_item->>'pickup_lng') !~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$'
       OR (v_item->>'dropoff_lat') !~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$'
       OR (v_item->>'dropoff_lng') !~ '^-?([0-9]+([.][0-9]+)?|[.][0-9]+)$'
       OR (v_item->>'pickup_lat')::numeric NOT BETWEEN -90 AND 90
       OR (v_item->>'dropoff_lat')::numeric NOT BETWEEN -90 AND 90
       OR (v_item->>'pickup_lng')::numeric NOT BETWEEN -180 AND 180
       OR (v_item->>'dropoff_lng')::numeric NOT BETWEEN -180 AND 180 THEN
      RETURN jsonb_build_object('ok', false, 'reason_code', 'INVALID_ROUTE_COORDINATES',
        'order_id', v_order.id, 'correlation_id', v_correlation_id);
    END IF;
    IF (v_item->>'pickup_deadline_at')::timestamptz <= clock_timestamp()
       OR (v_item->>'delivery_deadline_at')::timestamptz
          <= (v_item->>'pickup_deadline_at')::timestamptz THEN
      RETURN jsonb_build_object('ok', false, 'reason_code', 'INVALID_DEADLINE_ORDER',
        'order_id', v_order.id, 'correlation_id', v_correlation_id);
    END IF;
  END LOOP;
  IF v_seen_orders <> v_order_count THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ORDER_NOT_FOUND',
      'correlation_id', v_correlation_id);
  END IF;

  SELECT min((item->>'pickup_deadline_at')::timestamptz),
         min((item->>'delivery_deadline_at')::timestamptz)
  INTO v_pickup_deadline, v_delivery_deadline
  FROM jsonb_array_elements(p_orders) item;

  INSERT INTO public.mise_delivery_batches (
    driver_id, state, location_id, route_version, state_version,
    pickup_deadline_at, delivery_deadline_at, updated_at
  )
  SELECT p_driver_id, 'assigned', v_location_id, 1, 1,
         v_pickup_deadline, v_delivery_deadline, now()
  RETURNING id INTO v_batch_id;

  INSERT INTO public.mise_delivery_batch_stops (
    batch_id, order_id, type, sequence, lat, lng, address, state, stop_version
  )
  SELECT v_batch_id, (item->>'order_id')::uuid, stop.kind,
         ((ord - 1) * 2 + stop.sequence_offset)::integer,
         CASE stop.kind WHEN 'pickup' THEN (item->>'pickup_lat')::numeric
                        ELSE (item->>'dropoff_lat')::numeric END,
         CASE stop.kind WHEN 'pickup' THEN (item->>'pickup_lng')::numeric
                        ELSE (item->>'dropoff_lng')::numeric END,
         CASE stop.kind WHEN 'pickup' THEN item->>'pickup_address'
                        ELSE item->>'dropoff_address' END,
         'pending', 0
  FROM jsonb_array_elements(p_orders) WITH ORDINALITY AS items(item, ord)
  CROSS JOIN (VALUES ('pickup', 0), ('dropoff', 1))
    AS stop(kind, sequence_offset);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_orders)
  LOOP
    UPDATE public.customer_orders
    SET mise_batch_id = v_batch_id,
        mise_driver_id = p_driver_id,
        status = 'assigned',
        dispatch_version = dispatch_version + 1,
        assignment_deadline_at = (v_item->>'delivery_deadline_at')::timestamptz,
        updated_at = now()
    WHERE id = (v_item->>'order_id')::uuid
      AND dispatch_version = (v_item->>'expected_order_version')::bigint
      AND mise_batch_id IS NULL AND mise_driver_id IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'ORDER_COMPARE_AND_SET_CONFLICT';
    END IF;
  END LOOP;

  UPDATE public.mise_drivers
  SET state = 'assigned',
      current_capacity = current_capacity + v_order_count,
      state_version = state_version + 1,
      updated_at = now()
  WHERE id = p_driver_id AND state_version = p_expected_driver_version
    AND state IN ('idle', 'returning', 'available')
    AND current_capacity + v_order_count <= max_capacity;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'DRIVER_COMPARE_AND_SET_CONFLICT';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_orders)
  LOOP
    INSERT INTO public.dispatch_offer_assignments (
      tenant_id, order_id, batch_id, driver_id, state, decision_id,
      idempotency_key, action_id, request_fingerprint,
      expected_order_version, assignment_version, lease_expires_at,
      pickup_deadline_at, delivery_deadline_at, algorithm_version,
      correlation_id
    ) VALUES (
      p_tenant_id, (v_item->>'order_id')::uuid, v_batch_id, p_driver_id,
      'assigned', p_action_id, gen_random_uuid(), p_action_id, v_fingerprint,
      (v_item->>'expected_order_version')::bigint, 1, NULL,
      (v_item->>'pickup_deadline_at')::timestamptz,
      (v_item->>'delivery_deadline_at')::timestamptz,
      p_algorithm_version, v_correlation_id
    ) RETURNING id INTO v_assignment_id;
    v_assignment_ids := array_append(v_assignment_ids, v_assignment_id);
  END LOOP;

  INSERT INTO public.dispatch_offer_audit (
    decision_id, idempotency_key, order_id, batch_id, driver_id, outcome,
    reason_code, expected_order_version, algorithm_version, details,
    correlation_id, event_type
  )
  SELECT gen_random_uuid(), gen_random_uuid(), (item->>'order_id')::uuid,
         v_batch_id, p_driver_id, 'assigned', 'ATOMIC_V2_ASSIGNMENT',
         (item->>'expected_order_version')::bigint, p_algorithm_version,
         jsonb_build_object('writer_id', p_writer_id, 'writer_epoch', p_writer_epoch),
         v_correlation_id, 'assignment.created'
  FROM jsonb_array_elements(p_orders) item;

  INSERT INTO public.mise_push_outbox (
    driver_id, type, title, body, sound, priority, data
  ) VALUES (
    p_driver_id, 'order_assigned', p_push_title, p_push_body,
    'default', 'high',
    jsonb_build_object(
      'batch_id', v_batch_id, 'assignment_ids', to_jsonb(v_assignment_ids),
      'order_ids', to_jsonb(v_order_ids), 'correlation_id', v_correlation_id,
      'requires_acceptance', false, 'snapshot_version', 1,
      'delivery_deadline_at', v_delivery_deadline
    )
  );

  v_result := jsonb_build_object(
    'ok', true, 'idempotent_replay', false, 'state', 'assigned',
    'batch_id', v_batch_id, 'assignment_ids', to_jsonb(v_assignment_ids),
    'order_ids', to_jsonb(v_order_ids), 'driver_version',
    p_expected_driver_version + 1, 'correlation_id', v_correlation_id
  );
  INSERT INTO public.dispatch_assignment_requests_v2 (
    action_id, tenant_id, request_fingerprint, action, correlation_id, result
  ) VALUES (
    p_action_id, p_tenant_id, v_fingerprint, 'assign', v_correlation_id, v_result
  );
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_ack_assignment_v2(
  p_tenant_id uuid,
  p_assignment_id uuid,
  p_driver_id uuid,
  p_snapshot_version bigint,
  p_receipt_key uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_assignment public.dispatch_offer_assignments%ROWTYPE;
  v_fingerprint text;
  v_existing public.dispatch_assignment_requests_v2%ROWTYPE;
  v_result jsonb;
  v_correlation_id uuid := gen_random_uuid();
BEGIN
  v_fingerprint := md5(pg_catalog.concat_ws(
    '|', p_tenant_id::text, p_assignment_id::text, p_driver_id::text,
    p_snapshot_version::text, p_metadata::text
  ));
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_receipt_key::text, 27602)
  );
  SELECT * INTO v_existing FROM public.dispatch_assignment_requests_v2
  WHERE action_id = p_receipt_key;
  IF FOUND THEN
    IF v_existing.request_fingerprint <> v_fingerprint THEN
      RETURN jsonb_build_object('ok', false,
        'reason_code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
    END IF;
    RETURN v_existing.result || jsonb_build_object('idempotent_replay', true);
  END IF;
  SELECT * INTO v_assignment FROM public.dispatch_offer_assignments
  WHERE id = p_assignment_id FOR UPDATE;
  IF NOT FOUND OR v_assignment.tenant_id <> p_tenant_id
     OR v_assignment.driver_id <> p_driver_id THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ASSIGNMENT_ACK_FORBIDDEN');
  END IF;
  IF v_assignment.assignment_version <> p_snapshot_version THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ASSIGNMENT_VERSION_CONFLICT',
      'current_assignment_version', v_assignment.assignment_version);
  END IF;
  IF v_assignment.state NOT IN ('assigned', 'picked_up', 'in_progress') THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ASSIGNMENT_NOT_ACTIVE');
  END IF;
  UPDATE public.dispatch_offer_assignments
  SET received_by_app_at = coalesce(received_by_app_at, now()), updated_at = now()
  WHERE id = p_assignment_id;
  v_result := jsonb_build_object(
    'ok', true, 'assignment_id', p_assignment_id,
    'assignment_version', p_snapshot_version, 'state', v_assignment.state,
    'received_by_app', true, 'correlation_id', v_correlation_id
  );
  INSERT INTO public.dispatch_assignment_requests_v2
    (action_id, tenant_id, request_fingerprint, action, correlation_id, result)
  VALUES (p_receipt_key, p_tenant_id, v_fingerprint, 'ack_receipt',
          v_correlation_id, v_result);
  RETURN v_result;
END;
$$;

-- Cancellation serializes with assignment by the same tenant lock. It supports
-- a ready unassigned order and a canonical pre-pickup assigned order.
CREATE OR REPLACE FUNCTION public.fn_dispatch_cancel_order_v2(
  p_tenant_id uuid,
  p_order_id uuid,
  p_expected_order_version bigint,
  p_action_id uuid,
  p_reason_code text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_order public.customer_orders%ROWTYPE;
  v_assignment public.dispatch_offer_assignments%ROWTYPE;
  v_fingerprint text;
  v_correlation_id uuid := gen_random_uuid();
  v_result jsonb;
BEGIN
  v_fingerprint := md5(pg_catalog.concat_ws('|', p_tenant_id::text,
    p_order_id::text, p_expected_order_version::text, p_reason_code));
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_action_id::text, 27602)
  );
  IF EXISTS (SELECT 1 FROM public.dispatch_assignment_requests_v2
             WHERE action_id = p_action_id) THEN
    RETURN (SELECT CASE WHEN request_fingerprint = v_fingerprint
      THEN result || jsonb_build_object('idempotent_replay', true)
      ELSE jsonb_build_object('ok', false,
        'reason_code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST') END
      FROM public.dispatch_assignment_requests_v2 WHERE action_id = p_action_id);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text, 27601)
  );
  SELECT * INTO v_order FROM public.customer_orders
  WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.locations WHERE id = v_order.location_id
      AND tenant_id = p_tenant_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ORDER_NOT_FOUND');
  END IF;
  IF v_order.dispatch_version <> p_expected_order_version THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ORDER_VERSION_CONFLICT',
      'current_order_version', v_order.dispatch_version);
  END IF;
  SELECT * INTO v_assignment FROM public.dispatch_offer_assignments
  WHERE order_id = p_order_id
    AND state IN ('offered', 'accepted', 'assigned', 'picked_up', 'in_progress')
  FOR UPDATE;
  IF FOUND AND v_assignment.state <> 'assigned' THEN
    RETURN jsonb_build_object('ok', false,
      'reason_code', 'POST_PICKUP_CANCELLATION_NOT_SUPPORTED');
  END IF;
  IF FOUND THEN
    UPDATE public.dispatch_offer_assignments SET state = 'cancelled',
      assignment_version = assignment_version + 1, updated_at = now()
    WHERE id = v_assignment.id AND state = 'assigned';
    UPDATE public.mise_delivery_batch_stops SET state = 'cancelled',
      stop_version = stop_version + 1
    WHERE batch_id = v_assignment.batch_id
      AND state IN ('pending', 'arrived', 'servicing');
    UPDATE public.mise_delivery_batches SET state = 'cancelled',
      state_version = state_version + 1, cancelled_at = now(), updated_at = now()
    WHERE id = v_assignment.batch_id AND state = 'assigned';
    UPDATE public.mise_drivers SET
      current_capacity = greatest(0, current_capacity - 1),
      state = CASE WHEN current_capacity <= 1 THEN 'idle' ELSE state END,
      state_version = state_version + 1, updated_at = now()
    WHERE id = v_assignment.driver_id;
    INSERT INTO public.mise_push_outbox (
      driver_id, type, title, body, sound, priority, data
    ) VALUES (
      v_assignment.driver_id, 'assignment_cancelled', 'Tour storniert',
      'Die aktuelle Zuweisung wurde serverseitig storniert.',
      'default', 'high',
      jsonb_build_object(
        'assignment_id', v_assignment.id, 'order_id', p_order_id,
        'correlation_id', v_correlation_id
      )
    );
  END IF;
  UPDATE public.customer_orders SET status = 'cancelled',
    mise_batch_id = NULL, mise_driver_id = NULL,
    dispatch_version = dispatch_version + 1, updated_at = now()
  WHERE id = p_order_id AND dispatch_version = p_expected_order_version;
  v_result := jsonb_build_object('ok', true, 'state', 'cancelled',
    'order_version', p_expected_order_version + 1,
    'correlation_id', v_correlation_id);
  INSERT INTO public.dispatch_offer_audit (
    decision_id, idempotency_key, order_id, batch_id, driver_id, outcome,
    reason_code, expected_order_version, algorithm_version, details,
    correlation_id, event_type
  ) VALUES (
    gen_random_uuid(), gen_random_uuid(), p_order_id, v_assignment.batch_id,
    v_assignment.driver_id, 'cancelled', p_reason_code,
    p_expected_order_version, 'atomic-v2', '{}'::jsonb,
    v_correlation_id, 'assignment.cancelled'
  );
  INSERT INTO public.dispatch_assignment_requests_v2
    (action_id, tenant_id, request_fingerprint, action, correlation_id, result)
  VALUES (p_action_id, p_tenant_id, v_fingerprint, 'cancel',
          v_correlation_id, v_result);
  RETURN v_result;
END;
$$;

-- Post-pickup custody/handoff is intentionally not implemented. The RPC
-- produces a deterministic safe rejection for picked_up/in_progress.
CREATE OR REPLACE FUNCTION public.fn_dispatch_reassign_before_pickup_v2(
  p_tenant_id uuid,
  p_order_id uuid,
  p_expected_order_version bigint,
  p_expected_assignment_version bigint,
  p_new_driver_id uuid,
  p_expected_new_driver_version bigint,
  p_writer_id uuid,
  p_writer_epoch bigint,
  p_action_id uuid,
  p_actor_id uuid,
  p_reason_code text,
  p_note text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_order public.customer_orders%ROWTYPE;
  v_old public.dispatch_offer_assignments%ROWTYPE;
  v_new_driver public.mise_drivers%ROWTYPE;
  v_gate public.dispatch_writer_gates%ROWTYPE;
  v_new_batch uuid;
  v_new_assignment uuid;
  v_correlation uuid := gen_random_uuid();
  v_fingerprint text;
  v_existing public.dispatch_assignment_requests_v2%ROWTYPE;
  v_result jsonb;
BEGIN
  IF p_actor_id IS NULL OR btrim(coalesce(p_reason_code, '')) = ''
     OR btrim(coalesce(p_note, '')) = '' OR p_action_id IS NULL
     OR p_writer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'MANUAL_OVERRIDE_EVIDENCE_MISSING');
  END IF;
  v_fingerprint := md5(pg_catalog.concat_ws(
    '|', p_tenant_id::text, p_order_id::text,
    p_expected_order_version::text, p_expected_assignment_version::text,
    p_new_driver_id::text, p_expected_new_driver_version::text,
    p_writer_id::text, p_writer_epoch::text, p_actor_id::text,
    p_reason_code, p_note
  ));
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_action_id::text, 27602)
  );
  SELECT * INTO v_existing FROM public.dispatch_assignment_requests_v2
  WHERE action_id = p_action_id;
  IF FOUND THEN
    IF v_existing.request_fingerprint <> v_fingerprint THEN
      RETURN jsonb_build_object('ok', false,
        'reason_code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
    END IF;
    RETURN v_existing.result || jsonb_build_object('idempotent_replay', true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text, 27601)
  );
  SELECT * INTO v_gate FROM public.dispatch_writer_gates
  WHERE tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND OR NOT v_gate.enabled OR v_gate.writer <> 'atomic_v2'
     OR v_gate.active_writer_id IS DISTINCT FROM p_writer_id
     OR v_gate.writer_epoch <> p_writer_epoch
     OR v_gate.lease_expires_at <= clock_timestamp() THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason_code', 'WRITER_LEASE_STALE_OR_NOT_OWNER'
    );
  END IF;
  SELECT * INTO v_order FROM public.customer_orders
  WHERE id = p_order_id FOR UPDATE;
  SELECT * INTO v_old FROM public.dispatch_offer_assignments
  WHERE order_id = p_order_id
    AND state IN ('offered', 'accepted', 'assigned', 'picked_up', 'in_progress')
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ACTIVE_ASSIGNMENT_NOT_FOUND');
  END IF;
  IF v_old.state IN ('picked_up', 'in_progress') THEN
    RETURN jsonb_build_object('ok', false,
      'reason_code', 'POST_PICKUP_REASSIGNMENT_NOT_SUPPORTED',
      'state', v_old.state, 'assignment_version', v_old.assignment_version);
  END IF;
  IF v_old.state <> 'assigned' THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'ASSIGNMENT_NOT_CANONICAL_V2');
  END IF;
  IF NOT coalesce(v_gate.pre_pickup_reassignment_enabled, false) THEN
    RETURN jsonb_build_object('ok', false,
      'reason_code', 'PRE_PICKUP_REASSIGNMENT_DEFAULT_OFF');
  END IF;
  IF v_order.dispatch_version <> p_expected_order_version
     OR v_old.assignment_version <> p_expected_assignment_version THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'EXPECTED_VERSION_CONFLICT');
  END IF;
  IF (SELECT state FROM public.mise_drivers WHERE id = v_old.driver_id FOR UPDATE)
     <> 'exception' THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'OLD_DRIVER_NOT_IN_EXCEPTION');
  END IF;
  SELECT * INTO v_new_driver FROM public.mise_drivers
  WHERE id = p_new_driver_id FOR UPDATE;
  IF NOT FOUND OR v_new_driver.state_version <> p_expected_new_driver_version
     OR v_new_driver.state NOT IN ('idle', 'returning', 'available')
     OR NOT v_new_driver.active
     OR v_new_driver.current_capacity + 1 > v_new_driver.max_capacity THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'NEW_DRIVER_NOT_ELIGIBLE_OR_STALE');
  END IF;
  INSERT INTO public.mise_delivery_batches (
    driver_id, state, location_id, route_version, state_version,
    pickup_deadline_at, delivery_deadline_at, updated_at
  ) SELECT p_new_driver_id, 'assigned', b.location_id, b.route_version + 1, 1,
           b.pickup_deadline_at, b.delivery_deadline_at, now()
    FROM public.mise_delivery_batches b WHERE b.id = v_old.batch_id
  RETURNING id INTO v_new_batch;
  INSERT INTO public.mise_delivery_batch_stops (
    batch_id, order_id, type, sequence, lat, lng, address, state, stop_version
  ) SELECT v_new_batch, order_id, type, sequence, lat, lng, address, 'pending', 0
    FROM public.mise_delivery_batch_stops WHERE batch_id = v_old.batch_id
    ORDER BY sequence;
  UPDATE public.dispatch_offer_assignments SET state = 'reassigned',
    assignment_version = assignment_version + 1, updated_at = now()
  WHERE id = v_old.id AND state = 'assigned'
    AND assignment_version = p_expected_assignment_version;
  UPDATE public.mise_delivery_batch_stops SET state = 'cancelled',
    stop_version = stop_version + 1 WHERE batch_id = v_old.batch_id
    AND state IN ('pending', 'arrived', 'servicing');
  UPDATE public.mise_delivery_batches SET state = 'cancelled',
    state_version = state_version + 1, cancelled_at = now(), updated_at = now()
  WHERE id = v_old.batch_id;
  UPDATE public.customer_orders SET mise_batch_id = v_new_batch,
    mise_driver_id = p_new_driver_id, dispatch_version = dispatch_version + 1,
    updated_at = now() WHERE id = p_order_id
    AND dispatch_version = p_expected_order_version;
  UPDATE public.mise_drivers SET current_capacity = greatest(0, current_capacity - 1),
    state_version = state_version + 1, updated_at = now()
  WHERE id = v_old.driver_id AND state = 'exception';
  UPDATE public.mise_drivers SET state = 'assigned',
    current_capacity = current_capacity + 1, state_version = state_version + 1,
    updated_at = now() WHERE id = p_new_driver_id
    AND state_version = p_expected_new_driver_version;
  INSERT INTO public.dispatch_offer_assignments (
    tenant_id, order_id, batch_id, driver_id, state, decision_id,
    idempotency_key, action_id, request_fingerprint,
    expected_order_version, assignment_version, algorithm_version,
    correlation_id, pickup_deadline_at, delivery_deadline_at
  ) VALUES (
    p_tenant_id, p_order_id, v_new_batch, p_new_driver_id, 'assigned',
    p_action_id, gen_random_uuid(), p_action_id,
    md5(p_action_id::text), p_expected_order_version, 1, 'atomic-v2',
    v_correlation, v_old.pickup_deadline_at, v_old.delivery_deadline_at
  ) RETURNING id INTO v_new_assignment;
  INSERT INTO public.dispatch_offer_audit (
    decision_id, idempotency_key, order_id, batch_id, driver_id, outcome,
    reason_code, expected_order_version, algorithm_version, details,
    correlation_id, event_type
  ) VALUES
    (gen_random_uuid(), gen_random_uuid(), p_order_id, v_old.batch_id,
     v_old.driver_id, 'reassigned', p_reason_code, p_expected_order_version,
     'atomic-v2', jsonb_build_object('replacement_assignment_id', v_new_assignment,
       'actor_id', p_actor_id, 'note', p_note), v_correlation,
     'assignment.reassigned'),
    (gen_random_uuid(), gen_random_uuid(), p_order_id, v_new_batch,
     p_new_driver_id, 'assigned', p_reason_code, p_expected_order_version,
     'atomic-v2', jsonb_build_object('replaces_assignment_id', v_old.id,
       'actor_id', p_actor_id, 'note', p_note), v_correlation,
     'assignment.created');
  INSERT INTO public.mise_push_outbox (driver_id, type, title, body, sound, priority, data)
  VALUES
    (v_old.driver_id, 'assignment_reassigned', 'Tour neu zugewiesen',
     'Die Tour bleibt als Ausnahme protokolliert.', 'default', 'high',
     jsonb_build_object('assignment_id', v_old.id, 'correlation_id', v_correlation)),
    (p_new_driver_id, 'order_assigned', 'Neue Tour',
     'Eine neue Lieferung ist dir zugewiesen.', 'default', 'high',
     jsonb_build_object('assignment_id', v_new_assignment,
       'requires_acceptance', false, 'correlation_id', v_correlation));
  v_result := jsonb_build_object('ok', true, 'state', 'assigned',
    'old_assignment_state', 'reassigned',
    'assignment_id', v_new_assignment, 'batch_id', v_new_batch,
    'correlation_id', v_correlation);
  INSERT INTO public.dispatch_assignment_requests_v2 (
    action_id, tenant_id, request_fingerprint, action, correlation_id, result
  ) VALUES (
    p_action_id, p_tenant_id, v_fingerprint, 'reassign_before_pickup',
    v_correlation, v_result
  );
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_dispatch_complete_delivery_v2(
  p_tenant_id uuid,
  p_order_id uuid,
  p_expected_order_version bigint,
  p_expected_assignment_version bigint,
  p_action_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_order public.customer_orders%ROWTYPE;
  v_assignment public.dispatch_offer_assignments%ROWTYPE;
  v_correlation uuid := gen_random_uuid();
  v_fingerprint text;
  v_existing public.dispatch_assignment_requests_v2%ROWTYPE;
  v_result jsonb;
BEGIN
  IF p_action_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'MISSING_ACTION_ID');
  END IF;
  v_fingerprint := md5(pg_catalog.concat_ws(
    '|', p_tenant_id::text, p_order_id::text,
    p_expected_order_version::text, p_expected_assignment_version::text
  ));
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_action_id::text, 27602)
  );
  SELECT * INTO v_existing FROM public.dispatch_assignment_requests_v2
  WHERE action_id = p_action_id;
  IF FOUND THEN
    IF v_existing.request_fingerprint <> v_fingerprint THEN
      RETURN jsonb_build_object('ok', false,
        'reason_code', 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST');
    END IF;
    RETURN v_existing.result || jsonb_build_object('idempotent_replay', true);
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text, 27601)
  );
  SELECT * INTO v_order FROM public.customer_orders
  WHERE id = p_order_id FOR UPDATE;
  SELECT * INTO v_assignment FROM public.dispatch_offer_assignments
  WHERE order_id = p_order_id AND state IN ('assigned', 'picked_up', 'in_progress')
  FOR UPDATE;
  IF NOT FOUND OR v_assignment.state <> 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'DELIVERY_NOT_IN_PROGRESS');
  END IF;
  IF v_order.dispatch_version <> p_expected_order_version
     OR v_assignment.assignment_version <> p_expected_assignment_version THEN
    RETURN jsonb_build_object('ok', false, 'reason_code', 'EXPECTED_VERSION_CONFLICT');
  END IF;
  UPDATE public.dispatch_offer_assignments SET state = 'completed',
    assignment_version = assignment_version + 1, updated_at = now()
  WHERE id = v_assignment.id AND state = 'in_progress'
    AND assignment_version = p_expected_assignment_version;
  UPDATE public.mise_delivery_batch_stops SET state = 'completed',
    completed_at = coalesce(completed_at, now()), stop_version = stop_version + 1
  WHERE batch_id = v_assignment.batch_id AND order_id = p_order_id
    AND state <> 'cancelled';
  UPDATE public.mise_delivery_batches SET state = 'completed',
    state_version = state_version + 1, completed_at = now(), updated_at = now()
  WHERE id = v_assignment.batch_id AND NOT EXISTS (
    SELECT 1 FROM public.dispatch_offer_assignments a
    WHERE a.batch_id = v_assignment.batch_id AND a.id <> v_assignment.id
      AND a.state IN ('assigned', 'picked_up', 'in_progress')
  );
  UPDATE public.customer_orders SET status = 'delivered',
    dispatch_version = dispatch_version + 1, geliefert_am = now(), updated_at = now()
  WHERE id = p_order_id AND dispatch_version = p_expected_order_version;
  UPDATE public.mise_drivers SET
    current_capacity = greatest(0, current_capacity - 1),
    state = CASE WHEN current_capacity <= 1 THEN 'returning' ELSE state END,
    state_version = state_version + 1, updated_at = now()
  WHERE id = v_assignment.driver_id;
  INSERT INTO public.dispatch_offer_audit (
    decision_id, idempotency_key, order_id, batch_id, driver_id, outcome,
    reason_code, expected_order_version, algorithm_version, details,
    correlation_id, event_type
  ) VALUES (
    gen_random_uuid(), p_action_id, p_order_id, v_assignment.batch_id,
    v_assignment.driver_id, 'completed', 'DELIVERY_CONFIRMED',
    p_expected_order_version, 'atomic-v2', '{}'::jsonb, v_correlation,
    'assignment.completed'
  );
  v_result := jsonb_build_object('ok', true, 'state', 'completed',
    'assignment_version', p_expected_assignment_version + 1,
    'order_version', p_expected_order_version + 1,
    'correlation_id', v_correlation);
  INSERT INTO public.dispatch_assignment_requests_v2 (
    action_id, tenant_id, request_fingerprint, action, correlation_id, result
  ) VALUES (
    p_action_id, p_tenant_id, v_fingerprint, 'complete_delivery',
    v_correlation, v_result
  );
  RETURN v_result;
END;
$$;

-- Disable obsolete Atomic-v1 mutation entry points. This prevents a second
-- writable authority after a tenant has moved to Atomic-v2.
REVOKE ALL ON FUNCTION public.fn_dispatch_create_offer_v1(
  uuid, uuid, uuid, bigint, uuid, uuid, text, integer,
  numeric, numeric, text, numeric, numeric, text, text, text
) FROM service_role;
REVOKE ALL ON FUNCTION public.fn_dispatch_transition_offer_v1(
  uuid, uuid, bigint, text, uuid, uuid
) FROM service_role;
REVOKE ALL ON FUNCTION public.fn_dispatch_expire_offers_v1(integer)
  FROM service_role;
REVOKE ALL ON FUNCTION public.fn_dispatch_ack_offer_v1(uuid, uuid, uuid, bigint)
  FROM service_role;
REVOKE ALL ON FUNCTION public.fn_dispatch_set_writer_v1(uuid, text, boolean)
  FROM service_role;

REVOKE ALL ON FUNCTION public.fn_dispatch_writer_for_tenant_v2(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_dispatch_set_writer_v2(uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_dispatch_claim_writer_v2(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_dispatch_assign_orders_v2(
  uuid, uuid, bigint, uuid, bigint, uuid, text, jsonb, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_dispatch_ack_assignment_v2(
  uuid, uuid, uuid, bigint, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_dispatch_cancel_order_v2(
  uuid, uuid, bigint, uuid, text
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_dispatch_reassign_before_pickup_v2(
  uuid, uuid, bigint, bigint, uuid, bigint, uuid, bigint,
  uuid, uuid, text, text
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_dispatch_complete_delivery_v2(
  uuid, uuid, bigint, bigint, uuid
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.fn_dispatch_writer_for_tenant_v2(uuid),
  public.fn_dispatch_set_writer_v2(uuid, text, boolean),
  public.fn_dispatch_claim_writer_v2(uuid, uuid, integer),
  public.fn_dispatch_assign_orders_v2(
    uuid, uuid, bigint, uuid, bigint, uuid, text, jsonb, text, text
  ),
  public.fn_dispatch_ack_assignment_v2(uuid, uuid, uuid, bigint, uuid, jsonb)
TO service_role;

COMMENT ON FUNCTION public.fn_dispatch_assign_orders_v2(
  uuid, uuid, bigint, uuid, bigint, uuid, text, jsonb, text, text
) IS 'Atomic-v2 canonical assignment. Default-off tenant gate; no acceptance/decline/expiry.';
