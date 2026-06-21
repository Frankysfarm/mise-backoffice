-- Phase 360: Tour Feedback Aggregates — Weekly/Monthly Management Reports
-- Aggregiert tour_feedback pro Fahrer nach Woche/Monat für Management-Reporting

CREATE TABLE IF NOT EXISTS tour_feedback_aggregates (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id             uuid        NOT NULL,
  period_type           text        NOT NULL CHECK (period_type IN ('week', 'month')),
  period_start          date        NOT NULL,
  avg_difficulty        numeric(4,2),
  avg_traffic           numeric(4,2),
  avg_customer_rating   numeric(4,2),
  avg_overall_score     numeric(4,2),
  feedback_count        integer     NOT NULL DEFAULT 0,
  parking_issue_rate    numeric(5,2),   -- 0–100 %
  nav_issue_rate        numeric(5,2),
  address_issue_rate    numeric(5,2),
  customer_issue_rate   numeric(5,2),
  top_zone              text,           -- häufigste Zone dieses Zeitraums
  computed_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tour_feedback_aggregates_uq UNIQUE (location_id, driver_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_tfa_location_period
  ON tour_feedback_aggregates (location_id, period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_tfa_driver
  ON tour_feedback_aggregates (driver_id, period_start DESC);

ALTER TABLE tour_feedback_aggregates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_tfa" ON tour_feedback_aggregates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cleanup-Funktion für alte Aggregate
CREATE OR REPLACE FUNCTION prune_tour_feedback_aggregates(days_old integer DEFAULT 365)
RETURNS integer LANGUAGE sql AS $$
  WITH deleted AS (
    DELETE FROM tour_feedback_aggregates
    WHERE computed_at < now() - (days_old || ' days')::interval
    RETURNING id
  ) SELECT count(*)::integer FROM deleted;
$$;
