-- Migration 008: Fehlende Spalten — Tour-Optimizer + Dispatch-Engine
--
-- Problem: tour-optimizer.ts schreibt polyline/total_distance_km/total_eta_min
-- in mise_delivery_batches, und dispatch-engine.ts liest max_radius_km aus
-- mise_drivers — beide Spalten fehlen in allen vorherigen Migrationen.
-- Ohne diese Spalten schlägt PostgREST mit "column not found" fehl, was den
-- gesamten Dispatch-Loop lautlos zum Stillstand bringt.
--
-- Außerdem: customer_orders.mise_batch_id / mise_driver_id werden vom
-- Smart-Dispatch geschrieben (FK zu mise_*). Mit IF NOT EXISTS sicher.

-- ============================================================
-- 1. mise_delivery_batches: Route-Ergebnis-Felder
--    Geschrieben von tour-optimizer.ts → optimizeTour()
-- ============================================================
ALTER TABLE mise_delivery_batches
  ADD COLUMN IF NOT EXISTS polyline           text,
  ADD COLUMN IF NOT EXISTS total_distance_km  numeric(8,2),
  ADD COLUMN IF NOT EXISTS total_eta_min      int;

COMMENT ON COLUMN mise_delivery_batches.polyline IS
  'Encoded Google Maps Polyline der optimierten Tour-Route.';
COMMENT ON COLUMN mise_delivery_batches.total_distance_km IS
  'Gesamte Streckenlänge der optimierten Tour in km.';
COMMENT ON COLUMN mise_delivery_batches.total_eta_min IS
  'Geschätzte Gesamtfahrzeit der Tour in Minuten (inkl. aller Stops).';

-- ============================================================
-- 2. mise_drivers: Dispatch-relevante Felder
--    Gelesen von dispatch-engine.ts → loadActiveDrivers()
--    + scoring.ts → scoreHistory() / scoreZone()
-- ============================================================
ALTER TABLE mise_drivers
  ADD COLUMN IF NOT EXISTS max_radius_km     numeric(5,1) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS rating            numeric(3,2),
  ADD COLUMN IF NOT EXISTS avg_delivery_min  int,
  ADD COLUMN IF NOT EXISTS zone              text;

COMMENT ON COLUMN mise_drivers.max_radius_km IS
  'Maximaler Lieferradius des Fahrers in km (Standard: 10 km). '
  'Fahrer wird bei Radius-Filter in dispatch-engine ausgeschlossen wenn '
  'Distanz Fahrer→Restaurant > max_radius_km.';
COMMENT ON COLUMN mise_drivers.rating IS
  'Fahrer-Bewertung 0–5 (aggregiert aus Kundenfeedback). '
  'Fließt in scoreHistory() ein.';
COMMENT ON COLUMN mise_drivers.avg_delivery_min IS
  'Durchschnittliche Lieferzeit des Fahrers in Minuten. '
  'Fließt in scoreHistory() ein.';
COMMENT ON COLUMN mise_drivers.zone IS
  'Aktuelle Lieferzone des Fahrers (A/B/C/D). '
  'Wird via GPS-Position + Zone-Tabelle gesetzt. '
  'Fließt in scoreZone() ein.';

-- ============================================================
-- 3. customer_orders: Smart-Dispatch-Verknüpfungen
--    IF NOT EXISTS: können im Frank-Basis-Schema bereits existieren.
--    FK erst nach ADD COLUMN (PostgreSQL-Syntax).
-- ============================================================
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS mise_batch_id  uuid,
  ADD COLUMN IF NOT EXISTS mise_driver_id uuid;

-- FK nur setzen wenn nicht schon gesetzt (idempotent via DO-Block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'customer_orders_mise_batch_id_fkey'
      AND table_name = 'customer_orders'
  ) THEN
    ALTER TABLE customer_orders
      ADD CONSTRAINT customer_orders_mise_batch_id_fkey
      FOREIGN KEY (mise_batch_id) REFERENCES mise_delivery_batches(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'customer_orders_mise_driver_id_fkey'
      AND table_name = 'customer_orders'
  ) THEN
    ALTER TABLE customer_orders
      ADD CONSTRAINT customer_orders_mise_driver_id_fkey
      FOREIGN KEY (mise_driver_id) REFERENCES mise_drivers(id) ON DELETE SET NULL;
  END IF;
END;
$$;

COMMENT ON COLUMN customer_orders.mise_batch_id IS
  'FK auf mise_delivery_batches — gesetzt vom Smart-Dispatch.';
COMMENT ON COLUMN customer_orders.mise_driver_id IS
  'FK auf mise_drivers — gesetzt vom Smart-Dispatch (auch bei Bundle).';

