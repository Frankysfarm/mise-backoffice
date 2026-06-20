-- Phase 344: Smart Cancellation Guard
-- Prevents abusive cancellations, tracks risk, enables voucher interventions.

CREATE TABLE IF NOT EXISTS cancellation_guard_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid NOT NULL UNIQUE REFERENCES locations(id) ON DELETE CASCADE,
  is_enabled    boolean NOT NULL DEFAULT true,
  max_cancellations_per_hour  int NOT NULL DEFAULT 2,
  voucher_enabled             boolean NOT NULL DEFAULT true,
  voucher_amount_eur          numeric(6,2) NOT NULL DEFAULT 3.00,
  block_after_n_cancellations int NOT NULL DEFAULT 3,
  block_window_hours          int NOT NULL DEFAULT 24,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cancellation_guard_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id      uuid REFERENCES customer_orders(id) ON DELETE SET NULL,
  customer_id   uuid,
  event_type    text NOT NULL CHECK (event_type IN (
                  'attempt', 'blocked', 'voucher_offered',
                  'voucher_used', 'cancelled_allowed')),
  risk_level    text NOT NULL DEFAULT 'low'
                CHECK (risk_level IN ('low', 'medium', 'high', 'blocked')),
  cancellation_count_24h int NOT NULL DEFAULT 0,
  voucher_code  text,
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cancel_guard_location
  ON cancellation_guard_events(location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cancel_guard_customer
  ON cancellation_guard_events(customer_id, created_at DESC);

ALTER TABLE cancellation_guard_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_guard_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_cancel_guard_config" ON cancellation_guard_config;
CREATE POLICY "service_role_cancel_guard_config"
  ON cancellation_guard_config USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_cancel_guard_events" ON cancellation_guard_events;
CREATE POLICY "service_role_cancel_guard_events"
  ON cancellation_guard_events USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION prune_cancellation_guard_events(days_old int DEFAULT 30)
RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  WITH deleted AS (
    DELETE FROM cancellation_guard_events
    WHERE created_at < now() - (days_old || ' days')::interval
    RETURNING id
  )
  SELECT count(*)::int FROM deleted;
$$;

CREATE OR REPLACE FUNCTION update_cancel_guard_config_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_guard_config_updated_at ON cancellation_guard_config;
CREATE TRIGGER trg_cancel_guard_config_updated_at
  BEFORE UPDATE ON cancellation_guard_config
  FOR EACH ROW EXECUTE FUNCTION update_cancel_guard_config_updated_at();
