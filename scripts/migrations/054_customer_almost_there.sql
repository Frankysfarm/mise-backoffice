-- Migration 054: customer_delivery_events — Index für driver_almost_there Dedup-Queries
-- Phase 90: 2-Minuten Push-Trigger "Fahrer fast da"
--
-- Das `driver_almost_there`-Event wird genau einmal pro Bestellung gesendet.
-- checkAlmostThereProximity() prüft via:
--   SELECT id FROM customer_delivery_events
--   WHERE order_id = $1 AND event_type = 'driver_almost_there'
-- Dieser zusammengesetzte Index beschleunigt den Dedup-Lookup erheblich.

CREATE INDEX IF NOT EXISTS idx_cde_order_event
  ON customer_delivery_events (order_id, event_type);

COMMENT ON INDEX idx_cde_order_event IS
  'Dedup-Lookup für checkAlmostThereProximity: order_id + event_type — Phase 90';
