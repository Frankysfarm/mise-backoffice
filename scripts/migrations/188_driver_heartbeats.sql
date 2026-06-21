-- 188_driver_heartbeats.sql
-- Phase 394 Backend: Driver App Heartbeat + Connectivity Monitor
--
-- Tracks app-level pings from driver devices so dispatch can detect
-- silent disconnects (app crash / lost signal) even when GPS stops updating.
-- Two tables:
--   driver_app_heartbeats       — raw per-driver pings (pruned after 3 days)
--   driver_connectivity_events  — alertable disconnect / reconnect events (30 days)

-- ── Raw heartbeats ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_app_heartbeats (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id     UUID        NOT NULL REFERENCES mise_locations(id) ON DELETE CASCADE,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  battery_pct     SMALLINT,           -- 0–100
  app_version     TEXT,
  lat             NUMERIC(9,6),
  lng             NUMERIC(9,6),
  signal_quality  SMALLINT            -- 0–100, optional device signal level
);

CREATE INDEX IF NOT EXISTS idx_drv_hb_driver_time
  ON driver_app_heartbeats (driver_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_drv_hb_location_time
  ON driver_app_heartbeats (location_id, recorded_at DESC);

-- ── Connectivity events (disconnect / reconnect alerts) ────────────────────────
CREATE TABLE IF NOT EXISTS driver_connectivity_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id     UUID        NOT NULL REFERENCES mise_locations(id) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL CHECK (event_type IN ('disconnect', 'reconnect')),
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  gap_minutes     SMALLINT,           -- NULL for reconnect, minutes since last ping for disconnect
  had_active_tour BOOLEAN     NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,        -- set when driver reconnects
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drv_conn_location_time
  ON driver_connectivity_events (location_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_drv_conn_driver_time
  ON driver_connectivity_events (driver_id, detected_at DESC);

-- ── updated_at trigger helper ──────────────────────────────────────────────────
-- (only for connectivity_events since heartbeats are append-only)
CREATE OR REPLACE FUNCTION set_drv_conn_resolved()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.resolved_at = now(); RETURN NEW; END; $$;

-- ── Cleanup RPCs ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_driver_heartbeats(days_to_keep INT DEFAULT 3)
RETURNS INT LANGUAGE sql SECURITY DEFINER AS $$
  WITH d AS (
    DELETE FROM driver_app_heartbeats
    WHERE recorded_at < now() - INTERVAL '1 day' * days_to_keep
    RETURNING id
  ) SELECT COUNT(*)::INT FROM d;
$$;

CREATE OR REPLACE FUNCTION prune_driver_connectivity_events(days_to_keep INT DEFAULT 30)
RETURNS INT LANGUAGE sql SECURITY DEFINER AS $$
  WITH d AS (
    DELETE FROM driver_connectivity_events
    WHERE detected_at < now() - INTERVAL '1 day' * days_to_keep
    RETURNING id
  ) SELECT COUNT(*)::INT FROM d;
$$;

-- ── RLS: heartbeats ────────────────────────────────────────────────────────────
ALTER TABLE driver_app_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full hb" ON driver_app_heartbeats;
CREATE POLICY "service_role full hb" ON driver_app_heartbeats
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated read hb" ON driver_app_heartbeats;
CREATE POLICY "authenticated read hb" ON driver_app_heartbeats
  FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM mise_staff WHERE user_id = auth.uid()
  ));

-- ── RLS: connectivity_events ───────────────────────────────────────────────────
ALTER TABLE driver_connectivity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full ce" ON driver_connectivity_events;
CREATE POLICY "service_role full ce" ON driver_connectivity_events
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated read ce" ON driver_connectivity_events;
CREATE POLICY "authenticated read ce" ON driver_connectivity_events
  FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM mise_staff WHERE user_id = auth.uid()
  ));

-- ── View: current connectivity state per driver ────────────────────────────────
CREATE OR REPLACE VIEW v_driver_connectivity_state AS
SELECT
  d.id                                                AS driver_id,
  d.location_id,
  d.name                                              AS driver_name,
  d.vehicle_type,
  d.is_online,
  MAX(h.recorded_at)                                  AS last_heartbeat_at,
  EXTRACT(EPOCH FROM (now() - MAX(h.recorded_at)))/60 AS minutes_since_heartbeat,
  MIN(h.battery_pct)                                  AS battery_pct,
  CASE
    WHEN MAX(h.recorded_at) IS NULL THEN 'unknown'
    WHEN now() - MAX(h.recorded_at) < INTERVAL '5 minutes' THEN 'connected'
    WHEN now() - MAX(h.recorded_at) < INTERVAL '15 minutes' THEN 'degraded'
    ELSE 'offline'
  END                                                 AS connectivity_status
FROM mise_drivers d
LEFT JOIN driver_app_heartbeats h
  ON h.driver_id = d.id AND h.recorded_at > now() - INTERVAL '1 hour'
WHERE d.active = true
GROUP BY d.id, d.location_id, d.name, d.vehicle_type, d.is_online;
