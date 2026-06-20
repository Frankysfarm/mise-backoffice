-- Phase 346: Tour Heatmap Engine
-- Aggregiert abgeschlossene Tour-Stops in Gitter-Kacheln (0.01°≈1km).
-- Identifiziert unterversorgte Zonen anhand Lieferzeit + Abdeckung.

-- ── Konfiguration ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tour_heatmap_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL UNIQUE REFERENCES locations(id) ON DELETE CASCADE,
  lookback_days   int NOT NULL DEFAULT 30,
  grid_resolution numeric(4,3) NOT NULL DEFAULT 0.010,
  late_threshold_min int NOT NULL DEFAULT 45,
  underserved_min_stops int NOT NULL DEFAULT 3,
  underserved_late_rate_pct numeric(5,2) NOT NULL DEFAULT 40.0,
  enabled         boolean NOT NULL DEFAULT true,
  last_computed   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tour_heatmap_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_tour_heatmap_config" ON tour_heatmap_config;
CREATE POLICY "service_role_tour_heatmap_config"
  ON tour_heatmap_config USING (true) WITH CHECK (true);

-- ── Tages-Kacheln ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tour_heatmap_tiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  grid_lat        numeric(7,3) NOT NULL,
  grid_lng        numeric(7,3) NOT NULL,
  date_bucket     date NOT NULL,
  tour_count      int NOT NULL DEFAULT 0,
  stop_count      int NOT NULL DEFAULT 0,
  avg_delivery_min numeric(6,2),
  late_stops      int NOT NULL DEFAULT 0,
  zone_label      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tour_heatmap_tile
  ON tour_heatmap_tiles (location_id, grid_lat, grid_lng, date_bucket);

CREATE INDEX IF NOT EXISTS idx_tour_heatmap_tile_location
  ON tour_heatmap_tiles (location_id, date_bucket DESC);

ALTER TABLE tour_heatmap_tiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_tour_heatmap_tiles" ON tour_heatmap_tiles;
CREATE POLICY "service_role_tour_heatmap_tiles"
  ON tour_heatmap_tiles USING (true) WITH CHECK (true);

-- ── Unterversorgte Zonen ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tour_heatmap_underserved (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  grid_lat        numeric(7,3) NOT NULL,
  grid_lng        numeric(7,3) NOT NULL,
  zone_label      text,
  avg_delivery_min numeric(6,2),
  stop_count      int NOT NULL DEFAULT 0,
  late_rate       numeric(5,2),
  severity        text NOT NULL DEFAULT 'low'
                  CHECK (severity IN ('low', 'medium', 'high')),
  detected_at     timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tour_heatmap_underserved
  ON tour_heatmap_underserved (location_id, grid_lat, grid_lng);

CREATE INDEX IF NOT EXISTS idx_tour_heatmap_underserved_loc
  ON tour_heatmap_underserved (location_id, severity);

ALTER TABLE tour_heatmap_underserved ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_tour_heatmap_underserved" ON tour_heatmap_underserved;
CREATE POLICY "service_role_tour_heatmap_underserved"
  ON tour_heatmap_underserved USING (true) WITH CHECK (true);

-- ── Cleanup-Funktion ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_tour_heatmap_tiles(days_old int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_deleted int;
BEGIN
  DELETE FROM tour_heatmap_tiles
  WHERE date_bucket < (CURRENT_DATE - days_old);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
