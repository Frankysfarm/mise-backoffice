CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE mise_drivers (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE customer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_deadline_at timestamptz
);
CREATE TABLE mise_delivery_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),driver_id uuid REFERENCES mise_drivers(id),
 state text NOT NULL DEFAULT 'assigned',state_version bigint NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE dispatch_offer_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES customer_orders(id),
  batch_id uuid NOT NULL REFERENCES mise_delivery_batches(id),
  driver_id uuid NOT NULL REFERENCES mise_drivers(id),
  state text NOT NULL,
  assignment_version bigint NOT NULL DEFAULT 1,
  lease_expires_at timestamptz NOT NULL
  ,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE mise_push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES mise_drivers(id),
  type text NOT NULL,title text NOT NULL,body text NOT NULL,
  sound text,priority text,data jsonb NOT NULL DEFAULT '{}',
  attempts integer NOT NULL DEFAULT 0,sent_at timestamptz,failed_at timestamptz,
  fail_reason text,created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON mise_push_outbox TO anon,authenticated;
