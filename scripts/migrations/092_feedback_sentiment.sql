-- Migration 092: Kunden-Feedback-Sentiment-Engine
-- Phase 181 — Keyword-basierte Sentiment-Analyse von Bewertungskommentaren

-- ──────────────────────────────────────────────────────────────────────────────
-- Sentiment-Analyse-Ergebnisse
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_feedback_sentiment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  rating_id       UUID NOT NULL,  -- FK auf customer_ratings.id (kein hard-FK wg. partitionierter Tabellen)
  driver_id       UUID NULL,
  order_id        UUID NULL,
  raw_comment     TEXT NOT NULL,
  rating_score    SMALLINT NOT NULL CHECK (rating_score BETWEEN 1 AND 5),
  -- Sentiment: -1.0 (sehr negativ) bis +1.0 (sehr positiv)
  sentiment_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  sentiment_label TEXT NOT NULL DEFAULT 'neutral'
    CHECK (sentiment_label IN ('positive', 'neutral', 'negative')),
  -- Top-Keywords aus dem Kommentar (max 10)
  keywords        JSONB NOT NULL DEFAULT '[]',
  -- Erkannte Themen: delivery/food/driver/time/packaging/price/other
  topics          JSONB NOT NULL DEFAULT '[]',
  is_flagged      BOOLEAN NOT NULL DEFAULT FALSE,  -- sehr negativ oder spezifische Trigger-Wörter
  analyzed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS delivery_feedback_sentiment_rating_idx
  ON delivery_feedback_sentiment (rating_id);

CREATE INDEX IF NOT EXISTS delivery_feedback_sentiment_location_idx
  ON delivery_feedback_sentiment (location_id, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS delivery_feedback_sentiment_driver_idx
  ON delivery_feedback_sentiment (driver_id, location_id)
  WHERE driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS delivery_feedback_sentiment_flagged_idx
  ON delivery_feedback_sentiment (location_id, is_flagged)
  WHERE is_flagged = TRUE;

-- ──────────────────────────────────────────────────────────────────────────────
-- Übersichts-VIEW pro Location
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_feedback_sentiment_summary AS
SELECT
  location_id,
  COUNT(*)                                                      AS total_analyzed,
  COUNT(*) FILTER (WHERE sentiment_label = 'positive')         AS positive_count,
  COUNT(*) FILTER (WHERE sentiment_label = 'neutral')          AS neutral_count,
  COUNT(*) FILTER (WHERE sentiment_label = 'negative')         AS negative_count,
  ROUND(AVG(sentiment_score)::NUMERIC, 3)                      AS avg_sentiment,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE sentiment_label = 'positive') / NULLIF(COUNT(*), 0), 1
  )                                                             AS positive_pct,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE sentiment_label = 'negative') / NULLIF(COUNT(*), 0), 1
  )                                                             AS negative_pct,
  COUNT(*) FILTER (WHERE is_flagged)                           AS flagged_count,
  MAX(analyzed_at)                                             AS last_analyzed_at
FROM delivery_feedback_sentiment
GROUP BY location_id;

-- ──────────────────────────────────────────────────────────────────────────────
-- Fahrer-Sentiment-VIEW
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_driver_sentiment AS
SELECT
  driver_id,
  location_id,
  COUNT(*)                                                      AS total_analyzed,
  COUNT(*) FILTER (WHERE sentiment_label = 'positive')         AS positive_count,
  COUNT(*) FILTER (WHERE sentiment_label = 'negative')         AS negative_count,
  ROUND(AVG(sentiment_score)::NUMERIC, 3)                      AS avg_sentiment,
  ROUND(AVG(rating_score)::NUMERIC, 2)                         AS avg_star_rating,
  COUNT(*) FILTER (WHERE is_flagged)                           AS flagged_count,
  MAX(analyzed_at)                                             AS last_analyzed_at
FROM delivery_feedback_sentiment
WHERE driver_id IS NOT NULL
GROUP BY driver_id, location_id;

-- ──────────────────────────────────────────────────────────────────────────────
-- Tages-Trend VIEW (letzte 30 Tage)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_feedback_sentiment_daily AS
SELECT
  location_id,
  DATE(analyzed_at)                                             AS day,
  COUNT(*)                                                      AS total,
  COUNT(*) FILTER (WHERE sentiment_label = 'positive')         AS positive_count,
  COUNT(*) FILTER (WHERE sentiment_label = 'negative')         AS negative_count,
  ROUND(AVG(sentiment_score)::NUMERIC, 3)                      AS avg_sentiment
FROM delivery_feedback_sentiment
WHERE analyzed_at >= now() - INTERVAL '30 days'
GROUP BY location_id, DATE(analyzed_at)
ORDER BY day DESC;

-- ──────────────────────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE delivery_feedback_sentiment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_feedback_sentiment" ON delivery_feedback_sentiment;
CREATE POLICY "service_role_all_feedback_sentiment"
  ON delivery_feedback_sentiment
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
