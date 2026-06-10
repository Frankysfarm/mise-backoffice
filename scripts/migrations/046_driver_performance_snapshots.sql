-- ============================================================
-- Migration 046: Driver Performance Snapshots & Leaderboard
-- Phase 56 — 2026-06-10
--
-- Speichert tägliche KPI-Snapshots pro Fahrer + Location.
-- Ermöglicht Wochen-/Monats-Leaderboard und persönliche Trends.
-- ============================================================

-- ── 1. Snapshot-Tabelle ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_performance_snapshots (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id           uuid          NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id         uuid          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  snapshot_date       date          NOT NULL,

  -- Tour/Stop-Metriken
  tours_completed     int           NOT NULL DEFAULT 0,
  stops_completed     int           NOT NULL DEFAULT 0,
  total_distance_km   numeric(8,2)  NOT NULL DEFAULT 0,

  -- Zeit- & ETA-Metriken
  avg_delivery_min    numeric(6,1),     -- NULL wenn keine Daten
  on_time_rate        numeric(5,4),     -- 0.0000–1.0000, NULL wenn keine Daten
  active_minutes      int           NOT NULL DEFAULT 0,

  -- Qualitäts-Metriken
  avg_rating          numeric(3,2),     -- NULL wenn keine Bewertungen
  total_ratings       int           NOT NULL DEFAULT 0,

  -- Finanz-Metriken
  total_earnings_eur  numeric(10,2) NOT NULL DEFAULT 0,

  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (driver_id, location_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_dps_location_date
  ON driver_performance_snapshots (location_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_dps_driver_date
  ON driver_performance_snapshots (driver_id, snapshot_date DESC);

COMMENT ON TABLE driver_performance_snapshots IS
  'Tägliche Fahrer-KPI-Snapshots: Touren, Stops, Distanz, ETA, Bewertung, Verdienst. '
  'Wird von lib/delivery/driver-performance.ts befüllt (Cron täglich 02:00 UTC). '
  'Grundlage für Wochen-/Monats-Leaderboard und persönliche Trends.';

-- ── 2. Wochen-Leaderboard View ────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_driver_leaderboard_week AS
WITH ranked AS (
  SELECT
    s.driver_id,
    s.location_id,
    d.auth_user_id,
    SUM(s.tours_completed)                                AS tours_week,
    SUM(s.stops_completed)                               AS stops_week,
    SUM(s.total_distance_km)                             AS distance_week_km,
    SUM(s.active_minutes)                                AS active_minutes_week,
    AVG(s.avg_delivery_min) FILTER (WHERE s.avg_delivery_min IS NOT NULL)
                                                         AS avg_delivery_min,
    -- Gewichtetes on_time: nur Tage mit ETA-Daten
    SUM(s.on_time_rate * s.stops_completed) FILTER (WHERE s.on_time_rate IS NOT NULL AND s.stops_completed > 0)
      / NULLIF(SUM(s.stops_completed) FILTER (WHERE s.on_time_rate IS NOT NULL AND s.stops_completed > 0), 0)
                                                         AS on_time_rate,
    SUM(s.total_ratings)                                 AS total_ratings,
    -- Gewichtetes Rating: nur Tage mit Bewertungen
    SUM(s.avg_rating * s.total_ratings) FILTER (WHERE s.avg_rating IS NOT NULL AND s.total_ratings > 0)
      / NULLIF(SUM(s.total_ratings) FILTER (WHERE s.avg_rating IS NOT NULL AND s.total_ratings > 0), 0)
                                                         AS avg_rating,
    SUM(s.total_earnings_eur)                            AS earnings_week_eur,
    MAX(s.snapshot_date)                                 AS last_active_date,
    COUNT(DISTINCT s.snapshot_date) FILTER (WHERE s.stops_completed > 0)
                                                         AS active_days
  FROM driver_performance_snapshots s
  JOIN mise_drivers d ON d.id = s.driver_id
  WHERE s.snapshot_date >= CURRENT_DATE - INTERVAL '6 days'
    AND s.snapshot_date <= CURRENT_DATE
  GROUP BY s.driver_id, s.location_id, d.auth_user_id
)
SELECT
  r.*,
  RANK() OVER (
    PARTITION BY r.location_id
    ORDER BY r.stops_week DESC, r.on_time_rate DESC NULLS LAST, r.avg_rating DESC NULLS LAST
  ) AS rank
FROM ranked r
WHERE r.stops_week > 0 OR r.tours_week > 0;

COMMENT ON VIEW v_driver_leaderboard_week IS
  'Wöchentliches Fahrer-Ranking (letzte 7 Tage) sortiert nach Stops → Pünktlichkeit → Rating.';

-- ── 3. Monats-Leaderboard View ────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_driver_leaderboard_month AS
WITH ranked AS (
  SELECT
    s.driver_id,
    s.location_id,
    d.auth_user_id,
    SUM(s.tours_completed)                               AS tours_month,
    SUM(s.stops_completed)                               AS stops_month,
    SUM(s.total_distance_km)                             AS distance_month_km,
    SUM(s.active_minutes)                                AS active_minutes_month,
    AVG(s.avg_delivery_min) FILTER (WHERE s.avg_delivery_min IS NOT NULL)
                                                         AS avg_delivery_min,
    SUM(s.on_time_rate * s.stops_completed) FILTER (WHERE s.on_time_rate IS NOT NULL AND s.stops_completed > 0)
      / NULLIF(SUM(s.stops_completed) FILTER (WHERE s.on_time_rate IS NOT NULL AND s.stops_completed > 0), 0)
                                                         AS on_time_rate,
    SUM(s.total_ratings)                                 AS total_ratings,
    SUM(s.avg_rating * s.total_ratings) FILTER (WHERE s.avg_rating IS NOT NULL AND s.total_ratings > 0)
      / NULLIF(SUM(s.total_ratings) FILTER (WHERE s.avg_rating IS NOT NULL AND s.total_ratings > 0), 0)
                                                         AS avg_rating,
    SUM(s.total_earnings_eur)                            AS earnings_month_eur,
    MAX(s.snapshot_date)                                 AS last_active_date,
    COUNT(DISTINCT s.snapshot_date) FILTER (WHERE s.stops_completed > 0)
                                                         AS active_days
  FROM driver_performance_snapshots s
  JOIN mise_drivers d ON d.id = s.driver_id
  WHERE s.snapshot_date >= date_trunc('month', CURRENT_DATE)
    AND s.snapshot_date <= CURRENT_DATE
  GROUP BY s.driver_id, s.location_id, d.auth_user_id
)
SELECT
  r.*,
  RANK() OVER (
    PARTITION BY r.location_id
    ORDER BY r.stops_month DESC, r.on_time_rate DESC NULLS LAST, r.avg_rating DESC NULLS LAST
  ) AS rank
FROM ranked r
WHERE r.stops_month > 0 OR r.tours_month > 0;

COMMENT ON VIEW v_driver_leaderboard_month IS
  'Monatliches Fahrer-Ranking (aktueller Kalendermonat).';

-- ── 4. Heute-Leaderboard View ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_driver_leaderboard_today AS
SELECT
  s.driver_id,
  s.location_id,
  d.auth_user_id,
  s.tours_completed,
  s.stops_completed,
  s.total_distance_km,
  s.active_minutes,
  s.avg_delivery_min,
  s.on_time_rate,
  s.total_ratings,
  s.avg_rating,
  s.total_earnings_eur,
  s.snapshot_date                AS last_active_date,
  1                              AS active_days,
  RANK() OVER (
    PARTITION BY s.location_id
    ORDER BY s.stops_completed DESC, s.on_time_rate DESC NULLS LAST, s.avg_rating DESC NULLS LAST
  )                              AS rank
FROM driver_performance_snapshots s
JOIN mise_drivers d ON d.id = s.driver_id
WHERE s.snapshot_date = CURRENT_DATE
  AND (s.stops_completed > 0 OR s.tours_completed > 0);

COMMENT ON VIEW v_driver_leaderboard_today IS
  'Heutiges Fahrer-Ranking (Echtzeit-Snapshot des aktuellen Tages).';
