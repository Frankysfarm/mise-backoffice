\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.mise_drivers (
  id uuid PRIMARY KEY,
  active boolean NOT NULL DEFAULT true,
  state text NOT NULL DEFAULT 'available',
  state_version bigint NOT NULL DEFAULT 1,
  current_capacity integer NOT NULL DEFAULT 0,
  push_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.customer_orders (
  id uuid PRIMARY KEY,
  status text NOT NULL,
  dispatch_version bigint NOT NULL DEFAULT 1,
  geliefert_am timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mise_delivery_batches (
  id uuid PRIMARY KEY,
  driver_id uuid REFERENCES public.mise_drivers(id),
  state text NOT NULL,
  state_version bigint NOT NULL DEFAULT 1,
  route_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dispatch_offer_assignments (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.customer_orders(id),
  batch_id uuid NOT NULL REFERENCES public.mise_delivery_batches(id),
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id),
  state text NOT NULL,
  assignment_version bigint NOT NULL DEFAULT 1,
  received_by_app_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mise_delivery_batch_stops (
  id uuid PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES public.mise_delivery_batches(id),
  order_id uuid NOT NULL REFERENCES public.customer_orders(id),
  type text NOT NULL,
  state text NOT NULL,
  stop_version bigint NOT NULL DEFAULT 1,
  completed_at timestamptz
);
CREATE TABLE public.mise_push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.mise_drivers(id),
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  sound text,
  priority text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  notification_state text NOT NULL DEFAULT 'queued',
  provider_accepted_at timestamptz,
  app_acknowledged_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claim_token uuid,
  provider_message_id text,
  last_error text,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid()
);
CREATE TABLE public.driver_action_requests_v2 (
  action_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  action text NOT NULL,
  target_id uuid,
  request_fingerprint text NOT NULL,
  correlation_id uuid NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dispatch_offer_audit (
  decision_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  order_id uuid,
  batch_id uuid,
  driver_id uuid,
  outcome text NOT NULL,
  reason_code text NOT NULL,
  expected_order_version bigint,
  algorithm_version text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid NOT NULL,
  event_type text NOT NULL
);

DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(req.table_name || '.' || req.column_name, ', ')
  INTO missing
  FROM (VALUES
    ('mise_drivers','push_enabled'),('mise_drivers','state_version'),
    ('mise_delivery_batches','route_version'),('mise_delivery_batches','created_at'),
    ('mise_push_outbox','notification_state'),('mise_push_outbox','claim_token'),
    ('dispatch_offer_assignments','received_by_app_at'),
    ('mise_delivery_batch_stops','stop_version'),
    ('customer_orders','dispatch_version')) req(table_name,column_name)
  WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=req.table_name
      AND c.column_name=req.column_name);
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'T285_SCHEMA_PREFLIGHT_MISSING: %',missing; END IF;
END $$;
