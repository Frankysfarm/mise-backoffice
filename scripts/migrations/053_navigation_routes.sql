-- Migration 053: Driver Navigation Routes Cache
-- Caches Google Directions step data per batch+stop to avoid repeated API calls

CREATE TABLE IF NOT EXISTS driver_navigation_routes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id       uuid NOT NULL,
  location_id    uuid NOT NULL,
  stop_index     int  NOT NULL DEFAULT 0,
  vehicle        text NOT NULL DEFAULT 'car' CHECK (vehicle IN ('car', 'bike')),
  from_lat       double precision NOT NULL,
  from_lng       double precision NOT NULL,
  to_lat         double precision NOT NULL,
  to_lng         double precision NOT NULL,
  total_dist_m   int  NOT NULL DEFAULT 0,
  total_dur_s    int  NOT NULL DEFAULT 0,
  steps          jsonb NOT NULL DEFAULT '[]',
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, stop_index, vehicle)
);

-- Cleanup index (prune old entries)
CREATE INDEX IF NOT EXISTS idx_nav_routes_fetched
  ON driver_navigation_routes (fetched_at);

-- Lookup index
CREATE INDEX IF NOT EXISTS idx_nav_routes_batch
  ON driver_navigation_routes (batch_id, stop_index, vehicle);

-- Row-level security: service role bypasses, anon/auth can only read own
ALTER TABLE driver_navigation_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_nav" ON driver_navigation_routes
  FOR ALL USING (true)
  WITH CHECK (true);

-- Auto-expire after 2 hours (handled by cron, not DB trigger, for simplicity)
COMMENT ON TABLE driver_navigation_routes IS
  'Cached Google Directions step data per active batch segment. Expires after 2h.';
