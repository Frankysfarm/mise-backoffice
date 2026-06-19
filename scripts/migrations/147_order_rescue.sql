-- 147_order_rescue.sql
-- Phase 306: Smart Order Rescue Engine
-- Proaktive Erkennung und Intervention bei gefährdeten Lieferbestellungen

-- ── Rescue-Konfiguration je Location ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rescue_configs (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id                  UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  enabled                      BOOLEAN NOT NULL DEFAULT TRUE,
  risk_threshold               INT NOT NULL DEFAULT 40,  -- Rescue ab Score ≥ N
  wait_min_trigger             INT NOT NULL DEFAULT 20,  -- Flag wenn Wartezeit > N Min
  eta_overrun_trigger_min      INT NOT NULL DEFAULT 10,  -- Flag wenn ETA überschritten um N Min
  auto_push_enabled            BOOLEAN NOT NULL DEFAULT TRUE,
  auto_priority_boost_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  auto_voucher_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  voucher_value_eur            NUMERIC(6,2) NOT NULL DEFAULT 3.00,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id)
);

-- ── Rescue-Ereignisse (eine Zeile je gefährdeter Bestellung) ─────────────────

CREATE TABLE IF NOT EXISTS order_rescue_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id            UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id               UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  order_nr               TEXT,
  detected_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  risk_score             NUMERIC(5,1) NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_factors           JSONB NOT NULL DEFAULT '[]',
  status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'rescued', 'cancelled', 'expired', 'resolved')),
  wait_min_at_detection  INT,
  had_driver             BOOLEAN NOT NULL DEFAULT FALSE,
  eta_passed             BOOLEAN NOT NULL DEFAULT FALSE,
  intervention_count     INT NOT NULL DEFAULT 0,
  resolved_at            TIMESTAMPTZ,
  outcome                TEXT CHECK (outcome IN ('kept', 'cancelled', 'delivered', 'expired')),
  revenue_eur            NUMERIC(8,2),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id)  -- maximal 1 aktives Rescue-Event je Bestellung
);

-- ── Durchgeführte Interventionen ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rescue_interventions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rescue_event_id    UUID NOT NULL REFERENCES order_rescue_events(id) ON DELETE CASCADE,
  location_id        UUID NOT NULL,
  order_id           UUID NOT NULL,
  intervention_type  TEXT NOT NULL
                       CHECK (intervention_type IN (
                         'push_notify',
                         'status_update',
                         'voucher_offer',
                         'priority_boost',
                         'driver_reassign'
                       )),
  executed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload            JSONB,
  success            BOOLEAN,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indizes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_order_rescue_events_location
  ON order_rescue_events (location_id, status, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_rescue_events_order
  ON order_rescue_events (order_id);

CREATE INDEX IF NOT EXISTS idx_rescue_interventions_event
  ON rescue_interventions (rescue_event_id, executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_rescue_interventions_location
  ON rescue_interventions (location_id, executed_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE rescue_configs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_rescue_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rescue_interventions    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rescue_configs_location" ON rescue_configs
  FOR ALL USING (
    location_id IN (
      SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "order_rescue_events_location" ON order_rescue_events
  FOR ALL USING (
    location_id IN (
      SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "rescue_interventions_location" ON rescue_interventions
  FOR ALL USING (
    location_id IN (
      SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

-- ── Cleanup-Funktion ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_old_rescue_events(p_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM order_rescue_events
  WHERE status IN ('resolved', 'expired', 'cancelled', 'rescued')
    AND updated_at < now() - (p_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ── Summary-View ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_rescue_summary AS
SELECT
  e.location_id,
  COUNT(*) FILTER (WHERE e.status = 'active')                           AS active_risks,
  COUNT(*) FILTER (WHERE e.status IN ('rescued', 'resolved')
                    AND e.outcome = 'kept')                             AS orders_saved,
  COUNT(*) FILTER (WHERE e.status = 'cancelled'
                    OR e.outcome = 'cancelled')                         AS orders_lost,
  COUNT(*) FILTER (WHERE e.detected_at > now() - INTERVAL '24 hours')  AS flagged_last_24h,
  SUM(e.revenue_eur) FILTER (WHERE e.outcome = 'kept')                 AS revenue_saved_eur,
  AVG(e.risk_score)  FILTER (WHERE e.detected_at > now() - INTERVAL '24 hours') AS avg_risk_score_24h,
  COUNT(DISTINCT i.id)                                                  AS total_interventions
FROM order_rescue_events e
LEFT JOIN rescue_interventions i ON i.rescue_event_id = e.id
GROUP BY e.location_id;

-- ── updated_at Trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_rescue_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_rescue_events_updated_at
  BEFORE UPDATE ON order_rescue_events
  FOR EACH ROW EXECUTE FUNCTION set_rescue_updated_at();

CREATE TRIGGER trg_rescue_configs_updated_at
  BEFORE UPDATE ON rescue_configs
  FOR EACH ROW EXECUTE FUNCTION set_rescue_updated_at();
