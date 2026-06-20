-- ─── Phase 310 — Fahrer-Performance-Echtzeit-Dashboard ──────────────────────
-- Echtzeit-View: aktuelle Woche vs. Vorwoche je Fahrer + Location.
-- Genutzt von /api/delivery/admin/driver-performance-realtime.

-- ── 1. Echtzeit-Performance-View ──────────────────────────────────────────────
CREATE OR REPLACE VIEW v_driver_performance_realtime AS
WITH current_week AS (
  SELECT
    s.driver_id,
    s.location_id,
    SUM(s.tours_completed)                                                        AS tours_this_week,
    SUM(s.stops_completed)                                                        AS stops_this_week,
    SUM(s.total_distance_km)                                                      AS distance_this_week_km,
    AVG(s.avg_delivery_min) FILTER (WHERE s.avg_delivery_min IS NOT NULL)         AS avg_delivery_min_this_week,
    SUM(s.on_time_rate * s.stops_completed)
      FILTER (WHERE s.on_time_rate IS NOT NULL AND s.stops_completed > 0)
      / NULLIF(SUM(s.stops_completed) FILTER (WHERE s.on_time_rate IS NOT NULL AND s.stops_completed > 0), 0)
                                                                                  AS on_time_rate_this_week,
    AVG(s.avg_rating) FILTER (WHERE s.avg_rating IS NOT NULL)                    AS avg_rating_this_week,
    SUM(s.total_ratings)                                                          AS ratings_this_week,
    SUM(s.active_minutes)                                                         AS active_min_this_week,
    SUM(s.total_earnings_eur)                                                     AS earnings_this_week_eur
  FROM driver_performance_snapshots s
  WHERE s.snapshot_date >= CURRENT_DATE - 6
    AND s.snapshot_date <= CURRENT_DATE
  GROUP BY s.driver_id, s.location_id
),
last_week AS (
  SELECT
    s.driver_id,
    s.location_id,
    SUM(s.tours_completed)                                                        AS tours_last_week,
    SUM(s.stops_completed)                                                        AS stops_last_week,
    AVG(s.avg_delivery_min) FILTER (WHERE s.avg_delivery_min IS NOT NULL)         AS avg_delivery_min_last_week,
    SUM(s.on_time_rate * s.stops_completed)
      FILTER (WHERE s.on_time_rate IS NOT NULL AND s.stops_completed > 0)
      / NULLIF(SUM(s.stops_completed) FILTER (WHERE s.on_time_rate IS NOT NULL AND s.stops_completed > 0), 0)
                                                                                  AS on_time_rate_last_week,
    AVG(s.avg_rating) FILTER (WHERE s.avg_rating IS NOT NULL)                    AS avg_rating_last_week
  FROM driver_performance_snapshots s
  WHERE s.snapshot_date >= CURRENT_DATE - 13
    AND s.snapshot_date <= CURRENT_DATE - 7
  GROUP BY s.driver_id, s.location_id
),
today AS (
  SELECT
    s.driver_id,
    s.location_id,
    s.tours_completed                                                             AS tours_today,
    s.stops_completed                                                             AS stops_today,
    s.avg_delivery_min                                                            AS avg_delivery_min_today,
    s.on_time_rate                                                                AS on_time_rate_today,
    s.avg_rating                                                                  AS avg_rating_today,
    s.total_earnings_eur                                                          AS earnings_today_eur
  FROM driver_performance_snapshots s
  WHERE s.snapshot_date = CURRENT_DATE
)
SELECT
  d.id                                                                            AS driver_id,
  d.auth_user_id,
  d.vehicle,
  d.state                                                                         AS current_state,
  d.zone                                                                          AS current_zone,
  d.rating                                                                        AS driver_rating_overall,

  -- Heutiger Tag
  COALESCE(td.tours_today, 0)                                                    AS tours_today,
  COALESCE(td.stops_today, 0)                                                    AS stops_today,
  td.avg_delivery_min_today,
  td.on_time_rate_today,
  td.avg_rating_today,
  COALESCE(td.earnings_today_eur, 0)                                             AS earnings_today_eur,

  -- Aktuelle Woche
  COALESCE(cw.tours_this_week, 0)                                                AS tours_this_week,
  COALESCE(cw.stops_this_week, 0)                                                AS stops_this_week,
  COALESCE(cw.distance_this_week_km, 0)                                          AS distance_this_week_km,
  cw.avg_delivery_min_this_week,
  cw.on_time_rate_this_week,
  cw.avg_rating_this_week,
  COALESCE(cw.ratings_this_week, 0)                                              AS ratings_this_week,
  COALESCE(cw.active_min_this_week, 0)                                           AS active_min_this_week,
  COALESCE(cw.earnings_this_week_eur, 0)                                         AS earnings_this_week_eur,

  -- Vorwoche (für Trend-Vergleich)
  COALESCE(lw.tours_last_week, 0)                                                AS tours_last_week,
  COALESCE(lw.stops_last_week, 0)                                                AS stops_last_week,
  lw.avg_delivery_min_last_week,
  lw.on_time_rate_last_week,
  lw.avg_rating_last_week,

  -- Trend-Deltas (positiv = besser)
  COALESCE(cw.stops_this_week, 0) - COALESCE(lw.stops_last_week, 0)            AS stops_delta,
  CASE
    WHEN lw.avg_delivery_min_last_week IS NOT NULL
      AND cw.avg_delivery_min_this_week IS NOT NULL
    THEN lw.avg_delivery_min_last_week - cw.avg_delivery_min_this_week   -- negativ = schneller = besser
    ELSE NULL
  END                                                                             AS delivery_min_delta,
  CASE
    WHEN lw.on_time_rate_last_week IS NOT NULL
      AND cw.on_time_rate_this_week IS NOT NULL
    THEN cw.on_time_rate_this_week - lw.on_time_rate_last_week
    ELSE NULL
  END                                                                             AS on_time_delta,

  -- Location (über snapshot oder heute)
  COALESCE(cw.location_id, td.location_id, lw.location_id)                      AS location_id

