-- Migration 006: delivery_events + Zone-Erweiterungen + Stats-View
--
-- Zweck:
--   1. delivery_events — Audit-Trail für Bestellungs-Lifecycle
--   2. delivery_zones updated_at-Trigger
--   3. v_delivery_today_stats VIEW — aggregierte Tages-KPIs für Admin-Dashboard
--   4. Indizes auf delivery_events

-- ============================================================
-- 1. delivery_events Tabelle
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   text NOT NULL,
  location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id     uuid REFERENCES customer_orders(id) ON DELETE SET NULL,
  batch_id     uuid REFERENCES mise_delivery_batches(id) ON DELETE SET NULL,
  driver_id    uuid REFERENCES mise_drivers(id) ON DELETE SET NULL,
  payload      jsonb NOT NULL DEFAULT '{}',
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE delivery_events IS
  'Audit-Trail aller Smart-Delivery-Ereignisse (dispatch, bundle, ETA, Küche, Fahrer).';

-- ============================================================
-- 2. Indizes delivery_events
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_delivery_events_location_at
  ON delivery_events (location_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_events_order
  ON delivery_events (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_events_batch
  ON delivery_events (batch_id)
  WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_events_type
  ON delivery_events (event_type, location_id, occurred_at DESC);

-- ============================================================
-- 3. RLS für delivery_events
--    Service-Role kann alles; authentifizierte Nutzer können lesen
-- ============================================================
ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_events_service_all"  ON delivery_events;
DROP POLICY IF EXISTS "delivery_events_auth_select"  ON delivery_events;

CREATE POLICY "delivery_events_service_all"
  ON delivery_events FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "delivery_events_auth_select"
  ON delivery_events FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 4. delivery_zones: updated_at automatisch setzen
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_zones_updated_at ON delivery_zones;
CREATE TRIGGER trg_delivery_zones_updated_at
  BEFORE UPDATE ON delivery_zones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. v_delivery_today_stats VIEW — Tages-KPIs auf einen Blick
-- ============================================================
CREATE OR REPLACE VIEW v_delivery_today_stats AS
SELECT
  co.location_id,
  COUNT(*)                                                    AS total_orders,
  COUNT(*) FILTER (WHERE co.status IN ('abgeschlossen','geliefert'))
                                                              AS delivered_orders,
  COUNT(*) FILTER (WHERE co.status IN ('neu','bestätigt','in_zubereitung'))
                                                              AS pending_orders,
  COUNT(*) FILTER (WHERE co.dispatch_score IS NOT NULL)       AS dispatched_orders,
  ROUND(AVG(co.dispatch_score)::numeric, 1)                   AS avg_dispatch_score,
  COUNT(DISTINCT co.mise_batch_id)
    FILTER (WHERE co.mise_batch_id IS NOT NULL)               AS active_batches,
  COUNT(*) FILTER (WHERE co.delivery_zone = 'A')              AS zone_a,
  COUNT(*) FILTER (WHERE co.delivery_zone = 'B')              AS zone_b,
  COUNT(*) FILTER (WHERE co.delivery_zone = 'C')              AS zone_c,
  COUNT(*) FILTER (WHERE co.delivery_zone = 'D')              AS zone_d
FROM customer_orders co
WHERE
  co.typ        = 'lieferung'
  AND co.created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
GROUP BY co.location_id;

COMMENT ON VIEW v_delivery_today_stats IS
  'Aggregierte Tages-KPIs pro Location (Bestellungen, Zonen, Scores).';

-- ============================================================
-- 6. get_delivery_trends() Funktion — Heute vs. Gestern
-- ============================================================
CREATE OR REPLACE FUNCTION get_delivery_trends(p_location_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH today AS (
    SELECT
      COUNT(*)                                                  AS orders,
      COUNT(*) FILTER (WHERE status IN ('abgeschlossen','geliefert')) AS delivered,
      ROUND(AVG(dispatch_score)::numeric, 1)                    AS avg_score
    FROM customer_orders
    WHERE location_id = p_location_id
      AND typ = 'lieferung'
      AND created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
  ),
  yesterday AS (
    SELECT
      COUNT(*)                                                  AS orders,
      COUNT(*) FILTER (WHERE status IN ('abgeschlossen','geliefert')) AS delivered,
      ROUND(AVG(dispatch_score)::numeric, 1)                    AS avg_score
    FROM customer_orders
    WHERE location_id = p_location_id
      AND typ = 'lieferung'
      AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') - INTERVAL '1 day') AT TIME ZONE 'Europe/Berlin'
      AND created_at <  date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
  )
  SELECT jsonb_build_object(
    'today',     jsonb_build_object('orders', t.orders, 'delivered', t.delivered, 'avg_score', t.avg_score),
    'yesterday', jsonb_build_object('orders', y.orders, 'delivered', y.delivered, 'avg_score', y.avg_score),
    'delta_orders',    t.orders    - y.orders,
    'delta_delivered', t.delivered - y.delivered
  )
  FROM today t, yesterday y;
$$;

COMMENT ON FUNCTION get_delivery_trends IS
  'Vergleicht heutige vs. gestrige Liefer-KPIs für Trend-Pfeile im Dashboard.';
