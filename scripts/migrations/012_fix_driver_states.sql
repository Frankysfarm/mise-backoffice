-- Migration 012: Driver-State-Fixes
--
-- Hintergrund: Migration 011 verwendete falsche State-Namen für mise_drivers.
-- Tatsächliche States (gesetzt von driver-app/me/online und driver-app/orders/):
--   offline | idle | assigned | at_restaurant | en_route | returning
--
-- Migration 011 nutzte 'available' und 'on_delivery' — diese States
-- existieren im mise_drivers-Schema nicht und kommen nie vor.
-- Folge: mark_stale_drivers_offline() bereinigt nie stale Fahrer,
-- und der Index idx_mise_drivers_state_updated matcht keine Zeilen.
--
-- Fixes:
--  1. mark_stale_drivers_offline() — korrekte State-Namen
--  2. idx_mise_drivers_state_updated — Index mit korrekten States neu erstellen

-- ============================================================
-- 1. mark_stale_drivers_offline() — korrekte State-Namen
-- ============================================================
CREATE OR REPLACE FUNCTION mark_stale_drivers_offline()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  affected integer;
BEGIN
  -- Fahrer, die seit 30 Min keine GPS/Activity-Aktualisierung hatten,
  -- werden offline gestellt. Gilt für alle aktiven States.
  UPDATE mise_drivers
  SET    state      = 'offline',
         active     = false,
         updated_at = now()
  WHERE  state IN ('idle', 'assigned', 'at_restaurant', 'en_route', 'returning')
    AND  updated_at < now() - INTERVAL '30 minutes';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

COMMENT ON FUNCTION mark_stale_drivers_offline IS
  'Stellt Fahrer offline wenn seit 30 Min kein updated_at-Update (kein GPS-Ping). '
  'States: idle | assigned | at_restaurant | en_route | returning → offline. '
  'Wird im Cron aufgerufen (jede 2 Min).';

-- ============================================================
-- 2. Index mit korrekten State-Namen neu erstellen
-- ============================================================
DROP INDEX IF EXISTS idx_mise_drivers_state_updated;

CREATE INDEX IF NOT EXISTS idx_mise_drivers_state_updated
  ON mise_drivers (state, updated_at)
  WHERE state IN ('idle', 'assigned', 'at_restaurant', 'en_route', 'returning');

COMMENT ON INDEX idx_mise_drivers_state_updated IS
  'Beschleunigt mark_stale_drivers_offline() und Driver-Pool-Abfragen im Dispatch.';

-- ============================================================
-- 3. Index für Dispatch-Pool-Abfragen (loadActiveDrivers)
--    Fehlte bisher: aktive Fahrer nach active + state + last_position_at
-- ============================================================
DROP INDEX IF EXISTS idx_mise_drivers_active_state;

CREATE INDEX IF NOT EXISTS idx_mise_drivers_active_state
  ON mise_drivers (active, state, last_position_at DESC)
  WHERE active = true;

COMMENT ON INDEX idx_mise_drivers_active_state IS
  'Dispatch-Engine loadActiveDrivers(): schnelles Filtern aktiver Fahrer.';
