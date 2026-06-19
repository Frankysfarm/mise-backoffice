-- Phase 274: Fahrer-Rückkehr-Vorhersage (Predictive Return-to-Base Engine)
-- Prognostiziert wann aktive Fahrer wieder zur Basis zurückkehren

-- ── Tabelle: driver_return_predictions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_return_predictions (
  id                     uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id              uuid    NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id            uuid    NOT NULL REFERENCES locations(id)    ON DELETE CASCADE,
  batch_id               uuid    REFERENCES mise_delivery_batches(id) ON DELETE SET NULL,
  predicted_at           timestamptz NOT NULL DEFAULT now(),
  estimated_return_utc   timestamptz NOT NULL,
  remaining_stops        integer NOT NULL DEFAULT 0,
  total_stops            integer NOT NULL DEFAULT 0,
  predicted_remaining_km numeric(8,2),
  minutes_until_return   integer NOT NULL DEFAULT 0,
  confidence             numeric(4,2) NOT NULL DEFAULT 0.5
                           CHECK (confidence >= 0 AND confidence <= 1),
  method                 text    NOT NULL DEFAULT 'haversine'
                           CHECK (method IN ('haversine','historical','fallback','returning')),
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

-- Nur eine Vorhersage pro Fahrer pro Minute (Upsert-Ziel)
CREATE UNIQUE INDEX IF NOT EXISTS driver_return_predictions_driver_min_idx
  ON driver_return_predictions (driver_id, date_trunc('minute', predicted_at));

CREATE INDEX IF NOT EXISTS driver_return_predictions_location_idx
  ON driver_return_predictions (location_id, predicted_at DESC);

CREATE INDEX IF NOT EXISTS driver_return_predictions_return_time_idx
  ON driver_return_predictions (estimated_return_utc)
  WHERE minutes_until_return > 0;

-- RLS
ALTER TABLE driver_return_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all" ON driver_return_predictions FOR ALL TO service_role USING (true);

-- updated_at Trigger
CREATE OR REPLACE FUNCTION _trg_drp_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_drp_updated_at
  BEFORE UPDATE ON driver_return_predictions
  FOR EACH ROW EXECUTE FUNCTION _trg_drp_updated_at();

-- ── VIEW: v_driver_return_latest ──────────────────────────────────────────────
-- Neueste Vorhersage je Fahrer mit Fahrer-Infos
CREATE OR REPLACE VIEW v_driver_return_latest AS
SELECT DISTINCT ON (drp.driver_id)
  drp.id,
  drp.driver_id,
  drp.location_id,
  drp.batch_id,
  drp.predicted_at,
  drp.estimated_return_utc,
  drp.remaining_stops,
  drp.total_stops,
  drp.predicted_remaining_km,
  drp.minutes_until_return,
  drp.confidence,
  drp.method,
  d.name         AS driver_name,
  d.vehicle      AS driver_vehicle,
  d.state        AS driver_state,
  l.name         AS location_name
FROM driver_return_predictions drp
JOIN mise_drivers d ON d.id = drp.driver_id
JOIN locations    l ON l.id = drp.location_id
ORDER BY drp.driver_id, drp.predicted_at DESC;

-- ── VIEW: v_drivers_returning_soon ────────────────────────────────────────────
-- Fahrer die in den nächsten 15 Minuten zurückkommen
CREATE OR REPLACE VIEW v_drivers_returning_soon AS
SELECT *
FROM v_driver_return_latest
WHERE estimated_return_utc > now()
  AND estimated_return_utc <= now() + INTERVAL '15 minutes'
ORDER BY estimated_return_utc ASC;

-- ── RPC: prune_old_return_predictions ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_return_predictions(p_days integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM driver_return_predictions
  WHERE created_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
