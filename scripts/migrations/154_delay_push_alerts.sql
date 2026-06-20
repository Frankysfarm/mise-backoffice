-- Migration 154: Delay Push Alert Log
-- Phase 318 — Delay-Aware Customer Alert Engine
-- Tracks which critical-risk orders have already received a delay push notification (dedup guard).

CREATE TABLE IF NOT EXISTS delay_push_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  location_id     UUID NOT NULL,
  delay_risk_score INTEGER NOT NULL,
  risk_level      TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suppressed_reason TEXT
);

-- One alert per order (dedup)
CREATE UNIQUE INDEX IF NOT EXISTS delay_push_alerts_order_id_key ON delay_push_alerts (order_id);

-- Fast lookups by location + time
CREATE INDEX IF NOT EXISTS delay_push_alerts_location_sent ON delay_push_alerts (location_id, sent_at DESC);

-- RLS
ALTER TABLE delay_push_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_read_delay_push_alerts"
  ON delay_push_alerts FOR SELECT
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE user_id = auth.uid()
    )
  );
