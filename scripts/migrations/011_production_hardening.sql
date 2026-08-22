-- Migration 011: Produktions-Härtung
--
-- 1. cancel_order_from_batch()  — atomisch Bestellung + Stop entfernen, Leer-Batch stornieren
-- 2. mark_stale_drivers_offline() — Fahrer offline stellen wenn kein GPS-Ping seit 30 Min
-- 3. Indizes für Health-Check-Queries (pending orders, stale drivers)

-- ============================================================
-- 1. cancel_order_from_batch(p_order_id)
--    Atomisch: Stop löschen, Batch ggf. stornieren, Order stornieren.
--    Gibt JSON zurück damit der API-Layer weiß, ob Batch leer wurde.
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_order_from_batch(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_batch_id       uuid;
  v_stops_remaining integer := 0;
  v_batch_cancelled boolean  := false;
BEGIN
  -- Batch-ID holen (kann NULL sein — unvermittelte Bestellung)
  SELECT mise_batch_id INTO v_batch_id
  FROM   customer_orders
  WHERE  id = p_order_id;

  IF v_batch_id IS NOT NULL THEN
    -- Stop aus Batch entfernen
    DELETE FROM mise_delivery_batch_stops
    WHERE  batch_id = v_batch_id
      AND  order_id = p_order_id;

    -- Verbleibende Stops zählen
    SELECT COUNT(*) INTO v_stops_remaining
    FROM   mise_delivery_batch_stops
    WHERE  batch_id = v_batch_id;

    -- Leeren Batch stornieren
    IF v_stops_remaining = 0 THEN
      UPDATE mise_delivery_batches
      SET    state      = 'cancelled',
             updated_at = now()
      WHERE  id = v_batch_id
        AND  state NOT IN ('delivered', 'cancelled');
      v_batch_cancelled := true;
    END IF;
  END IF;

  -- Bestellung stornieren + Batch-Referenzen entfernen
  UPDATE customer_orders
  SET    status         = 'storniert',
         mise_batch_id  = NULL,
         mise_driver_id = NULL,
         updated_at     = now()
  WHERE  id = p_order_id
    AND  status NOT IN ('storniert', 'abgeschlossen', 'geliefert');

  RETURN jsonb_build_object(
    'order_id',        p_order_id,
    'batch_id',        v_batch_id,
    'batch_cancelled', v_batch_cancelled,
    'stops_remaining', v_stops_remaining
  );
END;
$$;

COMMENT ON FUNCTION cancel_order_from_batch IS
  'Atomisch: Bestellung aus Batch-Stop entfernen, leeren Batch stornieren, Order auf storniert setzen.';

-- ============================================================
-- 2. mark_stale_drivers_offline()
--    Stellt Fahrer auf offline wenn seit 30 Min kein updated_at-Update.
--    Für Cron (alle 2 Min) + manuelle Bereinigung.
--    Gibt Anzahl betroffener Fahrer zurück.
-- ============================================================
CREATE OR REPLACE FUNCTION mark_stale_drivers_offline()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE mise_drivers
  SET    state      = 'offline',
         active     = false,
         updated_at = now()
  WHERE  state IN ('available', 'on_delivery')
    AND  updated_at < now() - INTERVAL '30 minutes';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

COMMENT ON FUNCTION mark_stale_drivers_offline IS
  'Stellt Fahrer offline wenn seit 30 Min kein updated_at (kein GPS-Ping). Wird im Cron aufgerufen.';

-- ============================================================
-- 3. Indizes für Health-Check + Cancellation-Performance
-- ============================================================

-- Stale-Driver-Erkennung: state + updated_at
CREATE INDEX IF NOT EXISTS idx_mise_drivers_state_updated
  ON mise_drivers (state, updated_at)
  WHERE state IN ('available', 'on_delivery');

-- Pending-Orders ohne Batch (Health-Check + Dispatch-Backlog)
CREATE INDEX IF NOT EXISTS idx_customer_orders_pending_dispatch
  ON customer_orders (location_id, created_at DESC)
  WHERE typ = 'lieferung'
    AND mise_batch_id IS NULL
    AND status NOT IN ('storniert', 'abgeschlossen', 'geliefert');

-- Batch-Stop Lookup für cancel_order_from_batch (Löschen nach order_id + batch_id)
CREATE INDEX IF NOT EXISTS idx_mise_batch_stops_order
  ON mise_delivery_batch_stops (order_id)
  WHERE order_id IS NOT NULL;
