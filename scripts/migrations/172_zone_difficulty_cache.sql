-- Migration 172: Zone Difficulty Cache
-- Caches aggregated tour-feedback per delivery zone (A/B/C/D) for dispatch-time use.
-- Populated by lib/delivery/zone-difficulty.ts (cron-refreshed every hour).

CREATE TABLE IF NOT EXISTS zone_difficulty_cache (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  zone                 TEXT        NOT NULL CHECK (zone IN ('A','B','C','D')),
  avg_difficulty       NUMERIC(4,2) NOT NULL DEFAULT 0,
  avg_traffic          NUMERIC(4,2) NOT NULL DEFAULT 0,
  issue_rate_parking   NUMERIC(5,2) NOT NULL DEFAULT 0,   -- percent
  issue_rate_nav       NUMERIC(5,2) NOT NULL DEFAULT 0,
  issue_rate_address   NUMERIC(5,2) NOT NULL DEFAULT 0,
  stop_count_modifier  NUMERIC(4,2) NOT NULL DEFAULT 1.00
    CHECK (stop_count_modifier BETWEEN 0.50 AND 1.00),
  detour_modifier      NUMERIC(4,2) NOT NULL DEFAULT 1.00
    CHECK (detour_modifier BETWEEN 0.50 AND 1.00),
  sample_count         INTEGER      NOT NULL DEFAULT 0,
  computed_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (location_id, zone)
);

ALTER TABLE zone_difficulty_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_zone_difficulty"
  ON zone_difficulty_cache
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_zone_difficulty_location
  ON zone_difficulty_cache(location_id);

-- Cleanup RPC: remove stale entries (called by cron, default 30 days)
CREATE OR REPLACE FUNCTION prune_zone_difficulty_cache(days_old INTEGER DEFAULT 30)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pruned INTEGER;
BEGIN
  DELETE FROM zone_difficulty_cache
  WHERE computed_at < now() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS pruned = ROW_COUNT;
  RETURN pruned;
END;
$$;
