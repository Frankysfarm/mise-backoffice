-- Migration 010: location_id auf mise_delivery_batches
--
-- Problem: mise_delivery_batches hat keine direkte location_id-Spalte.
-- Das führt zu Multi-Tenant-Bugs: /api/delivery/tours und /api/delivery/stats
-- liefern Touren aus ALLEN Locations, nicht nur der angefragten.
--
-- Fix:
--  1. location_id-Spalte hinzufügen
--  2. Bestehende Zeilen via stops → customer_orders → location backfüllen
--  3. Index für performante location_id-Abfragen
--  4. dispatch_engine setzt location_id beim Erstellen neuer Batches
--     (Code-Änderung in dispatch-engine.ts)

-- ============================================================
-- 1. location_id-Spalte hinzufügen
-- ============================================================
ALTER TABLE mise_delivery_batches
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE CASCADE;

COMMENT ON COLUMN mise_delivery_batches.location_id IS
  'Location (Restaurant), zu der diese Tour gehört. '
  'Wird beim Erstellen durch dispatch-engine gesetzt. '
  'Backfill via stops → customer_orders → location_id. '
  'Ermöglicht Multi-Tenant-Filterung ohne JOIN.';

-- ============================================================
-- 2. Backfill bestehender Zeilen
--    Nimmt location_id aus dem ersten Dropoff-Stop via customer_orders
-- ============================================================
UPDATE mise_delivery_batches mdb
SET location_id = (
  SELECT co.location_id
  FROM mise_delivery_batch_stops s
  JOIN customer_orders co ON co.id = s.order_id
  WHERE s.batch_id = mdb.id
    AND s.type = 'dropoff'
  ORDER BY s.sequence ASC
  LIMIT 1
)
WHERE mdb.location_id IS NULL;

-- ============================================================
-- 3. Performance-Indizes
-- ============================================================

-- Hauptindex: Location + State + Zeit (Admin-Dashboard, Tours-Liste)
CREATE INDEX IF NOT EXISTS idx_mise_batches_location_state
  ON mise_delivery_batches (location_id, state, created_at DESC)
  WHERE location_id IS NOT NULL;

-- Stats-Index: Location + Zeitraum (für /api/delivery/stats)
CREATE INDEX IF NOT EXISTS idx_mise_batches_location_created
  ON mise_delivery_batches (location_id, created_at DESC)
  WHERE location_id IS NOT NULL;

-- ============================================================
-- 4. Trigger: location_id automatisch aus erstem Stop setzen
--    Fallback für Batches die ohne location_id angelegt werden
-- ============================================================
CREATE OR REPLACE FUNCTION set_batch_location_from_stop()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_location_id uuid;
BEGIN
  -- Nur wenn batch noch keine location_id hat und Stop ein Dropoff ist
  IF NEW.type = 'dropoff' AND NEW.order_id IS NOT NULL THEN
    SELECT location_id INTO v_location_id
    FROM customer_orders
    WHERE id = NEW.order_id;

    IF v_location_id IS NOT NULL THEN
      UPDATE mise_delivery_batches
      SET location_id = v_location_id
      WHERE id = NEW.batch_id
        AND location_id IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_batch_location_from_stop ON mise_delivery_batch_stops;
CREATE TRIGGER trg_batch_location_from_stop
  AFTER INSERT ON mise_delivery_batch_stops
  FOR EACH ROW EXECUTE FUNCTION set_batch_location_from_stop();

COMMENT ON FUNCTION set_batch_location_from_stop IS
  'Setzt mise_delivery_batches.location_id automatisch beim ersten Dropoff-Stop-Insert. '
  'Sicherheitsnetz falls dispatch-engine location_id nicht explizit setzt.';
