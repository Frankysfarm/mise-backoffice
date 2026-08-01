-- Migration 275: Fahrer-Gesamtlieferungen-Ranking (Batch 73, Phase 5480-5483)
-- Index for efficient 30-day completed tour aggregation per driver per location

CREATE INDEX IF NOT EXISTS idx_delivery_tours_driver_location_status_created
  ON delivery_tours (location_id, driver_id, status, created_at)
  WHERE status = 'completed' AND driver_id IS NOT NULL;

-- View: fahrer_gesamtlieferungen_30d
-- Aggregates completed tour count per driver in the last 30 days
CREATE OR REPLACE VIEW fahrer_gesamtlieferungen_30d AS
SELECT
  location_id,
  driver_id,
  driver_name,
  COUNT(*) AS gesamt_lieferungen
FROM delivery_tours
WHERE
  status      = 'completed'
  AND driver_id IS NOT NULL
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY location_id, driver_id, driver_name;

COMMENT ON VIEW fahrer_gesamtlieferungen_30d IS
  'Gesamtanzahl abgeschlossener Lieferungen je Fahrer in den letzten 30 Tagen (Batch 73, Phase 5480-5483)';
