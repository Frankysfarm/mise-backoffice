-- Migration 003: delivery_indexes
-- Performance-Indizes für Smart-Delivery-Abfragen.

-- Schnellere Tour-Suche nach Status + Driver
CREATE INDEX IF NOT EXISTS idx_batches_driver_state
  ON mise_delivery_batches (driver_id, state)
  WHERE state NOT IN ('delivered', 'cancelled');

-- Orders ohne Batch (unzugewiesene Lieferungen)
CREATE INDEX IF NOT EXISTS idx_orders_unassigned_delivery
  ON customer_orders (location_id, created_at)
  WHERE typ = 'lieferung' AND mise_batch_id IS NULL;

-- Aktive Fahrer-Suche (online/auf_tour)
CREATE INDEX IF NOT EXISTS idx_drivers_active
  ON mise_drivers (active, state, last_position_at)
  WHERE active = true;

-- Kitchen-Timing nach Cook-Start (für Küchen-Dashboard)
CREATE INDEX IF NOT EXISTS idx_kitchen_timings_cook_start
  ON kitchen_timings (location_id, cook_start_at)
  WHERE status IN ('scheduled', 'cooking');
