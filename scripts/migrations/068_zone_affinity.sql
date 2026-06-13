-- Migration 068: Smart Driver Zone Affinity Engine
-- Tracks historical delivery performance per driver per zone (A/B/C/D).
-- Affinity score drives dispatch prioritization beyond static zone matching.

-- ── Tabelle: driver_zone_stats ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_zone_stats (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id         UUID        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  zone_name         TEXT        NOT NULL CHECK (zone_name IN ('A','B','C','D')),
  total_deliveries  INT         NOT NULL DEFAULT 0,
  on_time_count     INT         NOT NULL DEFAULT 0,
  avg_delivery_min  NUMERIC(6,2),
  last_delivery_at  TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, driver_id, zone_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dzs_driver_zone   ON driver_zone_stats (driver_id, zone_name);
CREATE INDEX IF NOT EXISTS idx_dzs_location      ON driver_zone_stats (location_id);
CREATE INDEX IF NOT EXISTS idx_dzs_driver_loc    ON driver_zone_stats (driver_id, location_id);

-- RLS
ALTER TABLE driver_zone_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_zone_stats"
  ON driver_zone_stats
  USING (location_id IN (
    SELECT id FROM locations WHERE tenant_id = (
      SELECT tenant_id FROM locations WHERE id = driver_zone_stats.location_id LIMIT 1
    )
  ));

-- ── View: v_zone_affinity_matrix ──────────────────────────────────────────────
-- Driver × Zone matrix with affinity scores (0–100):
-- 60% familiarity (delivery count, capped at 20 for full score) + 40% on-time rate.
CREATE OR REPLACE VIEW v_zone_affinity_matrix AS
SELECT
  d.id                                                                        AS driver_id,
  COALESCE(e.name, 'Fahrer')                                                  AS driver_name,
  d.location_id,
  -- Zone A
  MAX(CASE WHEN dzs.zone_name = 'A' THEN
    LEAST(100,
      LEAST(60, dzs.total_deliveries::NUMERIC * 3) +
      CASE WHEN dzs.total_deliveries > 0
           THEN (dzs.on_time_count::NUMERIC / dzs.total_deliveries) * 40
           ELSE 0 END
    )
  END)                                                                        AS zone_a_score,
  MAX(CASE WHEN dzs.zone_name = 'B' THEN
    LEAST(100,
      LEAST(60, dzs.total_deliveries::NUMERIC * 3) +
      CASE WHEN dzs.total_deliveries > 0
           THEN (dzs.on_time_count::NUMERIC / dzs.total_deliveries) * 40
           ELSE 0 END
    )
  END)                                                                        AS zone_b_score,
  MAX(CASE WHEN dzs.zone_name = 'C' THEN
    LEAST(100,
      LEAST(60, dzs.total_deliveries::NUMERIC * 3) +
      CASE WHEN dzs.total_deliveries > 0
           THEN (dzs.on_time_count::NUMERIC / dzs.total_deliveries) * 40
           ELSE 0 END
    )
  END)                                                                        AS zone_c_score,
  MAX(CASE WHEN dzs.zone_name = 'D' THEN
    LEAST(100,
      LEAST(60, dzs.total_deliveries::NUMERIC * 3) +
      CASE WHEN dzs.total_deliveries > 0
           THEN (dzs.on_time_count::NUMERIC / dzs.total_deliveries) * 40
           ELSE 0 END
    )
  END)                                                                        AS zone_d_score,
  -- Delivery counts per zone
  MAX(CASE WHEN dzs.zone_name = 'A' THEN dzs.total_deliveries END)           AS zone_a_deliveries,
  MAX(CASE WHEN dzs.zone_name = 'B' THEN dzs.total_deliveries END)           AS zone_b_deliveries,
  MAX(CASE WHEN dzs.zone_name = 'C' THEN dzs.total_deliveries END)           AS zone_c_deliveries,
  MAX(CASE WHEN dzs.zone_name = 'D' THEN dzs.total_deliveries END)           AS zone_d_deliveries,
  -- Totals
  COALESCE(SUM(dzs.total_deliveries), 0)                                      AS total_zone_deliveries,
  MAX(dzs.last_delivery_at)                                                   AS last_zone_delivery_at
FROM mise_drivers d
LEFT JOIN employees e ON d.employee_id = e.id
LEFT JOIN driver_zone_stats dzs ON dzs.driver_id = d.id AND dzs.location_id = d.location_id
WHERE d.active = TRUE
GROUP BY d.id, e.name, d.location_id;

-- ── View: v_zone_coverage_stats ───────────────────────────────────────────────
-- Per-location KPI summary: top driver per zone, avg affinity, coverage gaps.
CREATE OR REPLACE VIEW v_zone_coverage_stats AS
SELECT
  dzs.location_id,
  dzs.zone_name,
  COUNT(DISTINCT dzs.driver_id)                                               AS drivers_active,
  SUM(dzs.total_deliveries)                                                   AS total_deliveries,
  ROUND(AVG(
    LEAST(100,
      LEAST(60, dzs.total_deliveries::NUMERIC * 3) +
      CASE WHEN dzs.total_deliveries > 0
           THEN (dzs.on_time_count::NUMERIC / dzs.total_deliveries) * 40
           ELSE 0 END
    )
  ), 1)                                                                       AS avg_affinity_score,
  ROUND(
    CASE WHEN SUM(dzs.total_deliveries) > 0
         THEN (SUM(dzs.on_time_count)::NUMERIC / SUM(dzs.total_deliveries)) * 100
         ELSE NULL END,
    1
  )                                                                           AS on_time_pct,
  ROUND(AVG(dzs.avg_delivery_min), 1)                                         AS avg_delivery_min
FROM driver_zone_stats dzs
GROUP BY dzs.location_id, dzs.zone_name;
