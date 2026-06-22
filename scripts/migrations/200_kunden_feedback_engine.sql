-- Migration 200: Kunden-Feedback-Engine
-- Phase 418 — Analytik-Views für customer_delivery_ratings
-- Erweitert die bestehende customer_delivery_ratings-Tabelle um:
--   1. v_zone_rating_summary     — Ø-Rating + Anzahl je Zone
--   2. v_tageszeit_rating        — Ø-Rating je Tagesstunde (0–23)
--   3. v_driver_rating_rangliste — Fahrer-Rangliste nach Kundenbewertung

-- ── View: Ø-Rating je Lieferzone ─────────────────────────────────────────────
-- Joined via customer_orders.zone (falls vorhanden)
CREATE OR REPLACE VIEW v_zone_rating_summary AS
SELECT
  cdr.location_id,
  COALESCE(co.zone, 'unbekannt')            AS zone,
  COUNT(cdr.id)                             AS total_ratings,
  ROUND(AVG(cdr.rating)::NUMERIC, 2)        AS avg_rating,
  COUNT(*) FILTER (WHERE cdr.rating >= 4)   AS positive_count,
  COUNT(*) FILTER (WHERE cdr.rating <= 2)   AS negative_count,
  COUNT(*) FILTER (WHERE cdr.rating = 5)    AS five_star_count,
  COUNT(*) FILTER (WHERE cdr.rating = 1)    AS one_star_count,
  MAX(cdr.created_at)                       AS last_rating_at
FROM customer_delivery_ratings cdr
LEFT JOIN customer_orders co ON co.id = cdr.order_id
GROUP BY cdr.location_id, COALESCE(co.zone, 'unbekannt');

-- ── View: Ø-Rating je Tagesstunde ────────────────────────────────────────────
CREATE OR REPLACE VIEW v_tageszeit_rating AS
SELECT
  location_id,
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::INT  AS hour_of_day,
  COUNT(id)                                              AS total_ratings,
  ROUND(AVG(rating)::NUMERIC, 2)                         AS avg_rating,
  COUNT(*) FILTER (WHERE rating <= 2)                    AS negative_count,
  COUNT(*) FILTER (WHERE rating >= 4)                    AS positive_count
FROM customer_delivery_ratings
GROUP BY location_id, EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::INT;

-- ── View: Fahrer-Rangliste nach Kundenbewertung ───────────────────────────────
CREATE OR REPLACE VIEW v_driver_rating_rangliste AS
SELECT
  cdr.location_id,
  cdr.driver_id,
  d.name                                               AS driver_name,
  COUNT(cdr.id)                                        AS total_ratings,
  ROUND(AVG(cdr.rating)::NUMERIC, 2)                   AS avg_rating,
  COUNT(*) FILTER (WHERE cdr.rating >= 4)              AS positive_count,
  COUNT(*) FILTER (WHERE cdr.rating <= 2)              AS negative_count,
  COUNT(*) FILTER (WHERE cdr.rating = 5)               AS five_star_count,
  COUNT(*) FILTER (WHERE cdr.rating = 1)               AS one_star_count,
  MAX(cdr.created_at)                                  AS last_rating_at,
  ROW_NUMBER() OVER (
    PARTITION BY cdr.location_id
    ORDER BY AVG(cdr.rating) DESC, COUNT(cdr.id) DESC
  )                                                    AS rang
FROM customer_delivery_ratings cdr
LEFT JOIN mise_drivers d ON d.id = cdr.driver_id
WHERE cdr.driver_id IS NOT NULL
GROUP BY cdr.location_id, cdr.driver_id, d.name;

-- ── RPC: Ø-Rating Trend (letzte N Tage je Tag) ──────────────────────────────
CREATE OR REPLACE FUNCTION get_rating_daily_trend(
  p_location_id UUID,
  p_days        INT DEFAULT 30
)
RETURNS TABLE(
  rating_day   DATE,
  total        BIGINT,
  avg_rating   NUMERIC,
  positive_pct NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    DATE_TRUNC('day', created_at)::DATE              AS rating_day,
    COUNT(*)                                         AS total,
    ROUND(AVG(rating)::NUMERIC, 2)                   AS avg_rating,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE rating >= 4)
        / NULLIF(COUNT(*), 0),
      1
    )                                                AS positive_pct
  FROM customer_delivery_ratings
  WHERE location_id = p_location_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE_TRUNC('day', created_at)::DATE
  ORDER BY rating_day ASC;
$$;
