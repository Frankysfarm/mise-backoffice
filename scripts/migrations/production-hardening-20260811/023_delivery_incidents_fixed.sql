BEGIN;

-- Corrected production variant of migration 042: UUID foreign keys, real
-- customer_orders.typ column, tenant-scoped policies, and safe reporting views.

CREATE TABLE IF NOT EXISTS public.delivery_incidents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  order_id         uuid REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  driver_id        uuid REFERENCES public.mise_drivers(id) ON DELETE SET NULL,
  batch_id         uuid REFERENCES public.mise_delivery_batches(id) ON DELETE SET NULL,
  type             text NOT NULL CHECK (type IN (
    'low_rating', 'late_delivery', 'wrong_item', 'missing_item', 'damaged',
    'driver_behavior', 'failed_delivery', 'manual'
  )),
  severity         text NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status           text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'escalated', 'resolved', 'closed')),
  title            text NOT NULL,
  description      text,
  customer_rating  integer CHECK (customer_rating BETWEEN 1 AND 5),
  customer_comment text,
  customer_name    text,
  customer_phone   text,
  resolution_notes text,
  credit_issued_id uuid REFERENCES public.delivery_credits(id) ON DELETE SET NULL,
  escalated_at     timestamptz,
  resolved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incident_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid NOT NULL REFERENCES public.delivery_incidents(id) ON DELETE CASCADE,
  action_type  text NOT NULL CHECK (action_type IN (
    'created', 'status_changed', 'severity_changed', 'customer_contacted',
    'driver_contacted', 'credit_issued', 'escalated', 'resolved', 'closed', 'note'
  )),
  note         text,
  performed_by text,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_low_rating_order_once
  ON public.delivery_incidents(order_id, type)
  WHERE order_id IS NOT NULL AND type = 'low_rating';
CREATE INDEX IF NOT EXISTS idx_delivery_incidents_location
  ON public.delivery_incidents(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_incidents_order
  ON public.delivery_incidents(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_incidents_driver
  ON public.delivery_incidents(driver_id) WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_incidents_status
  ON public.delivery_incidents(location_id, status)
  WHERE status NOT IN ('closed', 'resolved');
CREATE INDEX IF NOT EXISTS idx_incident_actions_incident
  ON public.incident_actions(incident_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.set_incident_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_updated_at ON public.delivery_incidents;
CREATE TRIGGER trg_incident_updated_at
  BEFORE UPDATE ON public.delivery_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_incident_updated_at();

ALTER TABLE public.delivery_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS incidents_service_all ON public.delivery_incidents;
DROP POLICY IF EXISTS incidents_auth_select ON public.delivery_incidents;
DROP POLICY IF EXISTS incident_actions_service_all ON public.incident_actions;
DROP POLICY IF EXISTS incident_actions_auth_select ON public.incident_actions;

CREATE POLICY incidents_service_all
  ON public.delivery_incidents FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY incidents_auth_select
  ON public.delivery_incidents FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid() AND e.location_id = delivery_incidents.location_id)
  );
CREATE POLICY incident_actions_service_all
  ON public.incident_actions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY incident_actions_auth_select
  ON public.incident_actions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.delivery_incidents i
      JOIN public.employees e ON e.location_id = i.location_id
      WHERE i.id = incident_actions.incident_id
        AND e.auth_user_id = auth.uid()
    )
  );

REVOKE ALL PRIVILEGES ON TABLE public.delivery_incidents, public.incident_actions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.delivery_incidents, public.incident_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_incidents, public.incident_actions
  TO service_role;

CREATE OR REPLACE VIEW public.v_open_incidents
WITH (security_invoker = true) AS
SELECT
  i.id, i.location_id, i.order_id, i.driver_id, i.type, i.severity, i.status,
  i.title, i.customer_rating, i.customer_name, i.escalated_at, i.created_at,
  i.updated_at,
  EXTRACT(EPOCH FROM (now() - i.created_at)) / 60 AS age_minutes,
  o.bestellnummer,
  o.typ AS order_type,
  d.name AS driver_name
FROM public.delivery_incidents i
LEFT JOIN public.customer_orders o ON o.id = i.order_id
LEFT JOIN public.mise_drivers d ON d.id = i.driver_id
WHERE i.status IN ('open', 'investigating', 'escalated')
ORDER BY CASE i.severity
  WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
  i.created_at DESC;

CREATE OR REPLACE VIEW public.v_incident_stats
WITH (security_invoker = true) AS
SELECT
  location_id,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status IN ('open', 'investigating', 'escalated')) AS open_count,
  COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_count,
  COUNT(*) FILTER (WHERE status = 'closed') AS closed_count,
  COUNT(*) FILTER (WHERE type = 'low_rating') AS low_rating_count,
  COUNT(*) FILTER (WHERE type = 'late_delivery') AS late_delivery_count,
  COUNT(*) FILTER (WHERE type IN ('wrong_item', 'missing_item', 'damaged')) AS fulfillment_count,
  COUNT(*) FILTER (WHERE severity = 'critical') AS critical_count,
  COUNT(*) FILTER (WHERE severity = 'high') AS high_count,
  ROUND(AVG(CASE WHEN resolved_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60 END)::numeric, 1)
    AS avg_resolution_min,
  COUNT(*) FILTER (WHERE credit_issued_id IS NOT NULL) AS credits_issued,
  MAX(created_at) AS last_incident_at
FROM public.delivery_incidents
GROUP BY location_id;

REVOKE ALL PRIVILEGES ON TABLE public.v_open_incidents, public.v_incident_stats
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_open_incidents, public.v_incident_stats
  TO authenticated, service_role;

COMMIT;
