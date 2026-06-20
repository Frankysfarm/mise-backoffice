-- 159_driver_geofence_engine.sql
-- Phase 333 — Driver Geofence Engine
--
-- Pull-basierter Cron-Scanner: prüft aktive Fahrer-Positionen gegen offene
-- Liefer-Stops und feuert Kunden-Push-Benachrichtigungen bei Annäherung.
--
-- Ring 1 (default 300m): driver_nearby   — "Fahrer ist gleich da"
-- Ring 2 (default 150m): driver_almost_there — "Fahrer in ~2 Minuten"
--
-- Dedup über bestehende status_push_log-Tabelle (ein Push je Order+Event).

-- ── 1. Konfiguration je Location ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_geofence_config (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID        NOT NULL UNIQUE REFERENCES locations(id) ON DELETE CASCADE,
  enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
  ring1_m       INT         NOT NULL DEFAULT 300
                            CHECK (ring1_m BETWEEN 50 AND 2000),
  ring2_m       INT         NOT NULL DEFAULT 150
                            CHECK (ring2_m BETWEEN 30 AND 1000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofence_config_location
  ON driver_geofence_config(location_id);

ALTER TABLE driver_geofence_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geofence_config_admin_rls" ON driver_geofence_config
  USING (location_id IN (
    SELECT location_id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "geofence_config_service_all" ON driver_geofence_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- updated_at Trigger
CREATE OR REPLACE FUNCTION set_geofence_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_geofence_config_updated_at ON driver_geofence_config;
CREATE TRIGGER trg_geofence_config_updated_at
  BEFORE UPDATE ON driver_geofence_config
  FOR EACH ROW EXECUTE FUNCTION set_geofence_config_updated_at();

-- ── 2. Scan-Log (Cron-Protokoll) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_geofence_scan_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  drivers_scanned INT         NOT NULL DEFAULT 0,
  stops_checked   INT         NOT NULL DEFAULT 0,
  ring1_fired     INT         NOT NULL DEFAULT 0,
  ring2_fired     INT         NOT NULL DEFAULT 0,
  errors          INT         NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_geofence_scan_log_location_time
  ON driver_geofence_scan_log(location_id, scanned_at DESC);

ALTER TABLE driver_geofence_scan_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geofence_scan_log_admin_rls" ON driver_geofence_scan_log
  USING (location_id IN (
    SELECT location_id FROM employees WHERE user_id = auth.uid()
  ));

CREATE POLICY "geofence_scan_log_service_all" ON driver_geofence_scan_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 3. Cleanup-Funktionen ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_geofence_scan_logs(days_old INT DEFAULT 7)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE deleted INT;
BEGIN
  DELETE FROM driver_geofence_scan_log WHERE scanned_at < now() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
