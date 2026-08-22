-- Migration 004: Bridge-Trigger mise → delivery_batches + driver location view
--
-- Zweck: Neue Smart-Dispatch-Batches (mise_delivery_batches) werden automatisch
-- in delivery_batches gespiegelt, damit die Fahrer-PWA und das alte Dispatch-Board
-- sie sehen können. Außerdem: View für live Driver-Positionen.

-- 1. Sicherheitshalber: delivery_batches muss existieren (alter Fahrer-Tisch)
--    Falls Tabelle noch nicht existiert, erstellen wir eine kompatible Variante.
CREATE TABLE IF NOT EXISTS delivery_batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id     uuid REFERENCES mise_drivers(id) ON DELETE SET NULL,
  state         text NOT NULL DEFAULT 'pending_acceptance',
  stop_count    int NOT NULL DEFAULT 0,
  zone          text,
  dispatch_score numeric(5,1),
  mise_batch_id  uuid,            -- Referenz auf Original-Zeile
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_batch_stops (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id   uuid NOT NULL REFERENCES delivery_batches(id) ON DELETE CASCADE,
  order_id   uuid,
  type       text NOT NULL,       -- 'pickup' | 'dropoff'
  sequence   int NOT NULL DEFAULT 0,
  lat        numeric(10,7),
  lng        numeric(10,7),
  address    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Index für schnelle Bridge-Lookups
CREATE INDEX IF NOT EXISTS idx_delivery_batches_mise_id
  ON delivery_batches (mise_batch_id) WHERE mise_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_batches_driver
  ON delivery_batches (driver_id, state);

CREATE INDEX IF NOT EXISTS idx_delivery_batch_stops_batch
  ON delivery_batch_stops (batch_id);

-- 3. Trigger-Funktion: Neue mise_delivery_batch → delivery_batches spiegeln
CREATE OR REPLACE FUNCTION sync_mise_batch_to_legacy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO delivery_batches (id, driver_id, state, stop_count, zone, dispatch_score, mise_batch_id, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      NEW.driver_id,
      NEW.state,
      COALESCE(NEW.stop_count, 0),
      NEW.zone,
      NEW.dispatch_score,
      NEW.id,
      NEW.created_at,
      now()
    )
    ON CONFLICT (mise_batch_id) DO NOTHING;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE delivery_batches
    SET
      driver_id     = NEW.driver_id,
      state         = NEW.state,
      stop_count    = COALESCE(NEW.stop_count, 0),
      dispatch_score = NEW.dispatch_score,
      updated_at    = now()
    WHERE mise_batch_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger erst löschen falls er schon existiert
DROP TRIGGER IF EXISTS trg_sync_mise_batch ON mise_delivery_batches;

CREATE TRIGGER trg_sync_mise_batch
  AFTER INSERT OR UPDATE ON mise_delivery_batches
  FOR EACH ROW EXECUTE FUNCTION sync_mise_batch_to_legacy();

-- 4. Stops spiegeln
CREATE OR REPLACE FUNCTION sync_mise_batch_stop_to_legacy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  legacy_batch_id uuid;
BEGIN
  SELECT id INTO legacy_batch_id
  FROM delivery_batches
  WHERE mise_batch_id = NEW.batch_id
  LIMIT 1;

  IF legacy_batch_id IS NOT NULL THEN
    INSERT INTO delivery_batch_stops (batch_id, order_id, type, sequence, lat, lng, address)
    VALUES (legacy_batch_id, NEW.order_id, NEW.type, NEW.sequence, NEW.lat, NEW.lng, NEW.address)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_mise_batch_stop ON mise_delivery_batch_stops;

CREATE TRIGGER trg_sync_mise_batch_stop
  AFTER INSERT ON mise_delivery_batch_stops
  FOR EACH ROW EXECUTE FUNCTION sync_mise_batch_stop_to_legacy();

-- 5. View: Aktuelle Fahrer-Positionen (jüngste Standortmeldung pro Fahrer)
CREATE OR REPLACE VIEW driver_live_positions AS
SELECT DISTINCT ON (dl.driver_id)
  dl.driver_id,
  d.name                AS driver_name,
  d.vehicle,
  d.state               AS driver_state,
  d.active,
  dl.lat,
  dl.lng,
  dl.accuracy_m,
  dl.heading,
  dl.speed_kmh,
  dl.batch_id,
  dl.recorded_at,
  -- Sekunden seit letztem Update
  EXTRACT(EPOCH FROM (now() - dl.recorded_at))::int AS seconds_stale
FROM mise_driver_locations dl
JOIN mise_drivers d ON d.id = dl.driver_id
ORDER BY dl.driver_id, dl.recorded_at DESC;

COMMENT ON VIEW driver_live_positions IS
  'Jüngste GPS-Position je Fahrer aus mise_driver_locations. '
  'seconds_stale > 120 = Verbindung verloren.';

-- 6. mise_driver_locations: Index für schnelle Live-Queries
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_time
  ON mise_driver_locations (driver_id, recorded_at DESC);

-- Index für batch-basierte Queries
CREATE INDEX IF NOT EXISTS idx_driver_locations_batch
  ON mise_driver_locations (batch_id, recorded_at DESC)
  WHERE batch_id IS NOT NULL;
