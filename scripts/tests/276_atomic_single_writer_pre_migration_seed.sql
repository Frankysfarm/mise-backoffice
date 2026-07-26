\set ON_ERROR_STOP on

INSERT INTO tenants (id, name, slug)
VALUES (
  '11000000-0000-0000-0000-000000000001',
  'T02 canonical tenant',
  't02-canonical'
);

INSERT INTO dispatch_writer_gates (tenant_id, writer, enabled)
VALUES (
  '11000000-0000-0000-0000-000000000001',
  'atomic_v1',
  true
);