-- ============================================================
-- 4. Performance-Indizes
-- ============================================================

-- Dispatch-Queue: offene Lieferbestellungen ohne Batch-Zuweisung
-- Ersetzt den alten idx_orders_unassigned_delivery aus Migration 003
-- (der filterte nur mise_batch_id IS NULL, nicht den status)
CREATE INDEX IF NOT EXISTS idx_orders_pending_dispatch
  ON customer_orders (location_id, created_at ASC)
  WHERE typ = 'lieferung'
    AND mise_batch_id IS NULL
    AND status IN ('neu', 'in_zubereitung', 'fertig');

-- Fahrer: schnelle Suche nach max_radius_km (für Radius-Vorfilter)
CREATE INDEX IF NOT EXISTS idx_drivers_radius_active
  ON mise_drivers (max_radius_km, active, state)
  WHERE active = true;

-- mise_delivery_batches: Tour-Suche nach total_distance für Analytics
CREATE INDEX IF NOT EXISTS idx_batches_distance
  ON mise_delivery_batches (total_distance_km)
  WHERE total_distance_km IS NOT NULL;

-- ============================================================
-- 5. update_driver_zone() Trigger
--    Setzt mise_drivers.zone automatisch wenn GPS-Position aktualisiert wird.
--    Nutzt delivery_zones-Konfiguration der zugehörigen Location.
--    Fällt zurück auf Haversine-Schätzung wenn keine Zone-Config vorhanden.
-- ============================================================
CREATE OR REPLACE FUNCTION update_driver_zone()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_zone text := 'B'; -- Fallback
  v_dist numeric;
  v_loc  record;
BEGIN
  -- Nur wenn Position tatsächlich geändert
  IF NEW.last_lat IS NULL OR NEW.last_lng IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.last_lat = NEW.last_lat AND OLD.last_lng = NEW.last_lng THEN
    RETURN NEW;
  END IF;

  -- Nächste Location des Fahrers finden (über aktiven Batch → Location)
  SELECT l.lat, l.lng, l.id INTO v_loc
  FROM mise_delivery_batches b
  JOIN mise_delivery_batch_stops s ON s.batch_id = b.id AND s.type = 'pickup'
  JOIN customer_orders co ON co.id = s.order_id
  JOIN locations l ON l.id = co.location_id
  WHERE b.driver_id = NEW.id
    AND b.state IN ('pending_acceptance','assigned','at_restaurant','on_route')
  ORDER BY b.created_at DESC
  LIMIT 1;

  IF v_loc IS NULL THEN
    RETURN NEW;
  END IF;

  -- Distanz Fahrer → Restaurant in km (Haversine)
  v_dist := 2 * 6371 * asin(sqrt(
    power(sin(radians(NEW.last_lat - v_loc.lat) / 2), 2) +
    cos(radians(v_loc.lat)) * cos(radians(NEW.last_lat)) *
    power(sin(radians(NEW.last_lng - v_loc.lng) / 2), 2)
  ));

  -- Zone aus delivery_zones für diese Location
  SELECT name INTO v_zone
  FROM delivery_zones
  WHERE location_id = v_loc.id
    AND active = true
    AND v_dist >= min_km
    AND v_dist  < max_km
  ORDER BY min_km
  LIMIT 1;

  IF v_zone IS NULL THEN
    -- Fallback auf Distanz-Heuristik
    v_zone := CASE
      WHEN v_dist < 3  THEN 'A'
      WHEN v_dist < 6  THEN 'B'
      WHEN v_dist < 10 THEN 'C'
      ELSE 'D'
    END;
  END IF;

  NEW.zone := v_zone;
  RETURN NEW;
END;
$$;

-- Trigger nur auf mise_drivers, wenn last_lat/last_lng vorhanden
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mise_drivers'
      AND column_name IN ('last_lat', 'last_lng')
    HAVING COUNT(*) = 2
  ) THEN
    DROP TRIGGER IF EXISTS trg_update_driver_zone ON mise_drivers;
    CREATE TRIGGER trg_update_driver_zone
      BEFORE UPDATE OF last_lat, last_lng ON mise_drivers
      FOR EACH ROW EXECUTE FUNCTION update_driver_zone();
  END IF;
END;
$$;

COMMENT ON FUNCTION update_driver_zone IS
  'Setzt mise_drivers.zone automatisch wenn last_lat/last_lng aktualisiert wird. '
  'Zone fließt in scoring.ts → scoreZone() ein und verbessert die Fahrer-Auswahl '
  'bei Rush-Hours (Fahrer in Zone A bekommt Zone-A-Bestellungen bevorzugt).';
