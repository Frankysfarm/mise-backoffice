-- Migration 133: Tour-Abschluss-Analyse Views
-- Ergänzt Phase 259: per-Stop ETA-Abweichung + Admin-Übersicht abgeschlossener Touren.
-- Nutzt bestehende Tabellen: mise_delivery_batches, mise_delivery_batch_stops,
-- customer_orders, tour_performance_snapshots, mise_drivers.

-- ── View: v_tour_stop_deviations ─────────────────────────────────────────────
-- Pro Stop: geplante ETA vs. tatsächliche Lieferzeit, Abweichung in Minuten.
-- Nur Dropoff-Stops werden ausgewertet (Pickup-Stops haben keine ETA-Deadline).

CREATE OR REPLACE VIEW v_tour_stop_deviations AS
SELECT
  s.id                                          AS stop_id,
  s.batch_id,
  b.location_id,
  b.driver_id,
  s.order_id,
  s.sequence,
  s.type                                        AS stop_type,
  s.address,
  s.lat,
  s.lng,
  s.arrived_at,
  s.completed_at,
  o.eta_latest,
  o.bestellnummer,
  o.kunde_name,
  o.delivery_zone                               AS zone,
  o.tip_eur,
  CASE
    WHEN s.completed_at IS NOT NULL AND o.eta_latest IS NOT NULL AND s.type = 'dropoff'
    THEN ROUND(
      EXTRACT(EPOCH FROM (s.completed_at::timestamptz - o.eta_latest::timestamptz)) / 60.0
    )::int
    ELSE NULL
  END                                           AS deviation_min,
  CASE
    WHEN s.completed_at IS NOT NULL AND o.eta_latest IS NOT NULL AND s.type = 'dropoff'
    THEN s.completed_at::timestamptz <= o.eta_latest::timestamptz
    ELSE NULL
  END                                           AS on_time,
  b.state                                       AS batch_state,
  b.created_at                                  AS batch_created_at
FROM mise_delivery_batch_stops s
JOIN mise_delivery_batches b ON b.id = s.batch_id
LEFT JOIN customer_orders   o ON o.id = s.order_id;

COMMENT ON VIEW v_tour_stop_deviations IS
  'Phase 259 — Pro-Stop ETA-Abweichung für abgeschlossene Touren. '
  'deviation_min > 0 = zu spät, < 0 = zu früh. Nur dropoff-Stops haben on_time.';

-- ── View: v_completed_tour_summary ───────────────────────────────────────────
-- Abgeschlossene Touren mit aggregierten Stats für Admin-Übersicht.
-- Greift auf tour_performance_snapshots zurück (berechnet in Phase 115).

CREATE OR REPLACE VIEW v_completed_tour_summary AS
SELECT
  b.id                                          AS batch_id,
  b.location_id,
  b.driver_id,
  d.name                                        AS driver_name,
  d.vehicle                                     AS vehicle_type,
  b.zone,
  b.state,
  b.created_at,
  snap.planned_stops,
  snap.actual_stops,
  snap.on_time_stops,
  snap.late_stops,
  snap.total_route_km,
  snap.actual_delivery_min,
  snap.bundle_efficiency_score,
  snap.first_pickup_at,
  snap.last_delivery_at,
  snap.completed_at                             AS snapshot_at,
  CASE
    WHEN snap.actual_stops > 0
    THEN ROUND((snap.on_time_stops::numeric / snap.actual_stops) * 100)
    ELSE NULL
  END                                           AS on_time_pct
FROM mise_delivery_batches b
JOIN tour_performance_snapshots snap ON snap.batch_id = b.id
LEFT JOIN mise_drivers d ON d.id = b.driver_id;

COMMENT ON VIEW v_completed_tour_summary IS
  'Phase 259 — Admin-Übersicht abgeschlossener Touren mit aggregierten Performance-Stats.';
