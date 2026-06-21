-- Migration 180: Tour-End-Prognosen
-- Echtzeit-Vorhersage wann ein aktiver Batch alle Stops abgeschlossen hat.
-- Hilft Dispatch beim Planen des nächsten Batch und der Küche bei der Kapazitätsplanung.

CREATE TABLE IF NOT EXISTS tour_end_predictions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              UUID        NOT NULL,
  location_id           UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Prognose
  predicted_end_utc     TIMESTAMPTZ NOT NULL,
  confidence            SMALLINT    NOT NULL DEFAULT 70  CHECK (confidence BETWEEN 0 AND 100),
  remaining_stops       SMALLINT    NOT NULL DEFAULT 0,
  completed_stops       SMALLINT    NOT NULL DEFAULT 0,
  avg_min_per_stop      NUMERIC(6,2),          -- aktueller Ø-Rhythmus des Fahrers
  predicted_duration_min NUMERIC(6,2),         -- noch verbleibende Zeit in Minuten
  driver_id             UUID,
  vehicle               TEXT        DEFAULT 'bike',

  -- Abschluss (wenn Batch fertig)
  settled_at            TIMESTAMPTZ,
  actual_end_utc        TIMESTAMPTZ,           -- tatsächlicher Abschluss-Zeitpunkt
  error_min             NUMERIC(6,2),          -- Abweichung Prognose vs. tatsächlich (+ = zu früh, - = zu spät)

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Eine aktive Prognose je Batch (UPSERT-Schlüssel)
  UNIQUE (batch_id)
);

CREATE INDEX IF NOT EXISTS idx_tour_end_pred_loc_created
  ON tour_end_predictions (location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tour_end_pred_unsettled
  ON tour_end_predictions (location_id, settled_at)
  WHERE settled_at IS NULL;

-- RLS: service_role schreibt, authenticated liest eigene Location
ALTER TABLE tour_end_predictions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='tour_end_predictions' AND policyname='service_role full'
  ) THEN
    CREATE POLICY "service_role full" ON tour_end_predictions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- updated_at Trigger
CREATE OR REPLACE FUNCTION trg_tour_end_predictions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_tour_end_predictions_updated_at ON tour_end_predictions;
CREATE TRIGGER trg_tour_end_predictions_updated_at
  BEFORE UPDATE ON tour_end_predictions
  FOR EACH ROW EXECUTE PROCEDURE trg_tour_end_predictions_updated_at();

-- Prune-RPC
CREATE OR REPLACE FUNCTION prune_tour_end_predictions(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pruned INTEGER;
BEGIN
  DELETE FROM tour_end_predictions
  WHERE settled_at IS NOT NULL
    AND settled_at < now() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS pruned = ROW_COUNT;
  RETURN pruned;
END; $$;

-- View: aktuelle Prognosen mit Driver-Join (für Dashboard)
CREATE OR REPLACE VIEW v_active_tour_end_predictions AS
SELECT
  tep.id,
  tep.batch_id,
  tep.location_id,
  tep.predicted_end_utc,
  tep.confidence,
  tep.remaining_stops,
  tep.completed_stops,
  tep.avg_min_per_stop,
  tep.predicted_duration_min,
  tep.driver_id,
  tep.vehicle,
  tep.created_at,
  tep.updated_at
FROM tour_end_predictions tep
WHERE tep.settled_at IS NULL;
