BEGIN;

-- Corrected production variants of migrations 018 and 040. The original daily
-- view summed a non-existent total_km column, used obsolete driver columns, and
-- installed no tenant isolation.

CREATE TABLE IF NOT EXISTS public.driver_payout_configs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id            uuid NOT NULL UNIQUE REFERENCES public.locations(id) ON DELETE CASCADE,
  base_per_delivery      numeric(6,2) NOT NULL DEFAULT 3.00 CHECK (base_per_delivery >= 0),
  km_rate                numeric(5,3) NOT NULL DEFAULT 0.25 CHECK (km_rate >= 0),
  peak_multiplier        numeric(4,2) NOT NULL DEFAULT 1.00 CHECK (peak_multiplier >= 1),
  bonus_per_rating_point numeric(5,2) NOT NULL DEFAULT 0.10 CHECK (bonus_per_rating_point >= 0),
  min_rating_for_bonus   numeric(3,1) NOT NULL DEFAULT 4.0
    CHECK (min_rating_for_bonus BETWEEN 0 AND 5),
  milestone_bonuses      jsonb NOT NULL DEFAULT '{"10": 2.00, "25": 5.00, "50": 10.00}'::jsonb,
  peak_windows           jsonb NOT NULL DEFAULT '[]'::jsonb,
  currency               varchar(3) NOT NULL DEFAULT 'EUR',
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_payout_periods (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  driver_id             uuid NOT NULL REFERENCES public.mise_drivers(id) ON DELETE CASCADE,
  period_start          timestamptz NOT NULL,
  period_end            timestamptz NOT NULL,
  period_type           varchar(10) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'custom')),
  deliveries_count      integer NOT NULL DEFAULT 0,
  total_km              numeric(8,2) NOT NULL DEFAULT 0,
  total_base            numeric(10,2) NOT NULL DEFAULT 0,
  total_km_bonus        numeric(10,2) NOT NULL DEFAULT 0,
  total_peak_bonus      numeric(10,2) NOT NULL DEFAULT 0,
  total_rating_bonus    numeric(10,2) NOT NULL DEFAULT 0,
  total_milestone_bonus numeric(10,2) NOT NULL DEFAULT 0,
  total_payout          numeric(10,2) NOT NULL DEFAULT 0,
  avg_rating            numeric(3,1),
  on_time_rate_pct      numeric(5,1),
  status                varchar(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'paid')),
  approved_by           uuid REFERENCES auth.users(id),
  approved_at           timestamptz,
  paid_at               timestamptz,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end > period_start),
  UNIQUE (location_id, driver_id, period_start, period_end, period_type)
);

