-- Migration 123: Smart Delivery Driver Feedback Loop (Phase 235)
-- Fahrer-Feedback nach jeder Tour: Rating, Mood, Issue-Types, Notiz
-- Aggregiert in Fahrer-Performance-Score eingerechnet.

-- ─── Feedback-Berichte ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_feedback_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  driver_id      UUID NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  tour_id        UUID NULL,
  batch_id       UUID NULL,
  rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  mood           TEXT     NOT NULL CHECK (mood IN ('great','good','neutral','tired','frustrated')),
  issue_types    TEXT[]   NOT NULL DEFAULT '{}',
  note           TEXT     NULL,
  tours_today    INTEGER  NOT NULL DEFAULT 0,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fahrer darf pro Tour nur einmal Feedback abgeben
CREATE UNIQUE INDEX IF NOT EXISTS uidx_driver_feedback_tour
  ON driver_feedback_reports(driver_id, tour_id)
  WHERE tour_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dfr_location ON driver_feedback_reports(location_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_dfr_driver   ON driver_feedback_reports(driver_id, submitted_at DESC);

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE driver_feedback_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on driver_feedback_reports"
  ON driver_feedback_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── VIEW: Fahrer-Zusammenfassung (letzte 30 Tage) ─────────────────────────
CREATE OR REPLACE VIEW v_driver_feedback_summary AS
SELECT
  dfr.location_id,
  dfr.driver_id,
  COUNT(*)                                                       AS total_reports,
  ROUND(AVG(dfr.rating)::NUMERIC, 2)                            AS avg_rating,
  COUNT(*) FILTER (WHERE dfr.rating >= 4)                        AS positive_count,
  COUNT(*) FILTER (WHERE dfr.rating = 3)                         AS neutral_count,
  COUNT(*) FILTER (WHERE dfr.rating <= 2)                        AS negative_count,
  COUNT(*) FILTER (WHERE dfr.mood IN ('great','good'))           AS good_mood_count,
  COUNT(*) FILTER (WHERE dfr.mood IN ('tired','frustrated'))     AS bad_mood_count,
  COUNT(*) FILTER (WHERE array_length(dfr.issue_types,1) > 0)   AS reports_with_issues,
  MAX(dfr.submitted_at)                                          AS last_feedback_at
FROM driver_feedback_reports dfr
WHERE dfr.submitted_at >= NOW() - INTERVAL '30 days'
GROUP BY dfr.location_id, dfr.driver_id;

-- ─── VIEW: Häufigste Issue-Types pro Location (letzte 14 Tage) ─────────────
CREATE OR REPLACE VIEW v_feedback_issue_frequency AS
SELECT
  dfr.location_id,
  issue_type,
  COUNT(*) AS occurrence_count
FROM driver_feedback_reports dfr,
     UNNEST(dfr.issue_types) AS issue_type
WHERE dfr.submitted_at >= NOW() - INTERVAL '14 days'
GROUP BY dfr.location_id, issue_type
ORDER BY dfr.location_id, occurrence_count DESC;

-- ─── VIEW: Standort-Gesamt-Dashboard (letzte 7 Tage) ──────────────────────
CREATE OR REPLACE VIEW v_feedback_location_overview AS
SELECT
  location_id,
  COUNT(*)                                                       AS total_reports_7d,
  ROUND(AVG(rating)::NUMERIC, 2)                                AS avg_rating_7d,
  COUNT(*) FILTER (WHERE rating >= 4)                            AS positive_7d,
  COUNT(*) FILTER (WHERE rating <= 2)                            AS negative_7d,
  COUNT(*) FILTER (WHERE mood IN ('tired','frustrated'))         AS bad_mood_7d,
  COUNT(DISTINCT driver_id)                                      AS drivers_with_feedback
FROM driver_feedback_reports
WHERE submitted_at >= NOW() - INTERVAL '7 days'
GROUP BY location_id;

-- ─── Prune-Funktion ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_driver_feedback(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM driver_feedback_reports
  WHERE submitted_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
