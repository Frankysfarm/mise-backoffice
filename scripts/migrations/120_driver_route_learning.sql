-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 120: Smart Driver Route Learning (Phase 231)
-- Fahrer-spezifische Routen-Lernkurve
-- ─────────────────────────────────────────────────────────────────────────────

-- Raw stop observations (one row per delivered stop per driver)
CREATE TABLE IF NOT EXISTS driver_route_observations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL,
  driver_id       UUID NOT NULL,
  batch_id        UUID NOT NULL,
  order_id        UUID,
  plz             TEXT NOT NULL,
  delivery_zone   TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  observed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivery_min    DOUBLE PRECISION,  -- actual time from pickup to this stop delivery
  on_time         BOOLEAN,
  UNIQUE (batch_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_dro_location_driver_plz
  ON driver_route_observations (location_id, driver_id, plz, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dro_location_observed
  ON driver_route_observations (location_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dro_driver_plz
  ON driver_route_observations (driver_id, plz, observed_at DESC);

-- Aggregated proficiency profile per driver+PLZ
CREATE TABLE IF NOT EXISTS driver_route_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID NOT NULL,
  driver_id         UUID NOT NULL,
  plz               TEXT NOT NULL,
  stop_count        INTEGER NOT NULL DEFAULT 0,
  avg_delivery_min  DOUBLE PRECISION,
  on_time_rate      DOUBLE PRECISION, -- 0.0–1.0
  proficiency_score INTEGER NOT NULL DEFAULT 0, -- 0–100
  last_delivery_at  TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, driver_id, plz)
);

CREATE INDEX IF NOT EXISTS idx_drp_location_plz_score
  ON driver_route_profiles (location_id, plz, proficiency_score DESC);

CREATE INDEX IF NOT EXISTS idx_drp_location_driver
  ON driver_route_profiles (location_id, driver_id);

-- RPC: prune old observations
CREATE OR REPLACE FUNCTION prune_old_driver_route_observations(days_to_keep INTEGER DEFAULT 120)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM driver_route_observations
  WHERE observed_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
