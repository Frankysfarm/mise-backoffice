-- Migration 029: Driver GPS Trail Tracking + Geofencing Engine
--
-- Zweck:
--  1. driver_gps_trail       — Kontinuierliche GPS-Breadcrumbs pro Fahrer-Tour
--  2. driver_geofence_events — Automatisch erkannte Ankunfts-/Abfahrts-Ereignisse
--  3. v_driver_last_gps      — Letzter bekannter GPS-Punkt pro Fahrer
--  4. v_active_driver_trails — Aktive Fahrerspuren für Dispatch-Karte (letzte 30 Min)
--  5. cleanup_old_gps_trails — Bereinigungsfunktion für Cron-Job

-- ── 1. GPS-Trail-Tabelle ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_gps_trail (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id     UUID        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id   UUID        NOT NULL,
  batch_id      UUID        REFERENCES mise_delivery_batches(id) ON DELETE SET NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  accuracy_m    REAL,
  speed_kmh     REAL,
  heading_deg   SMALLINT,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_gps_lat CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT chk_gps_lng CHECK (lng BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_gps_trail_driver_time
  ON driver_gps_trail(driver_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_gps_trail_location_time
  ON driver_gps_trail(location_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_gps_trail_batch
  ON driver_gps_trail(batch_id)
  WHERE batch_id IS NOT NULL;

-- ── 2. Geofence-Events-Tabelle ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_geofence_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      UUID        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id    UUID        NOT NULL,
  batch_id       UUID        REFERENCES mise_delivery_batches(id) ON DELETE SET NULL,
  event_type     TEXT        NOT NULL,   -- arrived_restaurant | arrived_customer | departed_restaurant
  order_id       UUID        REFERENCES customer_orders(id) ON DELETE SET NULL,
  lat            DOUBLE PRECISION NOT NULL,
  lng            DOUBLE PRECISION NOT NULL,
  distance_m     REAL,                   -- Distanz zum Ziel in Metern
  triggered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_processed BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_geofence_driver_time
  ON driver_geofence_events(driver_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_geofence_batch
  ON driver_geofence_events(batch_id)
  WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_geofence_location_time
  ON driver_geofence_events(location_id, triggered_at DESC);

-- ── 3. View: letzter GPS-Punkt pro Fahrer ─────────────────────────────────────

CREATE OR REPLACE VIEW v_driver_last_gps AS
SELECT DISTINCT ON (t.driver_id)
  t.driver_id,
  t.location_id,
  t.batch_id,
  t.lat,
  t.lng,
  t.accuracy_m,
  t.speed_kmh,
  t.heading_deg,
  t.recorded_at,
  d.name       AS driver_name,
  d.state      AS driver_state,
  d.vehicle    AS vehicle
FROM driver_gps_trail t
JOIN mise_drivers d ON d.id = t.driver_id
ORDER BY t.driver_id, t.recorded_at DESC;

-- ── 4. View: aktive Fahrerspuren (letzte 30 Min, für Dispatch-Karte) ──────────
--  Gibt bis zu 60 Trail-Punkte pro Fahrer zurück, neuste zuerst.

CREATE OR REPLACE VIEW v_active_driver_trails AS
SELECT
  d.id          AS driver_id,
  d.name        AS driver_name,
  d.state       AS driver_state,
  d.vehicle     AS vehicle,
  d.location_id AS location_id,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'lat', t.lat,
          'lng', t.lng,
          'speed_kmh', t.speed_kmh,
          'recorded_at', t.recorded_at
        ) ORDER BY t.recorded_at
      )
      FROM (
        SELECT lat, lng, speed_kmh, recorded_at
        FROM driver_gps_trail
        WHERE driver_id = d.id
          AND recorded_at > now() - INTERVAL '30 minutes'
        ORDER BY recorded_at DESC
        LIMIT 60
      ) t
    ),
    '[]'::json
  ) AS trail_points
FROM mise_drivers d
WHERE d.state NOT IN ('offline');

-- ── 5. Cleanup-Funktion ───────────────────────────────────────────────────────
--  Wird durch Cron aufgerufen: täglich oder stündlich.

CREATE OR REPLACE FUNCTION cleanup_old_gps_trails()
RETURNS TABLE(deleted_trail_rows BIGINT, deleted_geofence_rows BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trail   BIGINT;
  v_geofence BIGINT;
BEGIN
  DELETE FROM driver_gps_trail
  WHERE recorded_at < now() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_trail = ROW_COUNT;

  DELETE FROM driver_geofence_events
  WHERE triggered_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS v_geofence = ROW_COUNT;

  RETURN QUERY SELECT v_trail, v_geofence;
END;
$$;

-- ── 6. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE driver_gps_trail      ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_geofence_events ENABLE ROW LEVEL SECURITY;

-- Service Role: vollständiger Zugriff
CREATE POLICY "service_role_all_gps_trail"
  ON driver_gps_trail FOR ALL TO service_role USING (true);

CREATE POLICY "service_role_all_geofence_events"
  ON driver_geofence_events FOR ALL TO service_role USING (true);

-- Authentifizierte Mitarbeiter: Lesen für eigene Location
CREATE POLICY "authenticated_read_gps_trail"
  ON driver_gps_trail FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "authenticated_read_geofence_events"
  ON driver_geofence_events FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE user_id = auth.uid()
    )
  );
