-- Migration 128: Driver Ramp-Up Intelligence Engine
-- Tracks new driver performance in the first 60 days / 200 deliveries
-- Computes ramp-up score from daily performance snapshots

-- ── Ramp-Up-Profile: ein Eintrag pro Fahrer ──────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_ramp_up_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id             UUID NOT NULL,
  location_id           UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Fahrer-Info (denormalisiert für schnellen Zugriff)
  driver_name           TEXT,
  vehicle_type          TEXT,

  -- Zeitraum-Tracking
  first_delivery_at     TIMESTAMPTZ,               -- erster Snapshot-Tag (Proxy für erste Lieferung)
  ramp_up_day           INTEGER NOT NULL DEFAULT 0, -- Tage seit erster Lieferung

  -- Performance-Metriken (Aggregate über Ramp-Up-Periode)
  deliveries_in_period  INTEGER NOT NULL DEFAULT 0,  -- Stops in den ersten 60 Tagen
  on_time_rate_pct      NUMERIC(5,2),                -- Ø Pünktlichkeitsrate (%)
  avg_delivery_min      NUMERIC(6,2),                -- Ø Lieferzeit (Minuten)
  avg_rating            NUMERIC(3,2),                -- Ø Kundenbewertung (1-5)
  cancellation_rate_pct NUMERIC(5,2),                -- Stornierungsrate (%)

  -- Score & Tier
  ramp_up_score         INTEGER NOT NULL DEFAULT 0 CHECK (ramp_up_score BETWEEN 0 AND 100),
  ramp_up_tier          TEXT NOT NULL DEFAULT 'developing'
                          CHECK(ramp_up_tier IN ('struggling', 'developing', 'promising', 'graduated')),

  -- Coaching
  coaching_flag         BOOLEAN NOT NULL DEFAULT FALSE,
  coaching_reason       TEXT,
  coaching_flagged_at   TIMESTAMPTZ,
  coaching_flagged_by   UUID,

  -- Retention-Prognose
  predicted_retention   TEXT CHECK(predicted_retention IN ('high', 'medium', 'low')),

  -- Abschluss
  graduated_at          TIMESTAMPTZ,

  -- Meta
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(driver_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_ramp_up_location_tier
  ON driver_ramp_up_profiles(location_id, ramp_up_tier);
CREATE INDEX IF NOT EXISTS idx_ramp_up_location_score
  ON driver_ramp_up_profiles(location_id, ramp_up_score DESC);
CREATE INDEX IF NOT EXISTS idx_ramp_up_graduated_at
  ON driver_ramp_up_profiles(location_id, graduated_at DESC NULLS FIRST)
  WHERE graduated_at IS NOT NULL;

-- ── RLS: Mandanten-Isolation ─────────────────────────────────────────────────
ALTER TABLE driver_ramp_up_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_ramp_up_profiles' AND policyname = 'driver_ramp_up_location_isolation'
  ) THEN
    CREATE POLICY driver_ramp_up_location_isolation
      ON driver_ramp_up_profiles
      USING (
        location_id IN (
          SELECT e.location_id FROM employees e WHERE e.id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── VIEW: Neue Fahrer im Ramp-Up (noch nicht abgeschlossen) ─────────────────
CREATE OR REPLACE VIEW v_active_ramp_up AS
SELECT
  r.*,
  CASE
    WHEN r.ramp_up_day >= 60 OR r.deliveries_in_period >= 200 THEN TRUE
    ELSE FALSE
  END AS ramp_up_complete,
  60 - r.ramp_up_day AS days_remaining
FROM driver_ramp_up_profiles r
WHERE r.graduated_at IS NULL
  AND r.ramp_up_tier != 'graduated';

-- ── UPDATE-Trigger für updated_at ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_ramp_up_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ramp_up_updated_at ON driver_ramp_up_profiles;
CREATE TRIGGER trg_ramp_up_updated_at
  BEFORE UPDATE ON driver_ramp_up_profiles
  FOR EACH ROW EXECUTE FUNCTION set_ramp_up_updated_at();
