\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$roles$;

CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE
);

CREATE TABLE locations (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL
);

CREATE TABLE mise_drivers (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  state text NOT NULL,
  last_position_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mise_driver_tenants (
  driver_id uuid NOT NULL REFERENCES mise_drivers(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  status text NOT NULL,
  PRIMARY KEY (driver_id, tenant_id)
);

CREATE TABLE mise_delivery_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES mise_drivers(id),
  state text NOT NULL,
  location_id uuid REFERENCES locations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz
);

CREATE TABLE customer_orders (
  id uuid PRIMARY KEY,
  location_id uuid REFERENCES locations(id),
  tenant_id uuid REFERENCES tenants(id),
  bestellnummer text,
  kunde_name text,
  typ text NOT NULL,
  status text NOT NULL,
  mise_batch_id uuid REFERENCES mise_delivery_batches(id),
  mise_driver_id uuid REFERENCES mise_drivers(id),
  dispatch_version bigint NOT NULL DEFAULT 0,
  eta_latest timestamptz,
  geliefert_am timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mise_delivery_batch_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES mise_delivery_batches(id),
  order_id uuid NOT NULL REFERENCES customer_orders(id),
  type text NOT NULL,
  sequence integer NOT NULL,
  lat numeric,
  lng numeric,
  address text
);

CREATE TABLE mise_push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES mise_drivers(id),
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  sound text,
  priority text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
