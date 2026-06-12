-- Migration 056: Customer Delivery Experience Score (CDES)
-- Phase 95 — 2026-06-12
--
-- Berechnet pro abgeschlossener Lieferbestellung einen ganzheitlichen
-- Erfahrungs-Score (0–100) aus 4 Komponenten:
--   eta_accuracy_score   (0–30): War die Lieferung pünktlich?
--   notification_score   (0–20): Wurden Benachrichtigungen korrekt gesendet?
--   driver_quality_score (0–25): Wie zuverlässig ist der Fahrer (Reliability-Tier)?
--   attempt_score        (0–25): Wurde beim ersten Versuch zugestellt?
--
-- Scores < 40 lösen automatisch Recovery aus (Gutschrift + Incident-Eskalation).

-- ─── Haupt-Tabelle ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_experience_scores (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id                uuid        NOT NULL,
  location_id             uuid        NOT NULL,
  score                   integer     NOT NULL CHECK (score BETWEEN 0 AND 100),

  -- Komponenten-Scores
  eta_accuracy_score      integer     NOT NULL DEFAULT 0 CHECK (eta_accuracy_score      BETWEEN 0 AND 30),
  notification_score      integer     NOT NULL DEFAULT 0 CHECK (notification_score      BETWEEN 0 AND 20),
  driver_quality_score    integer     NOT NULL DEFAULT 0 CHECK (driver_quality_score    BETWEEN 0 AND 25),
  attempt_score           integer     NOT NULL DEFAULT 0 CHECK (attempt_score           BETWEEN 0 AND 25),

  -- Roh-Signale
  actual_delivery_min     integer,
  estimated_delivery_min  integer,
  notification_count      integer     NOT NULL DEFAULT 0,
  had_failed_attempt      boolean     NOT NULL DEFAULT false,
  driver_reliability_tier text,           -- excellent/good/medium/critical/unknown

  -- Recovery
  recovery_triggered      boolean     NOT NULL DEFAULT false,
  recovery_credit_id      uuid,
  recovery_incident_id    uuid,

  computed_at             timestamptz NOT NULL DEFAULT now(),

  UNIQUE (order_id)
);

-- ─── Indizes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cdes_location_id   ON customer_experience_scores (location_id);
CREATE INDEX IF NOT EXISTS idx_cdes_score         ON customer_experience_scores (score);
CREATE INDEX IF NOT EXISTS idx_cdes_computed_at   ON customer_experience_scores (computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cdes_recovery      ON customer_experience_scores (location_id, recovery_triggered)
  WHERE recovery_triggered = false;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE customer_experience_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "cdes_service_all"
  ON customer_experience_scores
  USING (true)
  WITH CHECK (true);

-- ─── Übersichts-View (pro Location) ──────────────────────────────────────────

CREATE OR REPLACE VIEW v_cdes_summary AS
SELECT
  location_id,
  COUNT(*)                                                     AS total_scored,
  ROUND(AVG(score))::integer                                   AS avg_score,
  ROUND(AVG(eta_accuracy_score))::integer                      AS avg_eta_score,
  ROUND(AVG(notification_score))::integer                      AS avg_notification_score,
  ROUND(AVG(driver_quality_score))::integer                    AS avg_driver_score,
  ROUND(AVG(attempt_score))::integer                           AS avg_attempt_score,
  COUNT(*) FILTER (WHERE score >= 80)                          AS excellent_count,
  COUNT(*) FILTER (WHERE score >= 60 AND score < 80)           AS good_count,
  COUNT(*) FILTER (WHERE score >= 40 AND score < 60)           AS fair_count,
  COUNT(*) FILTER (WHERE score < 40)                           AS poor_count,
  COUNT(*) FILTER (WHERE recovery_triggered)                   AS recoveries_triggered,
  COUNT(*) FILTER (WHERE had_failed_attempt)                   AS failed_attempts_total,
  MAX(computed_at)                                             AS last_computed_at
FROM customer_experience_scores
GROUP BY location_id;

-- ─── Tages-Trend-View ────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_cdes_daily_trend AS
SELECT
  location_id,
  (computed_at AT TIME ZONE 'Europe/Berlin')::date             AS score_date,
  COUNT(*)                                                     AS scored_count,
  ROUND(AVG(score))::integer                                   AS avg_score,
  COUNT(*) FILTER (WHERE score >= 80)                          AS excellent_count,
  COUNT(*) FILTER (WHERE score < 40)                           AS poor_count,
  COUNT(*) FILTER (WHERE recovery_triggered)                   AS recoveries_count
FROM customer_experience_scores
GROUP BY location_id, (computed_at AT TIME ZONE 'Europe/Berlin')::date
ORDER BY score_date DESC;
