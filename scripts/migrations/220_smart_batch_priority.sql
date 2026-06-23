-- Migration 220: Smart Batch Priority Indexes
-- Phase 472 — Smart-Batch-Priorisierung
-- Optimiert Abfragen für die Batch-Priorisierungs-Engine

-- Index für offene Batches je Location (Hauptabfrage der Priority-Engine)
CREATE INDEX IF NOT EXISTS idx_delivery_batches_location_open_status
  ON delivery_batches (location_id, status, created_at ASC)
  WHERE status IN ('offen', 'bereit', 'pending', 'assigned', 'pickup');

-- Index für Batch-Stop-Count Aggregation
CREATE INDEX IF NOT EXISTS idx_tour_stops_batch_id
  ON tour_stops (batch_id);

-- Kommentar
COMMENT ON INDEX idx_delivery_batches_location_open_status IS
  'Phase 472: Smart-Batch-Priorisierung — schnelle Abfrage offener Batches je Standort';
