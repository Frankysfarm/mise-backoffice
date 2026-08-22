-- Migration 021: Autonomous Recovery Engine
-- Tracks recovery events when a batch is cancelled mid-delivery.
-- Orders in cancelled batches are automatically liberated and re-queued.

-- ---------------------------------------------------------------
-- 1. delivery_recovery_events
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_recovery_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       text        NOT NULL,
  cancelled_batch_id uuid       NOT NULL,
  driver_id         uuid        NULL,           -- driver who cancelled (if known)
  reason            text        NULL,           -- 'driver_cancelled' | 'driver_offline' | 'manual' | ...
  orders_recovered  int         NOT NULL DEFAULT 0,
  orders_requeued   int         NOT NULL DEFAULT 0,
  recovery_batch_ids uuid[]     NOT NULL DEFAULT '{}',  -- new batch(es) created
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz NULL,
  error             text        NULL
);

CREATE INDEX IF NOT EXISTS idx_recovery_events_location
  ON delivery_recovery_events (location_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_recovery_events_batch
  ON delivery_recovery_events (cancelled_batch_id);

-- ---------------------------------------------------------------
-- 2. customer_orders: recovery tracking columns
-- ---------------------------------------------------------------
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS recovery_count       int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_recovery_at     timestamptz NULL;

-- ---------------------------------------------------------------
-- 3. Convenience view for admin
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW v_recovery_summary AS
SELECT
  re.id,
  re.location_id,
  re.cancelled_batch_id,
  re.driver_id,
  re.reason,
  re.orders_recovered,
  re.orders_requeued,
  re.recovery_batch_ids,
  re.started_at,
  re.completed_at,
  EXTRACT(EPOCH FROM (re.completed_at - re.started_at))::int AS duration_sec,
  re.error,
  d.name AS driver_name,
  d.vehicle AS driver_vehicle
FROM delivery_recovery_events re
LEFT JOIN mise_drivers d ON d.id = re.driver_id;

-- ---------------------------------------------------------------
-- 4. Index for fast re-queue scan
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customer_orders_recovery
  ON customer_orders (location_id, recovery_count)
  WHERE mise_batch_id IS NULL AND typ = 'lieferung';
