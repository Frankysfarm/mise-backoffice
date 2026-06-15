-- Migration 102: route_optimization_log
-- Speichert Ergebnisse von Routen-Optimierungsläufen pro Tour.

CREATE TABLE IF NOT EXISTS route_optimization_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  batch_id            uuid REFERENCES mise_delivery_batches(id) ON DELETE SET NULL,
  stops_count         int  NOT NULL DEFAULT 0,
  distance_before_km  numeric(8,2) NOT NULL DEFAULT 0,
  distance_after_km   numeric(8,2) NOT NULL DEFAULT 0,
  improvement_km      numeric(8,2) GENERATED ALWAYS AS (distance_before_km - distance_after_km) STORED,
  improvement_pct     numeric(6,2) GENERATED ALWAYS AS (
    CASE WHEN distance_before_km > 0
      THEN ROUND(((distance_before_km - distance_after_km) / distance_before_km * 100)::numeric, 2)
      ELSE 0
    END
  ) STORED,
  algorithm           text NOT NULL DEFAULT 'two_opt',  -- 'google_tsp' | 'nearest_neighbor' | 'two_opt'
  duration_ms         int  NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_opt_log_location
  ON route_optimization_log (location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_route_opt_log_batch
  ON route_optimization_log (batch_id);

-- 30-Tage-Statistiken je Location
CREATE OR REPLACE VIEW v_route_optimization_stats AS
SELECT
  location_id,
  COUNT(*)                                  AS total_optimizations,
  ROUND(AVG(improvement_km)::numeric, 2)   AS avg_improvement_km,
  ROUND(AVG(improvement_pct)::numeric, 1)  AS avg_improvement_pct,
  ROUND(MAX(improvement_km)::numeric, 2)   AS best_improvement_km,
  ROUND(MAX(improvement_pct)::numeric, 1)  AS best_improvement_pct,
  ROUND(SUM(improvement_km)::numeric, 2)   AS total_km_saved,
  COUNT(*) FILTER (WHERE algorithm = 'google_tsp') AS google_tsp_count,
  COUNT(*) FILTER (WHERE algorithm = 'two_opt')    AS two_opt_count,
  ROUND(AVG(stops_count)::numeric, 1)      AS avg_stops,
  MAX(created_at)                           AS last_run_at
FROM route_optimization_log
WHERE created_at >= now() - interval '30 days'
GROUP BY location_id;

-- Letzte 50 Optimierungen je Location (für History-Tab)
CREATE OR REPLACE VIEW v_route_optimization_history AS
SELECT
  rol.*,
  mdb.state        AS batch_state,
  mdb.driver_id    AS batch_driver_id
FROM route_optimization_log rol
LEFT JOIN mise_delivery_batches mdb ON mdb.id = rol.batch_id
ORDER BY rol.created_at DESC;

-- RLS: nur service_role
ALTER TABLE route_optimization_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON route_optimization_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
