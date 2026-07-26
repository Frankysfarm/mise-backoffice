\set ON_ERROR_STOP on

DROP TABLE IF EXISTS t02_race_barriers;
CREATE TABLE t02_race_barriers (
  barrier_name text PRIMARY KEY,
  released boolean NOT NULL DEFAULT false
);

CREATE OR REPLACE FUNCTION fn_t02_race_barrier(p_name text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_released boolean;
  v_attempt integer;
  v_key integer:=hashtext(p_name);
BEGIN
  PERFORM pg_advisory_lock_shared(27690,v_key);
  FOR v_attempt IN 1..1000 LOOP
    SELECT released INTO v_released FROM public.t02_race_barriers
    WHERE barrier_name=p_name;
    IF coalesce(v_released,false) THEN
      PERFORM pg_advisory_unlock_shared(27690,v_key);
      RETURN;
    END IF;
    PERFORM pg_sleep(0.01);
  END LOOP;
  PERFORM pg_advisory_unlock_shared(27690,v_key);
  RAISE EXCEPTION 'T02_BARRIER_TIMEOUT:%',p_name;
END
$$;

INSERT INTO tenants (id, name, slug)
VALUES (
  '11000000-0000-0000-0000-000000000002',
  'T02 writer race tenant',
  't02-writer-race'
);
INSERT INTO dispatch_writer_gates (tenant_id, writer, enabled)
VALUES (
  '11000000-0000-0000-0000-000000000002',
  'atomic_v2',
  true
);

DROP TABLE IF EXISTS t02_race_cases;
CREATE TABLE t02_race_cases (
  iteration integer PRIMARY KEY,
  order_id uuid NOT NULL,
  driver_a uuid NOT NULL,
  driver_b uuid NOT NULL,
  action_a uuid NOT NULL,
  action_b uuid NOT NULL
);

INSERT INTO t02_race_cases
SELECT i, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
       gen_random_uuid(), gen_random_uuid()
FROM generate_series(1, 100) i;

INSERT INTO mise_drivers (id, name, active, state, last_position_at, max_capacity)
SELECT driver_id, 'race driver', true, 'idle', now(), 4
FROM (
  SELECT driver_a AS driver_id FROM t02_race_cases
  UNION ALL
  SELECT driver_b FROM t02_race_cases
) d;

INSERT INTO mise_driver_tenants (driver_id, tenant_id, status)
SELECT id, '11000000-0000-0000-0000-000000000001', 'active'
FROM mise_drivers
WHERE name = 'race driver';

INSERT INTO customer_orders (
  id, location_id, tenant_id, bestellnummer, kunde_name, typ, status
)
SELECT order_id, '12000000-0000-0000-0000-000000000001',
       '11000000-0000-0000-0000-000000000001',
       'race-' || iteration, 'fixture', 'lieferung', 'fertig'
FROM t02_race_cases;

-- Dedicated same-key and fingerprint-conflict cases.
INSERT INTO t02_race_cases
VALUES
  (101, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
   gen_random_uuid(), gen_random_uuid()),
  (102, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
   gen_random_uuid(), gen_random_uuid()),
  (103, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
   gen_random_uuid(), gen_random_uuid()),
  (104, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
   gen_random_uuid(), gen_random_uuid());

INSERT INTO mise_drivers (id, name, active, state, last_position_at, max_capacity)
SELECT driver_id, 'special race driver', true, 'idle', now(), 4
FROM (
  SELECT driver_a AS driver_id FROM t02_race_cases WHERE iteration > 100
  UNION ALL
  SELECT driver_b FROM t02_race_cases WHERE iteration > 100
) d;
INSERT INTO mise_driver_tenants (driver_id, tenant_id, status)
SELECT id, '11000000-0000-0000-0000-000000000001', 'active'
FROM mise_drivers WHERE name = 'special race driver';
INSERT INTO customer_orders (
  id, location_id, tenant_id, bestellnummer, kunde_name, typ, status
)
SELECT order_id, '12000000-0000-0000-0000-000000000001',
       '11000000-0000-0000-0000-000000000001',
       'special-race-' || iteration, 'fixture', 'lieferung', 'fertig'
FROM t02_race_cases WHERE iteration > 100;

SELECT fn_dispatch_claim_writer_v2(
  '11000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-000000000001', 120
);

-- Case 104 is already canonical in_progress for delivery-vs-reassignment.
DO $seed_delivery$
DECLARE
  v_case t02_race_cases%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO v_case FROM t02_race_cases WHERE iteration = 104;
  v_result := fn_dispatch_assign_orders_v2(
    '11000000-0000-0000-0000-000000000001',
    '15000000-0000-0000-0000-000000000001', 1,
    v_case.driver_a, 0, v_case.action_a, 'race-test',
    jsonb_build_array(jsonb_build_object(
      'order_id', v_case.order_id, 'expected_order_version', 0,
      'pickup_lat', 52.0, 'pickup_lng', 13.0, 'pickup_address', 'pickup',
      'dropoff_lat', 52.1, 'dropoff_lng', 13.1, 'dropoff_address', 'dropoff',
      'pickup_deadline_at', now() + interval '20 minutes',
      'delivery_deadline_at', now() + interval '45 minutes'
    )), 'assigned', 'race'
  );
  IF NOT coalesce((v_result->>'ok')::boolean, false) THEN
    RAISE EXCEPTION 'failed to seed delivery race: %', v_result;
  END IF;
  v_result:=fn_dispatch_pickup_assignment_v2(
    '11000000-0000-0000-0000-000000000001',v_case.order_id,
    1,1,1,1,v_case.driver_a,gen_random_uuid());
  IF v_result->>'state'<>'picked_up' THEN
    RAISE EXCEPTION 'failed to seed pickup race:%',v_result;
  END IF;
  v_result:=fn_dispatch_start_delivery_v2(
    '11000000-0000-0000-0000-000000000001',v_case.order_id,
    2,2,2,2,v_case.driver_a,gen_random_uuid());
  IF v_result->>'state'<>'in_progress' THEN
    RAISE EXCEPTION 'failed to seed start race:%',v_result;
  END IF;
END
$seed_delivery$;
