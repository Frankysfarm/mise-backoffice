-- Migration 222: Driver Availability Signals — Fahrer-Verfügbarkeits-Signale
-- Phase 488

CREATE TABLE IF NOT EXISTS driver_availability_signals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  signal      TEXT NOT NULL CHECK (signal IN ('available','break','end')),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_das_driver ON driver_availability_signals(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_das_location ON driver_availability_signals(location_id, created_at DESC);

ALTER TABLE driver_availability_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_das" ON driver_availability_signals
  USING (location_id IN (
    SELECT l.id FROM locations l
    JOIN employees e ON e.tenant_id = l.tenant_id
    WHERE e.auth_user_id = auth.uid()
  ));
