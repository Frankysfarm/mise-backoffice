-- Phase 348: Smart Cross-Location Driver Lending Engine
-- Ermöglicht das temporäre Ausleihen von Fahrern zwischen Standorten desselben Tenants.
-- Standorte mit Überschuss bieten Fahrer an; Standorte mit Engpass fordern sie an.

-- ── 1. Tenant-weite Konfiguration ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_lending_config (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL UNIQUE,
  is_enabled              boolean NOT NULL DEFAULT false,
  max_distance_km         numeric(7,2) NOT NULL DEFAULT 25.0,
  min_idle_to_lend        int  NOT NULL DEFAULT 2,
  min_pending_to_request  int  NOT NULL DEFAULT 3,
  auto_suggest            boolean NOT NULL DEFAULT true,
  hourly_compensation_eur numeric(6,2) NOT NULL DEFAULT 0.0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE driver_lending_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_driver_lending_config" ON driver_lending_config;
CREATE POLICY "service_role_driver_lending_config"
  ON driver_lending_config USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_driver_lending_config_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_driver_lending_config_ts ON driver_lending_config;
CREATE TRIGGER trg_driver_lending_config_ts
  BEFORE UPDATE ON driver_lending_config
  FOR EACH ROW EXECUTE FUNCTION update_driver_lending_config_updated_at();

-- ── 2. Lending-Anfragen ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_lending_requests (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL,
  from_location_id          uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  to_location_id            uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id                 uuid NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  requested_by_employee_id  uuid,
  status                    text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','accepted','rejected',
                                              'active','completed','cancelled')),
  requested_at              timestamptz NOT NULL DEFAULT now(),
  accepted_at               timestamptz,
  started_at                timestamptz,
  ended_at                  timestamptz,
  hours_worked              numeric(5,2),
  compensation_eur          numeric(8,2),
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_lending_tenant_status
  ON driver_lending_requests(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_lending_driver
  ON driver_lending_requests(driver_id, created_at DESC);

ALTER TABLE driver_lending_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_driver_lending_requests" ON driver_lending_requests;
CREATE POLICY "service_role_driver_lending_requests"
  ON driver_lending_requests USING (true) WITH CHECK (true);

-- ── 3. Prune-Funktion ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_driver_lending_requests(days_old int DEFAULT 90)
RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  WITH deleted AS (
    DELETE FROM driver_lending_requests
    WHERE status IN ('completed', 'cancelled', 'rejected')
      AND created_at < now() - (days_old || ' days')::interval
    RETURNING id
  )
  SELECT count(*)::int FROM deleted;
$$;
