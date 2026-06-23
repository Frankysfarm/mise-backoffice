-- Migration 221: Order Priority Overrides — Manueller Prioritäts-Override
-- Phase 487

CREATE TABLE IF NOT EXISTS order_priority_overrides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  location_id  UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  priority     TEXT NOT NULL CHECK (priority IN ('hoch','mittel','niedrig')),
  note         TEXT,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_opo_location ON order_priority_overrides(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opo_order ON order_priority_overrides(order_id);

ALTER TABLE order_priority_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_opo" ON order_priority_overrides
  USING (location_id IN (
    SELECT l.id FROM locations l
    JOIN employees e ON e.tenant_id = l.tenant_id
    WHERE e.auth_user_id = auth.uid()
  ));
