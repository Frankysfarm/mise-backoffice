BEGIN;

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS tracking_token uuid;

UPDATE public.customer_orders
SET tracking_token = gen_random_uuid()
WHERE tracking_token IS NULL;

ALTER TABLE public.customer_orders
  ALTER COLUMN tracking_token SET DEFAULT gen_random_uuid(),
  ALTER COLUMN tracking_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_orders_tracking_token_uidx
  ON public.customer_orders (tracking_token);

COMMENT ON COLUMN public.customer_orders.tracking_token IS
  'Unpredictable capability token required for public customer tracking.';

CREATE TABLE IF NOT EXISTS public.tracking_verification_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  ip_hash text NOT NULL,
  order_ref_hash text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracking_verification_attempts_ip_idx
  ON public.tracking_verification_attempts (ip_hash, created_at DESC)
  WHERE success = false;

CREATE INDEX IF NOT EXISTS tracking_verification_attempts_order_idx
  ON public.tracking_verification_attempts (order_ref_hash, created_at DESC)
  WHERE success = false;

ALTER TABLE public.tracking_verification_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tracking_verification_attempts FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.tracking_verification_attempts_id_seq FROM anon, authenticated;
GRANT ALL ON TABLE public.tracking_verification_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.tracking_verification_attempts_id_seq TO service_role;

COMMIT;
