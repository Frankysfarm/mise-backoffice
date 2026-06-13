-- Migration 070: Tour Performance Analytics & Bundle Learning
-- Records completed tour snapshots for post-delivery analysis and bundling optimization.

-- ─── Main table ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tour_performance_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  batch_id              UUID NOT NULL,
  driver_id             UUID,

  -- Tour composition
  bundle_size           SMALLINT NOT NULL DEFAULT 1,    -- orders bundled in this tour
  planned_stops         SMALLINT NOT NULL DEFAULT 1,
  actual_stops          SMALLINT NOT NULL DEFAULT 0,
  vehicle_type          TEXT NOT NULL DEFAULT 'car',

  -- Timing (minutes)
  planned_eta_min       NUMERIC(6,1),   -- original ETA window at dispatch
  actual_delivery_min   NUMERIC(6,1),   -- pickup → last delivery
  food_transit_min      NUMERIC(6,1),   -- same as actual_delivery_min (food quality proxy)

  -- SLA
  on_time_stops         SMALLINT NOT NULL DEFAULT 0,
  late_stops            SMALLINT NOT NULL DEFAULT 0,

  -- Route quality
  total_route_km        NUMERIC(7,2),
  avg_detour_km         NUMERIC(6,2),   -- average extra km vs straight-line per stop

  -- Efficiency score 0–100
  bundle_efficiency_score NUMERIC(5,1),

  -- Zone breakdown
  zone_a_stops          SMALLINT NOT NULL DEFAULT 0,
  zone_b_stops          SMALLINT NOT NULL DEFAULT 0,
  zone_c_stops          SMALLINT NOT NULL DEFAULT 0,
  zone_d_stops          SMALLINT NOT NULL DEFAULT 0,

  -- Timestamps
  first_pickup_at       TIMESTAMPTZ,
  last_delivery_at      TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS tour_perf_batch_uniq
  ON tour_performance_snapshots (batch_id);

CREATE INDEX IF NOT EXISTS tour_perf_location_completed
  ON tour_performance_snapshots (location_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS tour_perf_driver
  ON tour_performance_snapshots (driver_id, completed_at DESC);

ALTER TABLE tour_performance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY tour_perf_location_policy
  ON tour_performance_snapshots
  FOR ALL USING (
    location_id IN (
      SELECT l.id FROM locations l
      JOIN employees e ON e.tenant_id = l.tenant_id
      WHERE e.auth_user_id = auth.uid()
    )
  );

-- ─── 7-Day rolling trend (daily buckets) ──────────────────────────────────────

CREATE OR REPLACE VIEW v_tour_performance_trend AS
SELECT
  location_id,
  DATE_TRUNC('day', completed_at AT TIME ZONE 'Europe/Berlin') AS day_berlin,
  COUNT(*)                                         AS total_tours,
  ROUND(AVG(bundle_size), 1)                       AS avg_bundle_size,
  ROUND(AVG(bundle_efficiency_score), 1)           AS avg_efficiency_score,
  ROUND(AVG(actual_delivery_min), 1)               AS avg_delivery_min,
  ROUND(AVG(planned_eta_min), 1)                   AS avg_planned_eta_min,
  SUM(on_time_stops)                               AS total_on_time,
  SUM(late_stops)                                  AS total_late,
  ROUND(
    100.0 * SUM(on_time_stops)::numeric
      / NULLIF(SUM(on_time_stops) + SUM(late_stops), 0),
    1
  )                                                AS on_time_pct,
  ROUND(AVG(total_route_km), 2)                    AS avg_route_km,
  ROUND(AVG(avg_detour_km), 2)                     AS avg_detour_km
FROM tour_performance_snapshots
WHERE completed_at >= NOW() - INTERVAL '30 days'
GROUP BY location_id, day_berlin
ORDER BY location_id, day_berlin DESC;

-- ─── Bundle efficiency by zone ────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_bundle_efficiency_by_zone AS
WITH zone_stops AS (
  SELECT
    location_id,
    'A' AS zone,
    SUM(zone_a_stops)                              AS total_stops,
    AVG(bundle_efficiency_score)                   AS avg_efficiency,
    AVG(actual_delivery_min)                       AS avg_delivery_min,
    SUM(on_time_stops)::numeric / NULLIF(SUM(zone_a_stops), 0) AS on_time_rate
  FROM tour_performance_snapshots
  WHERE completed_at >= NOW() - INTERVAL '14 days'
    AND zone_a_stops > 0
  GROUP BY location_id
  UNION ALL
  SELECT
    location_id, 'B',
    SUM(zone_b_stops),
    AVG(bundle_efficiency_score),
    AVG(actual_delivery_min),
    SUM(on_time_stops)::numeric / NULLIF(SUM(zone_b_stops), 0)
  FROM tour_performance_snapshots
  WHERE completed_at >= NOW() - INTERVAL '14 days'
    AND zone_b_stops > 0
  GROUP BY location_id
  UNION ALL
  SELECT
    location_id, 'C',
    SUM(zone_c_stops),
    AVG(bundle_efficiency_score),
    AVG(actual_delivery_min),
    SUM(on_time_stops)::numeric / NULLIF(SUM(zone_c_stops), 0)
  FROM tour_performance_snapshots
  WHERE completed_at >= NOW() - INTERVAL '14 days'
    AND zone_c_stops > 0
  GROUP BY location_id
  UNION ALL
  SELECT
    location_id, 'D',
    SUM(zone_d_stops),
    AVG(bundle_efficiency_score),
    AVG(actual_delivery_min),
    SUM(on_time_stops)::numeric / NULLIF(SUM(zone_d_stops), 0)
  FROM tour_performance_snapshots
  WHERE completed_at >= NOW() - INTERVAL '14 days'
    AND zone_d_stops > 0
  GROUP BY location_id
)
SELECT
  location_id,
  zone,
  total_stops,
  ROUND(avg_efficiency::numeric, 1)               AS avg_efficiency_score,
  ROUND(avg_delivery_min::numeric, 1)             AS avg_delivery_min,
  ROUND(100.0 * on_time_rate, 1)                  AS on_time_pct
FROM zone_stops
ORDER BY location_id, zone;

-- ─── Overall KPI summary ──────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_tour_analytics_summary AS
SELECT
  location_id,
  COUNT(*)                                         AS total_tours_30d,
  ROUND(AVG(bundle_size), 2)                       AS avg_bundle_size,
  ROUND(AVG(bundle_efficiency_score), 1)           AS avg_efficiency_score,
  ROUND(AVG(actual_delivery_min), 1)               AS avg_delivery_min,
  ROUND(
    100.0 * SUM(on_time_stops)::numeric
      / NULLIF(SUM(on_time_stops) + SUM(late_stops), 0),
    1
  )                                                AS on_time_pct,
  ROUND(AVG(avg_detour_km), 2)                     AS avg_detour_km,
  MAX(bundle_size)                                 AS max_bundle_seen,
  COUNT(*) FILTER (WHERE bundle_size >= 2)         AS multi_stop_tours,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE bundle_size >= 2)::numeric / NULLIF(COUNT(*), 0),
    1
  )                                                AS bundle_rate_pct
FROM tour_performance_snapshots
WHERE completed_at >= NOW() - INTERVAL '30 days'
GROUP BY location_id;
