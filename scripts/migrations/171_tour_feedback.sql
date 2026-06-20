-- Phase 355: Tour Feedback Loop
-- Drivers rate completed tours; data feeds future dispatch improvements

CREATE TABLE IF NOT EXISTS tour_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  batch_id        UUID NOT NULL,  -- references mise_delivery_batches
  driver_id       UUID NOT NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ratings 1-5
  difficulty_rating   SMALLINT CHECK (difficulty_rating BETWEEN 1 AND 5),
  traffic_rating      SMALLINT CHECK (traffic_rating BETWEEN 1 AND 5),
  customer_rating     SMALLINT CHECK (customer_rating BETWEEN 1 AND 5),

  -- Issues (booleans)
  had_parking_issue   BOOLEAN NOT NULL DEFAULT false,
  had_customer_issue  BOOLEAN NOT NULL DEFAULT false,
  had_nav_issue       BOOLEAN NOT NULL DEFAULT false,
  had_address_issue   BOOLEAN NOT NULL DEFAULT false,

  -- Free text
  driver_notes        TEXT,

  -- Computed aggregates (filled by trigger or app)
  overall_score       NUMERIC(4,2) GENERATED ALWAYS AS (
    ROUND(
      COALESCE(difficulty_rating, 3) * 0.3 +
      COALESCE(traffic_rating, 3) * 0.3 +
      COALESCE(customer_rating, 3) * 0.4,
      2
    )
  ) STORED,

  CONSTRAINT tour_feedback_batch_driver_unique UNIQUE (batch_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_tour_feedback_location_date
  ON tour_feedback (location_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_tour_feedback_driver
  ON tour_feedback (driver_id, submitted_at DESC);

ALTER TABLE tour_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role full access" ON tour_feedback
  USING (auth.role() = 'service_role');

-- Prune RPC
CREATE OR REPLACE FUNCTION prune_tour_feedback(days_to_keep INT DEFAULT 90)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted INT;
BEGIN
  DELETE FROM tour_feedback WHERE submitted_at < now() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