FROM mise_drivers d
LEFT JOIN today    td ON td.driver_id = d.id
LEFT JOIN current_week cw ON cw.driver_id = d.id
LEFT JOIN last_week    lw ON lw.driver_id = d.id
WHERE d.active = true
  AND COALESCE(cw.stops_this_week, td.stops_today, 0) > 0;

COMMENT ON VIEW v_driver_performance_realtime IS
  'Echtzeit-Performance je aktiven Fahrer: Heute + Aktuelle Woche + Vorwoche + Trend-Deltas. '
  'Genutzt von /api/delivery/admin/driver-performance-realtime (Phase 310).';

-- ── 2. Live-Status-Snapshot-Tabelle ───────────────────────────────────────────
-- Für schnellen Zugriff auf stündliche On-Shift-Metriken (kein teures JOIN)
CREATE TABLE IF NOT EXISTS driver_live_score_snapshots (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id     UUID          NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id   UUID          NOT NULL,
  snapshot_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  live_score    SMALLINT      NOT NULL CHECK (live_score BETWEEN 0 AND 100),
  on_time_rate  NUMERIC(5,4),
  avg_delivery_min NUMERIC(6,1),
  stops_today   INT           NOT NULL DEFAULT 0,
  shift_active  BOOLEAN       NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_dlss_driver_at
  ON driver_live_score_snapshots (driver_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlss_location_at
  ON driver_live_score_snapshots (location_id, snapshot_at DESC);

-- Nur letzte 48h behalten (ältere Daten sind irrelevant für Live-Dashboard)
CREATE OR REPLACE FUNCTION prune_driver_live_score_snapshots()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM driver_live_score_snapshots
  WHERE snapshot_at < NOW() - INTERVAL '48 hours';
$$;

COMMENT ON TABLE driver_live_score_snapshots IS
  'Stündliche Live-Score-Snapshots je Fahrer für Trend-Charts im Echtzeit-Dashboard. '
  'Wird von lib/delivery/driver-performance-realtime.ts befüllt.';
