BEGIN;

ALTER TABLE public.mise_delivery_batches
  ADD COLUMN IF NOT EXISTS zone text,
  ADD COLUMN IF NOT EXISTS dispatch_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS kitchen_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS optimized boolean NOT NULL DEFAULT false;

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS delivery_zone text,
  ADD COLUMN IF NOT EXISTS dispatch_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS kitchen_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS eta_earliest timestamptz,
  ADD COLUMN IF NOT EXISTS eta_latest timestamptz,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS estimated_prep_min integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS dispatch_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dispatch_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_status text;

UPDATE public.customer_orders
   SET estimated_prep_min = COALESCE(geschaetzte_zubereitung_min, 15)
 WHERE estimated_prep_min IS NULL
    OR estimated_prep_min = 15;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.customer_orders'::regclass
       AND conname = 'customer_orders_schedule_status_check'
  ) THEN
    ALTER TABLE public.customer_orders
      ADD CONSTRAINT customer_orders_schedule_status_check
      CHECK (schedule_status IS NULL OR schedule_status IN ('scheduled', 'released', 'immediate'));
  END IF;
END;
$constraints$;

ALTER TABLE public.mise_drivers
  ADD COLUMN IF NOT EXISTS current_capacity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_capacity integer NOT NULL DEFAULT 4;

CREATE TABLE IF NOT EXISTS public.dispatch_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.mise_drivers(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.mise_delivery_batches(id) ON DELETE SET NULL,
  total_score numeric(5,2) NOT NULL,
  f_distance numeric(4,2) DEFAULT 0,
  f_load numeric(4,2) DEFAULT 0,
  f_vehicle numeric(4,2) DEFAULT 0,
  f_experience numeric(4,2) DEFAULT 0,
  f_zone numeric(4,2) DEFAULT 0,
  f_prep_time numeric(4,2) DEFAULT 0,
  f_time_of_day numeric(4,2) DEFAULT 0,
  f_priority numeric(4,2) DEFAULT 0,
  f_bundle_fit numeric(4,2) DEFAULT 0,
  f_history numeric(4,2) DEFAULT 0,
  decision text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatch_scores OWNER TO supabase_admin;
ALTER TABLE public.dispatch_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.dispatch_scores FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.dispatch_scores TO service_role;

CREATE INDEX IF NOT EXISTS idx_dispatch_scores_order
  ON public.dispatch_scores (order_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_scores_location
  ON public.dispatch_scores (location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_orders_held_attempts
  ON public.customer_orders (location_id, created_at ASC, dispatch_attempts)
  WHERE typ = 'lieferung' AND mise_batch_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_orders_scheduled
  ON public.customer_orders (scheduled_at, location_id)
  WHERE schedule_status = 'scheduled';

CREATE OR REPLACE FUNCTION public.reset_dispatch_attempts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.mise_batch_id IS NULL AND NEW.mise_batch_id IS NOT NULL THEN
    NEW.dispatch_attempts := 0;
    NEW.last_dispatch_attempt_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.reset_dispatch_attempts() OWNER TO supabase_admin;
REVOKE ALL ON FUNCTION public.reset_dispatch_attempts() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reset_dispatch_attempts ON public.customer_orders;
CREATE TRIGGER trg_reset_dispatch_attempts
  BEFORE UPDATE OF mise_batch_id ON public.customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_dispatch_attempts();

NOTIFY pgrst, 'reload schema';

COMMIT;
