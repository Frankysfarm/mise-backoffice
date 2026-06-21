-- Migration 173: Zone Difficulty Daily History
-- Daily snapshots of zone_difficulty_cache for trend analysis and LineChart views.
-- Populated by lib/delivery/zone-difficulty.ts once per day (01:44 UTC).

CREATE TABLE IF NOT EXISTS zone_difficulty_daily (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          UUID         NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  zone                 TEXT         NOT NULL CHECK (zone IN ('A','B','C','D')),
  snapshot_date        DATE         NOT NULL,
  avg_difficulty       NUMERIC(4,2) NOT NULL DEFAULT 0,
  avg_traffic          NUMERIC(4,2) NOT NULL DEFAULT 0,
  issue_rate_parking   NUMERIC(5,2) NOT NULL DEFAULT 0,
  issue_rate_nav       NUMERIC(5,2) NOT NULL DEFAULT 0,
  issue_rate_address   NUMERIC(5,2) NOT NULL DEFAULT 0,
  stop_count_modifier  NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  detour_modifier      NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  sample_count         INTEGER      NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (location_id, zone, snapshot_date)
);

ALTER TABLE zone_difficulty_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_zone_difficulty_daily"
  ON zone_difficulty_daily
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_zone_diff_daily_loc_date
  ON zone_difficulty_daily (location_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_zone_diff_daily_loc_zone_date
  ON zone_difficulty_daily (location_id, zone, snapshot_date DESC);

-- Cleanup RPC
CREATE OR REPLACE FUNCTION prune_zone_difficulty_daily(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pruned INTEGER;
BEGIN
  DELETE FROM zone_difficulty_daily
  WHERE snapshot_date < CURRENT_DATE - days_to_keep;
  GET DIAGNOSTICS pruned = ROW_COUNT;
  RETURN pruned;
END;
$$;

-- 30-Tage Trend-View
CREATE OR REPLACE VIEW v_zone_difficulty_trend_30d AS
SELECT
  location_id,
  zone,
  snapshot_date,
  avg_difficulty,
  avg_traffic,
  stop_count_modifier,
  detour_modifier,
  sample_count
FROM zone_difficulty_daily
WHERE snapshot_date >= CURRENT_DATE - 30
ORDER BY location_id, zone, snapshot_date;
