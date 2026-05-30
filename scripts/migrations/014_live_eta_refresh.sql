-- Migration 014: Live ETA Refresh — Performance-Indices
--
-- Zweck: Optimiert den 2-Min-Cron-Tick für refreshEnRouteEtas().
-- Der Cron liest alle `on_route`-Batches + deren Stops + Fahrer-GPS.
-- Ohne Indices führt jede 2-Min-Ausführung zu Seq-Scans.

-- ============================================================
-- 1. Index: on_route Batches schnell finden
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_mise_batches_state_driver
  ON mise_delivery_batches (state, driver_id)
  WHERE state = 'on_route';

COMMENT ON INDEX idx_mise_batches_state_driver IS
  'Beschleunigt refreshEnRouteEtas(): Sucht alle on_route Batches inkl. driver_id.';

-- ============================================================
-- 2. Index: Batch-Stops in Sequenz-Reihenfolge
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_mise_batch_stops_batch_seq
  ON mise_delivery_batch_stops (batch_id, sequence ASC);

COMMENT ON INDEX idx_mise_batch_stops_batch_seq IS
  'Beschleunigt Stop-Reihenfolge-Abfragen im ETA-Refresh-Cron.';

-- ============================================================
-- 3. Index: customer_orders ETA-Update per ID
--    (PK-Index reicht eigentlich — explizit als Dokumentation)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_customer_orders_eta_fields
  ON customer_orders (id)
  INCLUDE (eta_earliest, eta_latest, status, delivery_zone)
  WHERE typ = 'lieferung';

COMMENT ON INDEX idx_customer_orders_eta_fields IS
  'Covering-Index für ETA-Refresh: liest status/delivery_zone, schreibt eta_earliest/eta_latest.';

-- ============================================================
-- 4. v_en_route_summary — Admin-View für aktive Lieferungen
--    Zeigt alle on_route Batches mit GPS-Alter und Lieferstatus
-- ============================================================
CREATE OR REPLACE VIEW v_en_route_summary AS
SELECT
  b.id                                                          AS batch_id,
  b.location_id,
  b.state,
  b.stop_count,
  d.id                                                          AS driver_id,
  d.name                                                        AS driver_name,
  d.vehicle,
  d.last_lat,
  d.last_lng,
  EXTRACT(EPOCH FROM (now() - d.last_position_at)) / 60        AS gps_age_min,
  COUNT(s.id) FILTER (WHERE s.type = 'dropoff')                AS total_dropoffs,
  COUNT(s.id) FILTER (
    WHERE s.type = 'dropoff'
      AND co.status IN ('geliefert','abgeschlossen')
  )                                                             AS completed_dropoffs,
  MIN(co.eta_earliest) FILTER (
    WHERE s.type = 'dropoff'
      AND co.status NOT IN ('geliefert','abgeschlossen','storniert')
  )                                                             AS next_eta_earliest,
  b.created_at                                                  AS tour_started_at
FROM mise_delivery_batches b
JOIN mise_drivers d
  ON d.id = b.driver_id
LEFT JOIN mise_delivery_batch_stops s
  ON s.batch_id = b.id
LEFT JOIN customer_orders co
  ON co.id = s.order_id
WHERE b.state = 'on_route'
GROUP BY b.id, b.location_id, b.state, b.stop_count,
         d.id, d.name, d.vehicle, d.last_lat, d.last_lng, d.last_position_at,
         b.created_at;

COMMENT ON VIEW v_en_route_summary IS
  'Live-Überblick aller on_route Touren: GPS-Alter, Lieferstatus, nächste ETA.';