CREATE TABLE IF NOT EXISTS public.driver_payout_records (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id              uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  driver_id                uuid NOT NULL REFERENCES public.mise_drivers(id) ON DELETE CASCADE,
  order_id                 uuid REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  batch_id                 uuid REFERENCES public.mise_delivery_batches(id) ON DELETE SET NULL,
  batch_stop_id            uuid REFERENCES public.mise_delivery_batch_stops(id) ON DELETE SET NULL,
  base_amount              numeric(8,2) NOT NULL DEFAULT 0,
  km_bonus                 numeric(8,2) NOT NULL DEFAULT 0,
  peak_bonus               numeric(8,2) NOT NULL DEFAULT 0,
  rating_bonus             numeric(8,2) NOT NULL DEFAULT 0,
  milestone_bonus          numeric(8,2) NOT NULL DEFAULT 0,
  total_amount             numeric(8,2) NOT NULL DEFAULT 0,
  delivery_km              numeric(6,2),
  was_peak_time            boolean NOT NULL DEFAULT false,
  driver_rating_at_time    numeric(3,1),
  deliveries_today_at_time integer,
  period_id                uuid REFERENCES public.driver_payout_periods(id) ON DELETE SET NULL,
  paid_out                 boolean NOT NULL DEFAULT false,
  paid_out_at              timestamptz,
  config_snapshot          jsonb,
  completed_at             timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  CHECK (total_amount >= 0),
  CHECK (delivery_km IS NULL OR delivery_km >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_records_order_once
  ON public.driver_payout_records(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payout_records_driver_location
  ON public.driver_payout_records(driver_id, location_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_records_location_period
  ON public.driver_payout_records(location_id, period_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_records_unpaid
  ON public.driver_payout_records(location_id, paid_out, completed_at DESC)
  WHERE paid_out = false;
CREATE INDEX IF NOT EXISTS idx_payout_periods_driver_location
  ON public.driver_payout_periods(driver_id, location_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_payout_periods_status
  ON public.driver_payout_periods(location_id, status, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_payout_records_export
  ON public.driver_payout_records(location_id, completed_at DESC, paid_out);

ALTER TABLE public.driver_payout_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payout_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payout_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payout_configs_service_all ON public.driver_payout_configs;
DROP POLICY IF EXISTS payout_configs_auth_select ON public.driver_payout_configs;
DROP POLICY IF EXISTS payout_records_service_all ON public.driver_payout_records;
DROP POLICY IF EXISTS payout_records_auth_select ON public.driver_payout_records;
DROP POLICY IF EXISTS payout_periods_service_all ON public.driver_payout_periods;
DROP POLICY IF EXISTS payout_periods_auth_select ON public.driver_payout_periods;

CREATE POLICY payout_configs_service_all
  ON public.driver_payout_configs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY payout_configs_auth_select
  ON public.driver_payout_configs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.location_id = driver_payout_configs.location_id)
  );

CREATE POLICY payout_records_service_all
  ON public.driver_payout_records FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY payout_records_auth_select
  ON public.driver_payout_records FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.location_id = driver_payout_records.location_id)
    OR EXISTS (SELECT 1 FROM public.mise_drivers d
      WHERE d.auth_user_id = auth.uid() AND d.id = driver_payout_records.driver_id)
  );

CREATE POLICY payout_periods_service_all
  ON public.driver_payout_periods FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY payout_periods_auth_select
  ON public.driver_payout_periods FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.location_id = driver_payout_periods.location_id)
    OR EXISTS (SELECT 1 FROM public.mise_drivers d
      WHERE d.auth_user_id = auth.uid() AND d.id = driver_payout_periods.driver_id)
  );

REVOKE ALL PRIVILEGES ON TABLE
  public.driver_payout_configs,
  public.driver_payout_records,
  public.driver_payout_periods
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
  public.driver_payout_configs,
  public.driver_payout_records,
  public.driver_payout_periods
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.driver_payout_configs,
  public.driver_payout_records,
  public.driver_payout_periods
  TO service_role;

CREATE OR REPLACE FUNCTION public.generate_driver_period_payout(
  p_driver_id uuid,
  p_location_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_type text DEFAULT 'daily'
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_period_id uuid;
  v_agg record;
BEGIN
  IF p_end <= p_start THEN
    RAISE EXCEPTION 'period end must be after start';
  END IF;
  IF p_type NOT IN ('daily', 'weekly', 'monthly', 'custom') THEN
    RAISE EXCEPTION 'invalid period type';
  END IF;

  SELECT id INTO v_period_id
  FROM public.driver_payout_periods
  WHERE location_id = p_location_id
    AND driver_id = p_driver_id
    AND period_start = p_start
    AND period_end = p_end
    AND period_type = p_type;
  IF v_period_id IS NOT NULL THEN
    RETURN v_period_id;
  END IF;

  SELECT
    COUNT(*)::integer AS deliveries,
    COALESCE(SUM(delivery_km), 0) AS total_km,
    COALESCE(SUM(base_amount), 0) AS total_base,
    COALESCE(SUM(km_bonus), 0) AS total_km_bonus,
    COALESCE(SUM(peak_bonus), 0) AS total_peak_bonus,
    COALESCE(SUM(rating_bonus), 0) AS total_rating_bonus,
    COALESCE(SUM(milestone_bonus), 0) AS total_milestone_bonus,
    COALESCE(SUM(total_amount), 0) AS total_payout,
    ROUND(AVG(driver_rating_at_time)::numeric, 1) AS avg_rating
  INTO v_agg
  FROM public.driver_payout_records
  WHERE driver_id = p_driver_id
    AND location_id = p_location_id
    AND completed_at >= p_start
    AND completed_at < p_end
    AND period_id IS NULL;

  INSERT INTO public.driver_payout_periods (
    location_id, driver_id, period_start, period_end, period_type,
    deliveries_count, total_km, total_base, total_km_bonus,
    total_peak_bonus, total_rating_bonus, total_milestone_bonus,
    total_payout, avg_rating, status
  ) VALUES (
    p_location_id, p_driver_id, p_start, p_end, p_type,
    v_agg.deliveries, v_agg.total_km, v_agg.total_base, v_agg.total_km_bonus,
    v_agg.total_peak_bonus, v_agg.total_rating_bonus, v_agg.total_milestone_bonus,
    v_agg.total_payout, v_agg.avg_rating, 'draft'
  )
  RETURNING id INTO v_period_id;

  UPDATE public.driver_payout_records
  SET period_id = v_period_id
  WHERE driver_id = p_driver_id
    AND location_id = p_location_id
    AND completed_at >= p_start
    AND completed_at < p_end
    AND period_id IS NULL;

  RETURN v_period_id;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_driver_period_payout(uuid, uuid, timestamptz, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_driver_period_payout(uuid, uuid, timestamptz, timestamptz, text)
  TO service_role;

CREATE OR REPLACE VIEW public.v_pending_payouts
WITH (security_invoker = true) AS
SELECT
  p.id, p.location_id, p.driver_id,
  d.name AS driver_name,
  d.vehicle AS driver_vehicle,
  p.period_type, p.period_start, p.period_end, p.deliveries_count,
  p.total_km, p.total_payout, p.avg_rating, p.on_time_rate_pct,
  p.status, p.created_at
FROM public.driver_payout_periods p
JOIN public.mise_drivers d ON d.id = p.driver_id
WHERE p.status IN ('draft', 'approved')
ORDER BY p.period_start DESC;

CREATE OR REPLACE VIEW public.v_daily_payout_summary
WITH (security_invoker = true) AS
SELECT
  location_id,
  date(completed_at AT TIME ZONE 'Europe/Berlin') AS payout_date,
  COUNT(DISTINCT driver_id) AS active_drivers,
  COUNT(*) AS total_deliveries,
  ROUND(SUM(delivery_km)::numeric, 1) AS total_km,
  ROUND(SUM(total_amount)::numeric, 2) AS total_payout_eur,
  ROUND(AVG(total_amount)::numeric, 2) AS avg_payout_per_delivery,
  ROUND(SUM(CASE WHEN was_peak_time THEN total_amount ELSE 0 END)::numeric, 2)
    AS peak_time_payout
FROM public.driver_payout_records
GROUP BY location_id, date(completed_at AT TIME ZONE 'Europe/Berlin')
ORDER BY payout_date DESC;

CREATE OR REPLACE VIEW public.v_payout_periods_full
WITH (security_invoker = true) AS
SELECT
  p.id, p.location_id, p.driver_id, p.period_type, p.period_start, p.period_end,
  p.deliveries_count, p.total_km, p.total_base, p.total_km_bonus,
  p.total_peak_bonus, p.total_rating_bonus, p.total_milestone_bonus,
  p.total_payout, p.avg_rating, p.on_time_rate_pct, p.status,
  p.approved_at, p.paid_at, p.notes, p.created_at, p.updated_at,
  d.name AS driver_name,
  NULLIF(concat_ws(' ', e.vorname, e.nachname), '') AS employee_name,
  d.vehicle AS vehicle_type
FROM public.driver_payout_periods p
LEFT JOIN public.mise_drivers d ON d.id = p.driver_id
LEFT JOIN public.employees e ON e.auth_user_id = d.auth_user_id;

CREATE OR REPLACE VIEW public.v_payout_daily_summary
WITH (security_invoker = true) AS
SELECT
  location_id,
  date(period_start AT TIME ZONE 'Europe/Berlin') AS period_date,
  COUNT(*) AS driver_count,
  SUM(deliveries_count) AS total_deliveries,
  SUM(total_km) AS total_km,
  SUM(total_payout) AS total_payout_eur,
  AVG(avg_rating) FILTER (WHERE avg_rating IS NOT NULL) AS avg_rating,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
  COUNT(*) FILTER (WHERE status = 'paid') AS paid_count
FROM public.driver_payout_periods
GROUP BY location_id, date(period_start AT TIME ZONE 'Europe/Berlin');

REVOKE ALL PRIVILEGES ON TABLE
  public.v_pending_payouts,
  public.v_daily_payout_summary,
  public.v_payout_periods_full,
  public.v_payout_daily_summary
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
  public.v_pending_payouts,
  public.v_daily_payout_summary,
  public.v_payout_periods_full,
  public.v_payout_daily_summary
  TO authenticated, service_role;

COMMIT;
