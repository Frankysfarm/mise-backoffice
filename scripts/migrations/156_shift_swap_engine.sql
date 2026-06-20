-- Migration 156: Smart Shift-Swap Engine
-- Fahrer können Schichten untereinander tauschen (peer-to-peer)

-- Config je Location
CREATE TABLE IF NOT EXISTS shift_swap_config (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id               UUID NOT NULL UNIQUE,
  enabled                   BOOLEAN NOT NULL DEFAULT true,
  require_admin_approval    BOOLEAN NOT NULL DEFAULT true,
  max_swaps_per_driver_month INTEGER NOT NULL DEFAULT 4,
  min_notice_hours          INTEGER NOT NULL DEFAULT 24,
  allow_open_requests       BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tausch-Anfragen
CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id             UUID NOT NULL,
  requester_driver_id     UUID NOT NULL,
  requester_shift_id      UUID NOT NULL,
  -- Ziel-Fahrer (NULL = offene Anfrage, jeder kann annehmen)
  target_driver_id        UUID,
  -- Wer hat angenommen (für offene Anfragen)
  accepted_by_driver_id   UUID,
  accepted_shift_id       UUID,
  status                  TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','cancelled','completed','expired')),
  -- Admin-Genehmigung
  admin_approval_required BOOLEAN NOT NULL DEFAULT false,
  admin_approved_at       TIMESTAMPTZ,
  admin_approved_by       UUID,
  admin_rejection_reason  TEXT,
  -- Metadaten
  notes                   TEXT,
  expires_at              TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  accepted_at             TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique: eine offene Anfrage pro Schicht
CREATE UNIQUE INDEX IF NOT EXISTS shift_swap_open_per_shift_idx
  ON shift_swap_requests (requester_shift_id)
  WHERE status = 'pending';

-- Performance-Indizes
CREATE INDEX IF NOT EXISTS shift_swap_location_status_idx
  ON shift_swap_requests (location_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS shift_swap_requester_idx
  ON shift_swap_requests (requester_driver_id, status);
CREATE INDEX IF NOT EXISTS shift_swap_target_idx
  ON shift_swap_requests (target_driver_id)
  WHERE target_driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS shift_swap_expires_idx
  ON shift_swap_requests (expires_at)
  WHERE status = 'pending';

-- Updated-at Trigger
CREATE OR REPLACE FUNCTION update_shift_swap_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS shift_swap_updated_at ON shift_swap_requests;
CREATE TRIGGER shift_swap_updated_at
  BEFORE UPDATE ON shift_swap_requests
  FOR EACH ROW EXECUTE FUNCTION update_shift_swap_updated_at();

DROP TRIGGER IF EXISTS shift_swap_config_updated_at ON shift_swap_config;
CREATE TRIGGER shift_swap_config_updated_at
  BEFORE UPDATE ON shift_swap_config
  FOR EACH ROW EXECUTE FUNCTION update_shift_swap_updated_at();

-- RLS
ALTER TABLE shift_swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swap_config   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shift_swap_service ON shift_swap_requests;
CREATE POLICY shift_swap_service ON shift_swap_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS shift_swap_config_service ON shift_swap_config;
CREATE POLICY shift_swap_config_service ON shift_swap_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- View: offene Tausch-Anfragen mit Fahrernamen + Schicht-Zeiten
CREATE OR REPLACE VIEW v_open_swap_requests AS
SELECT
  ssr.id,
  ssr.location_id,
  ssr.requester_driver_id,
  rd.name   AS requester_name,
  rd.vehicle AS requester_vehicle,
  ssr.requester_shift_id,
  ds.planned_start AS shift_start,
  ds.planned_end   AS shift_end,
  ssr.target_driver_id,
  td.name AS target_name,
  ssr.notes,
  ssr.admin_approval_required,
  ssr.expires_at,
  ssr.created_at
FROM shift_swap_requests ssr
JOIN mise_drivers  rd ON rd.id = ssr.requester_driver_id
JOIN driver_shifts ds ON ds.id = ssr.requester_shift_id
LEFT JOIN mise_drivers td ON td.id = ssr.target_driver_id
WHERE ssr.status = 'pending'
  AND ssr.expires_at > NOW();

-- View: Statistiken je Location
CREATE OR REPLACE VIEW v_shift_swap_stats AS
SELECT
  location_id,
  COUNT(*) FILTER (WHERE status = 'pending')                                    AS pending_count,
  COUNT(*) FILTER (WHERE status = 'completed'
                     AND completed_at > NOW() - INTERVAL '30 days')             AS completed_30d,
  COUNT(*) FILTER (WHERE status IN ('rejected','cancelled')
                     AND updated_at  > NOW() - INTERVAL '30 days')              AS declined_30d,
  COUNT(*) FILTER (WHERE status = 'expired')                                    AS expired_total,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600.0
  ) FILTER (WHERE status = 'completed')::NUMERIC, 1)                           AS avg_completion_hours
FROM shift_swap_requests
GROUP BY location_id;
