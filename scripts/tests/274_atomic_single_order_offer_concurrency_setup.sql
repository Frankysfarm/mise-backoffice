\set ON_ERROR_STOP on

TRUNCATE dispatch_offer_audit, dispatch_offer_assignments,
  mise_push_outbox, mise_delivery_batch_stops, customer_orders,
  mise_delivery_batches, mise_driver_tenants, mise_drivers, locations CASCADE;

INSERT INTO tenants (id, name, slug)
VALUES (
  '11000000-0000-0000-0000-000000000001',
  'P0 atomic concurrency test tenant',
  'p0-atomic-concurrency-test'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenants (id, name, slug)
VALUES (
  '11000000-0000-0000-0000-000000000002',
  'P0 writer boundary test tenant',
  'p0-writer-boundary-test'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dispatch_writer_gates (tenant_id, writer, enabled)
VALUES ('11000000-0000-0000-0000-000000000001', 'atomic_v1', true)
ON CONFLICT (tenant_id) DO UPDATE
SET writer = EXCLUDED.writer, enabled = EXCLUDED.enabled;

INSERT INTO dispatch_writer_gates (tenant_id, writer, enabled)
VALUES ('11000000-0000-0000-0000-000000000002', 'legacy_db', true)
ON CONFLICT (tenant_id) DO UPDATE
SET writer = EXCLUDED.writer, enabled = EXCLUDED.enabled;

INSERT INTO locations (id, tenant_id, name)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'P0 atomic concurrency test location'
);

INSERT INTO locations (id, tenant_id, name)
VALUES (
  '10000000-0000-0000-0000-000000000002',
  '11000000-0000-0000-0000-000000000002',
  'P0 writer boundary test location'
);

INSERT INTO mise_drivers (id, name, active, state, last_position_at)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'P0 race driver 1', true, 'idle', now()),
  ('20000000-0000-0000-0000-000000000002', 'P0 race driver 2', true, 'idle', now()),
  ('20000000-0000-0000-0000-000000000003', 'P0 race driver 3', true, 'idle', now());

INSERT INTO mise_driver_tenants (driver_id, tenant_id, status)
SELECT id, '11000000-0000-0000-0000-000000000001', 'active'
FROM mise_drivers;

INSERT INTO customer_orders (
  id, location_id, tenant_id, bestellnummer, kunde_name, typ, status
)
VALUES
  ('30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   '11000000-0000-0000-0000-000000000001',
   'P0-RACE-1', 'P0 race customer 1', 'lieferung', 'fertig'),
  ('30000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000001',
   '11000000-0000-0000-0000-000000000001',
   'P0-RACE-2', 'P0 race customer 2', 'lieferung', 'fertig'),
  ('30000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000002',
   '11000000-0000-0000-0000-000000000002',
   'P0-BOUNDARY-1', 'P0 boundary customer', 'lieferung', 'in_zubereitung');
