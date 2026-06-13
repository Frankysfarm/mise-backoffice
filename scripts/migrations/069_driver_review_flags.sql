-- Migration 069: Fahrer-Review-Flags
-- Automatically flags drivers for review when customer ratings fall below thresholds.
-- Triggers: avg_rating < 3.0 over 14 days (≥3 ratings), or ≥2 one-star in 7 days.

-- ── Table: driver_review_flags ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_review_flags (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id           UUID        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,

  -- What triggered the flag
  flag_reason         TEXT        NOT NULL CHECK (flag_reason IN (
                                    'low_avg_14d',      -- avg < 3.0 over 14 days (≥3 ratings)
                                    'one_star_burst_7d', -- ≥2 one-star ratings within 7 days
                                    'manual'            -- manually created by admin
                                  )),
  bad_rating_count    INT         NOT NULL DEFAULT 0,
  avg_rating_window   NUMERIC(3,2),                    -- avg at time of flag
  window_days         INT         NOT NULL DEFAULT 14,

  -- Admin workflow
  review_status       TEXT        NOT NULL DEFAULT 'open'
                                  CHECK (review_status IN ('open', 'in_review', 'resolved', 'dismissed')),
  admin_notes         TEXT,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_drf_location_status
  ON driver_review_flags (location_id, review_status);
CREATE INDEX IF NOT EXISTS idx_drf_driver
  ON driver_review_flags (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drf_open
  ON driver_review_flags (location_id, driver_id)
  WHERE review_status IN ('open', 'in_review');

-- Prevent duplicate open flags per driver/location (only one active flag at a time)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_drf_driver_open
  ON driver_review_flags (location_id, driver_id)
  WHERE review_status IN ('open', 'in_review');

-- RLS
ALTER TABLE driver_review_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_review_flags"
  ON driver_review_flags
  USING (location_id IN (
    SELECT id FROM locations WHERE tenant_id = (
      SELECT tenant_id FROM locations WHERE id = driver_review_flags.location_id LIMIT 1
    )
  ));

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_driver_review_flags_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_drf_updated_at ON driver_review_flags;
CREATE TRIGGER trg_drf_updated_at
  BEFORE UPDATE ON driver_review_flags
  FOR EACH ROW EXECUTE FUNCTION update_driver_review_flags_updated_at();

-- ── VIEW: v_drivers_needing_review ───────────────────────────────────────────
-- Joins open/in_review flags with driver info for the admin dashboard.
CREATE OR REPLACE VIEW v_drivers_needing_review AS
SELECT
  f.id                              AS flag_id,
  f.location_id,
  f.driver_id,
  d.name                            AS driver_name,
  d.vehicle                         AS driver_vehicle,
  d.state                           AS driver_state,
  f.flag_reason,
  f.bad_rating_count,
  f.avg_rating_window,
  f.window_days,
  f.review_status,
  f.admin_notes,
  f.created_at                      AS flagged_at,
  f.updated_at,
  -- How many days since flag was raised
  EXTRACT(EPOCH FROM (NOW() - f.created_at)) / 86400 AS days_open
FROM driver_review_flags f
JOIN mise_drivers d ON d.id = f.driver_id
WHERE f.review_status IN ('open', 'in_review')
ORDER BY f.created_at ASC;

-- ── VIEW: v_review_flag_stats ─────────────────────────────────────────────────
-- Per-location summary for dashboard KPIs.
CREATE OR REPLACE VIEW v_review_flag_stats AS
SELECT
  location_id,
  COUNT(*) FILTER (WHERE review_status = 'open')        AS open_count,
  COUNT(*) FILTER (WHERE review_status = 'in_review')   AS in_review_count,
  COUNT(*) FILTER (WHERE review_status = 'resolved'
    AND resolved_at >= NOW() - INTERVAL '30 days')       AS resolved_30d,
  COUNT(*) FILTER (WHERE review_status = 'dismissed'
    AND updated_at >= NOW() - INTERVAL '30 days')        AS dismissed_30d,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS new_7d,
  AVG(avg_rating_window) FILTER (WHERE review_status IN ('open','in_review'))
                                                         AS avg_flagged_rating
FROM driver_review_flags
GROUP BY location_id;
