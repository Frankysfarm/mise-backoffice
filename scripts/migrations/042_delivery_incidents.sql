-- Migration 042: Delivery Incident Management Engine
-- Phase 51: Structured incident tracking for low ratings, late deliveries, and operational issues
-- Auto-creates incidents from bad ratings (≤2 stars), manual creation via admin

-- ── Incidents table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_incidents (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       text        NOT NULL,
  order_id          text,                   -- linked customer_orders.id (nullable for manual)
  driver_id         text,                   -- linked mise_drivers.id (nullable)
  batch_id          text,                   -- linked mise_delivery_batches.id (nullable)
  type              text        NOT NULL
                                CHECK (type IN (
                                  'low_rating',
                                  'late_delivery',
                                  'wrong_item',
                                  'missing_item',
                                  'damaged',
                                  'driver_behavior',
                                  'failed_delivery',
                                  'manual'
                                )),
  severity          text        NOT NULL DEFAULT 'medium'
                                CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status            text        NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'investigating', 'escalated', 'resolved', 'closed')),
  title             text        NOT NULL,
  description       text,
  customer_rating   int         CHECK (customer_rating BETWEEN 1 AND 5),
  customer_comment  text,
  customer_name     text,
  customer_phone    text,
  resolution_notes  text,
  credit_issued_id  uuid,                   -- FK delivery_credits.id (informational)
  escalated_at      timestamptz,
  resolved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Incident action log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incident_actions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid        NOT NULL REFERENCES delivery_incidents(id) ON DELETE CASCADE,
  action_type  text        NOT NULL
               CHECK (action_type IN (
                 'created',
                 'status_changed',
                 'severity_changed',
                 'customer_contacted',
                 'driver_contacted',
                 'credit_issued',
                 'escalated',
                 'resolved',
                 'closed',
                 'note'
               )),
  note         text,
  performed_by text,                        -- user email or 'system'
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── Indizes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_delivery_incidents_location
  ON delivery_incidents (location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_incidents_order
  ON delivery_incidents (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_incidents_driver
  ON delivery_incidents (driver_id)
  WHERE driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_incidents_status
  ON delivery_incidents (location_id, status)
  WHERE status NOT IN ('closed', 'resolved');

CREATE INDEX IF NOT EXISTS idx_incident_actions_incident
  ON incident_actions (incident_id, created_at ASC);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_incident_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_updated_at ON delivery_incidents;
CREATE TRIGGER trg_incident_updated_at
  BEFORE UPDATE ON delivery_incidents
  FOR EACH ROW EXECUTE FUNCTION set_incident_updated_at();

-- ── v_open_incidents: offene Incidents mit Order- und Fahrer-Details ──────────
CREATE OR REPLACE VIEW v_open_incidents AS
SELECT
  di.id,
  di.location_id,
  di.order_id,
  di.driver_id,
  di.type,
  di.severity,
  di.status,
  di.title,
  di.customer_rating,
  di.customer_name,
  di.escalated_at,
  di.created_at,
  di.updated_at,
  -- minutes since creation
  EXTRACT(EPOCH FROM (now() - di.created_at)) / 60 AS age_minutes,
  -- order details
  co.bestellnummer,
  co.lieferung_oder_abholung AS order_type,
  -- driver name
  md.name AS driver_name
FROM delivery_incidents di
LEFT JOIN customer_orders co ON co.id::text = di.order_id
LEFT JOIN mise_drivers md    ON md.id::text = di.driver_id
WHERE di.status IN ('open', 'investigating', 'escalated')
ORDER BY
  CASE di.severity
    WHEN 'critical' THEN 1
    WHEN 'high'     THEN 2
    WHEN 'medium'   THEN 3
    ELSE 4
  END,
  di.created_at DESC;

-- ── v_incident_stats: KPI-Aggregation pro Location ───────────────────────────
CREATE OR REPLACE VIEW v_incident_stats AS
SELECT
  location_id,
  COUNT(*)                                                    AS total,
  COUNT(*) FILTER (WHERE status IN ('open','investigating','escalated')) AS open_count,
  COUNT(*) FILTER (WHERE status = 'resolved')                 AS resolved_count,
  COUNT(*) FILTER (WHERE status = 'closed')                   AS closed_count,
  COUNT(*) FILTER (WHERE type = 'low_rating')                 AS low_rating_count,
  COUNT(*) FILTER (WHERE type = 'late_delivery')              AS late_delivery_count,
  COUNT(*) FILTER (WHERE type IN ('wrong_item','missing_item','damaged')) AS fulfillment_count,
  COUNT(*) FILTER (WHERE severity = 'critical')               AS critical_count,
  COUNT(*) FILTER (WHERE severity = 'high')                   AS high_count,
  ROUND(
    AVG(
      CASE WHEN resolved_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60
      END
    )::numeric, 1
  )                                                           AS avg_resolution_min,
  COUNT(*) FILTER (WHERE credit_issued_id IS NOT NULL)        AS credits_issued,
  MAX(created_at)                                             AS last_incident_at
FROM delivery_incidents
GROUP BY location_id;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE delivery_incidents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_actions    ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY IF NOT EXISTS incidents_service_all
  ON delivery_incidents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS incident_actions_service_all
  ON incident_actions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can see their own location's data
CREATE POLICY IF NOT EXISTS incidents_auth_select
  ON delivery_incidents FOR SELECT TO authenticated
  USING (true);  -- location_id check done in application layer

CREATE POLICY IF NOT EXISTS incident_actions_auth_select
  ON incident_actions FOR SELECT TO authenticated
  USING (true);
