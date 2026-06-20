-- Phase 349: Zone-based Multi-Stop Batch Optimizer V2
-- Findet automatisch Bestellungen, die sich für gemeinsame Liefertouren eignen,
-- berechnet km-Einsparungen und schlägt optimierte Batches vor.

-- ── 1. Konfiguration ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zone_batch_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           uuid NOT NULL UNIQUE REFERENCES locations(id) ON DELETE CASCADE,
  is_enabled            boolean NOT NULL DEFAULT true,
  max_stops             int NOT NULL DEFAULT 3 CHECK (max_stops BETWEEN 2 AND 6),
  max_radius_km         numeric(6,2) NOT NULL DEFAULT 2.5 CHECK (max_radius_km > 0),
  auto_apply_min_score  int NOT NULL DEFAULT 85 CHECK (auto_apply_min_score BETWEEN 50 AND 100),
  min_km_savings_pct    numeric(5,2) NOT NULL DEFAULT 15.0 CHECK (min_km_savings_pct >= 0),
  scan_interval_min     int NOT NULL DEFAULT 3,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE zone_batch_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employees_read_zone_batch_config" ON zone_batch_config;
CREATE POLICY "employees_read_zone_batch_config"
  ON zone_batch_config FOR SELECT
  USING (location_id IN (
    SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "service_role_zone_batch_config" ON zone_batch_config;
CREATE POLICY "service_role_zone_batch_config"
  ON zone_batch_config USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_zone_batch_config_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_zone_batch_config_ts ON zone_batch_config;
CREATE TRIGGER trg_zone_batch_config_ts
  BEFORE UPDATE ON zone_batch_config
  FOR EACH ROW EXECUTE FUNCTION update_zone_batch_config_updated_at();

-- ── 2. Batch-Vorschläge ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zone_batch_suggestions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  stops           jsonb NOT NULL DEFAULT '[]'::jsonb,   -- Array of {orderId, lat, lng, address, gesamtbetrag}
  total_orders    int NOT NULL DEFAULT 0,
  route_km        numeric(8,3) NOT NULL DEFAULT 0,
  individual_km   numeric(8,3) NOT NULL DEFAULT 0,     -- km wenn jeder Stop solo geliefert wird
  km_savings      numeric(8,3) NOT NULL DEFAULT 0,
  km_savings_pct  numeric(6,2) NOT NULL DEFAULT 0,
  score           int NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','applied','rejected','expired','auto_applied')),
  driver_id       uuid REFERENCES mise_drivers(id) ON DELETE SET NULL,
  batch_id        uuid,                                 -- mise_delivery_batches (no FK, optional)
  resolved_by     uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

ALTER TABLE zone_batch_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employees_read_zone_batch_suggestions" ON zone_batch_suggestions;
CREATE POLICY "employees_read_zone_batch_suggestions"
  ON zone_batch_suggestions FOR SELECT
  USING (location_id IN (
    SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "service_role_zone_batch_suggestions" ON zone_batch_suggestions;
CREATE POLICY "service_role_zone_batch_suggestions"
  ON zone_batch_suggestions USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_zone_batch_suggestions_location_status
  ON zone_batch_suggestions(location_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zone_batch_suggestions_created_at
  ON zone_batch_suggestions(created_at DESC);

-- ── 3. Prune-RPC ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_zone_batch_suggestions(days_old int DEFAULT 30)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted_count int;
BEGIN
  DELETE FROM zone_batch_suggestions
  WHERE created_at < now() - (days_old || ' days')::interval
    AND status IN ('applied', 'rejected', 'expired', 'auto_applied');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
