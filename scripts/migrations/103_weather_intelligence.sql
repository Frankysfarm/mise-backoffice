-- ============================================================
-- Migration 103: Smart Weather Intelligence Engine
-- Phase 203 — 2026-06-16
-- ============================================================

-- ── weather_snapshots ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weather_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  captured_at     timestamptz NOT NULL DEFAULT now(),

  -- Location coordinates at snapshot time
  lat             numeric(9,6),
  lng             numeric(9,6),

  -- Raw Open-Meteo data
  temp_c          numeric(5,2),
  precip_mm       numeric(6,2),         -- hourly precipitation
  wind_kmh        numeric(6,2),         -- wind speed km/h
  visibility_km   numeric(6,2),         -- visibility in km
  weather_code    int,                  -- WMO code
  weather_desc    text,                 -- human-readable condition

  -- Computed signals
  difficulty_score  int NOT NULL DEFAULT 0 CHECK (difficulty_score BETWEEN 0 AND 100),
  eta_factor        numeric(4,3) NOT NULL DEFAULT 1.000,  -- 1.0 = normal, 1.5 = 50% longer
  demand_impact     numeric(4,3) NOT NULL DEFAULT 1.000,  -- 1.0 = normal, 1.3 = 30% more orders

  -- Alert flags
  is_dangerous      boolean NOT NULL DEFAULT false,
  alert_message     text,

  UNIQUE (location_id, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_weather_snapshots_location_time
  ON weather_snapshots (location_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_weather_snapshots_dangerous
  ON weather_snapshots (location_id, is_dangerous, captured_at DESC)
  WHERE is_dangerous = true;

-- ── weather_delivery_stats ────────────────────────────────────────────────────
-- Optional: tracks how weather correlates with delivery performance
CREATE TABLE IF NOT EXISTS weather_delivery_stats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  stat_date       date NOT NULL,

  -- Weather summary for the day
  avg_difficulty  int,
  max_difficulty  int,
  avg_temp_c      numeric(5,2),
  total_precip_mm numeric(6,2),
  max_wind_kmh    numeric(6,2),
  dangerous_hours int DEFAULT 0,

  -- Delivery metrics for the day
  total_orders    int DEFAULT 0,
  avg_eta_min     numeric(6,2),
  on_time_rate    numeric(5,2),

  UNIQUE (location_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_weather_delivery_stats_location_date
  ON weather_delivery_stats (location_id, stat_date DESC);

-- ── views ─────────────────────────────────────────────────────────────────────

-- Current weather per location (most recent snapshot within last 60 min)
CREATE OR REPLACE VIEW v_current_weather AS
SELECT DISTINCT ON (ws.location_id)
  ws.id,
  ws.location_id,
  l.name AS location_name,
  ws.captured_at,
  ws.temp_c,
  ws.precip_mm,
  ws.wind_kmh,
  ws.visibility_km,
  ws.weather_code,
  ws.weather_desc,
  ws.difficulty_score,
  ws.eta_factor,
  ws.demand_impact,
  ws.is_dangerous,
  ws.alert_message,
  EXTRACT(EPOCH FROM (now() - ws.captured_at)) / 60 AS minutes_ago
FROM weather_snapshots ws
JOIN locations l ON l.id = ws.location_id
WHERE ws.captured_at > now() - INTERVAL '60 minutes'
ORDER BY ws.location_id, ws.captured_at DESC;

-- 24-hour weather trend with hourly buckets
CREATE OR REPLACE VIEW v_weather_trend_24h AS
SELECT
  location_id,
  date_trunc('hour', captured_at) AS hour_utc,
  ROUND(AVG(difficulty_score))::int AS avg_difficulty,
  ROUND(AVG(temp_c), 1)            AS avg_temp_c,
  ROUND(SUM(precip_mm), 2)         AS total_precip_mm,
  ROUND(MAX(wind_kmh), 1)          AS max_wind_kmh,
  ROUND(AVG(eta_factor), 3)        AS avg_eta_factor,
  ROUND(AVG(demand_impact), 3)     AS avg_demand_impact,
  BOOL_OR(is_dangerous)            AS had_dangerous
FROM weather_snapshots
WHERE captured_at > now() - INTERVAL '24 hours'
GROUP BY location_id, date_trunc('hour', captured_at)
ORDER BY location_id, hour_utc DESC;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE weather_snapshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_delivery_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weather_snapshots_service ON weather_snapshots;
CREATE POLICY weather_snapshots_service ON weather_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS weather_delivery_stats_service ON weather_delivery_stats;
CREATE POLICY weather_delivery_stats_service ON weather_delivery_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);
