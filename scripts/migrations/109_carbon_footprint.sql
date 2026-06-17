-- 109_carbon_footprint.sql
-- Phase 212: Smart Delivery Carbon Footprint Engine
-- Daily CO₂ tracking per location and per driver based on vehicle type × route km.
-- CO₂ rates match the frontend TourCo2Tracker (kg per km):
--   fahrrad 0.000 · lastenrad 0.005 · ebike 0.012 · moped 0.065
--   motorrad 0.103 · auto/car/default 0.168 (baseline)

-- ── delivery_co2_snapshots ────────────────────────────────────────────────────
-- One row per location per day.
CREATE TABLE IF NOT EXISTS delivery_co2_snapshots (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  snapshot_date    date        NOT NULL,
  total_co2_kg     numeric(10,3) NOT NULL DEFAULT 0,   -- actual CO₂ emitted
  co2_saved_kg     numeric(10,3) NOT NULL DEFAULT 0,   -- vs. all-car baseline
  total_tours      integer     NOT NULL DEFAULT 0,
  eco_tours        integer     NOT NULL DEFAULT 0,     -- non-car tours
  total_distance_km numeric(10,2) NOT NULL DEFAULT 0,
  avg_co2_per_tour numeric(8,3) NOT NULL DEFAULT 0,
  eco_rate_pct     numeric(5,1) NOT NULL DEFAULT 0,    -- eco_tours / total_tours * 100
  trees_equivalent numeric(8,2) NOT NULL DEFAULT 0,   -- co2_saved_kg / 21.77 kg/tree/yr
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_co2_snapshots_location_date
  ON delivery_co2_snapshots (location_id, snapshot_date DESC);

ALTER TABLE delivery_co2_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON delivery_co2_snapshots FOR ALL TO service_role USING (true);

-- ── driver_co2_snapshots ──────────────────────────────────────────────────────
-- One row per driver per day — 30-day retention.
CREATE TABLE IF NOT EXISTS driver_co2_snapshots (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id        uuid        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  snapshot_date    date        NOT NULL,
  vehicle_type     text        NOT NULL DEFAULT 'auto',
  tours            integer     NOT NULL DEFAULT 0,
  distance_km      numeric(10,2) NOT NULL DEFAULT 0,
  co2_kg           numeric(10,3) NOT NULL DEFAULT 0,
  co2_saved_kg     numeric(10,3) NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_driver_co2_location_date
  ON driver_co2_snapshots (location_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_driver_co2_driver_date
  ON driver_co2_snapshots (driver_id, snapshot_date DESC);

ALTER TABLE driver_co2_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON driver_co2_snapshots FOR ALL TO service_role USING (true);

-- ── v_co2_driver_leaderboard ──────────────────────────────────────────────────
-- 30-day cumulative CO₂ stats per driver — sorted by most CO₂ saved (eco champions).
CREATE OR REPLACE VIEW v_co2_driver_leaderboard AS
SELECT
  d.id                                            AS driver_id,
  d.location_id,
  COALESCE(e.name, 'Fahrer')                      AS driver_name,
  d.vehicle                                       AS vehicle_type,
  SUM(s.tours)                                    AS tours_30d,
  ROUND(SUM(s.distance_km)::numeric, 2)           AS distance_km_30d,
  ROUND(SUM(s.co2_kg)::numeric, 3)                AS co2_kg_30d,
  ROUND(SUM(s.co2_saved_kg)::numeric, 3)          AS co2_saved_kg_30d,
  ROUND(
    CASE WHEN SUM(s.tours) > 0
    THEN SUM(s.co2_kg) / SUM(s.tours) ELSE 0 END::numeric, 3
  )                                               AS avg_co2_per_tour,
  ROUND(SUM(s.co2_saved_kg) / 21.77, 2)          AS trees_equivalent
FROM driver_co2_snapshots s
JOIN mise_drivers d ON d.id = s.driver_id
LEFT JOIN employees e ON e.auth_user_id = d.auth_user_id
WHERE s.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY d.id, d.location_id, e.name, d.vehicle
ORDER BY SUM(s.co2_saved_kg) DESC;

-- ── v_co2_trend_30d ───────────────────────────────────────────────────────────
-- Daily CO₂ trend last 30 days per location (for sparkline).
CREATE OR REPLACE VIEW v_co2_trend_30d AS
SELECT
  location_id,
  snapshot_date,
  total_co2_kg,
  co2_saved_kg,
  eco_rate_pct,
  total_tours,
  eco_tours,
  total_distance_km
FROM delivery_co2_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY location_id, snapshot_date;

-- ── v_co2_location_summary ────────────────────────────────────────────────────
-- Single-row KPI summary per location over 30 days.
CREATE OR REPLACE VIEW v_co2_location_summary AS
SELECT
  location_id,
  COUNT(*)                           AS days_with_data,
  SUM(total_tours)                   AS total_tours_30d,
  SUM(eco_tours)                     AS eco_tours_30d,
  ROUND(SUM(total_distance_km)::numeric, 1) AS total_km_30d,
  ROUND(SUM(total_co2_kg)::numeric, 2)      AS total_co2_kg_30d,
  ROUND(SUM(co2_saved_kg)::numeric, 2)      AS co2_saved_kg_30d,
  ROUND(
    CASE WHEN SUM(total_tours) > 0
    THEN SUM(eco_tours)::numeric / SUM(total_tours) * 100
    ELSE 0 END, 1
  )                                  AS eco_rate_pct,
  ROUND(SUM(trees_equivalent)::numeric, 1) AS trees_equivalent_30d,
  ROUND(
    CASE WHEN SUM(total_tours) > 0
    THEN SUM(total_co2_kg) / SUM(total_tours) ELSE 0 END::numeric, 3
  )                                  AS avg_co2_per_tour
FROM delivery_co2_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY location_id;

-- ── prune function ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_co2_snapshots(days_to_keep integer DEFAULT 90)
RETURNS integer AS $$
DECLARE deleted integer;
BEGIN
  DELETE FROM driver_co2_snapshots
  WHERE snapshot_date < CURRENT_DATE - (days_to_keep || ' days')::interval;
  WITH del AS (
    DELETE FROM delivery_co2_snapshots
    WHERE snapshot_date < CURRENT_DATE - (days_to_keep || ' days')::interval
    RETURNING 1
  ) SELECT COUNT(*) INTO deleted FROM del;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
