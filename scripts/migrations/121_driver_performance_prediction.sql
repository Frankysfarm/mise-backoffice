-- Migration 121: Smart Driver Performance Prediction (Phase 232)
--
-- Speichert tägliche Vorhersagen für jeden Fahrer (Touren, Pünktlichkeit,
-- Lieferzeit) und tracked die Prognose-Genauigkeit retrospektiv.

-- ── Vorhersage-Tabelle ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_performance_predictions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id             UUID NOT NULL,
  driver_id               UUID NOT NULL,
  prediction_date         DATE NOT NULL,

  -- Vorhersage-Werte
  predicted_tours         NUMERIC(6,2)  NOT NULL DEFAULT 0,
  predicted_stops         NUMERIC(8,2)  NOT NULL DEFAULT 0,
  predicted_on_time_rate  NUMERIC(5,4)  NOT NULL DEFAULT 0,   -- 0.0–1.0
  predicted_avg_min       NUMERIC(6,2)  NULL,                  -- Ø Lieferminuten

  -- Konfidenz & Klassifikation
  confidence_score        SMALLINT      NOT NULL DEFAULT 0,    -- 0–100
  performance_tier        TEXT          NOT NULL DEFAULT 'average', -- top|good|average|at_risk
  feature_weights         JSONB         NOT NULL DEFAULT '{}', -- Gewichtungs-Aufschlüsselung

  -- Retrospektiv befüllt (nach dem Tag)
  actual_tours            SMALLINT      NULL,
  actual_on_time_rate     NUMERIC(5,4)  NULL,
  accuracy_score          NUMERIC(5,2)  NULL,    -- 0–100, wie nah war die Prognose
  settled_at              TIMESTAMPTZ   NULL,

  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (location_id, driver_id, prediction_date)
);

CREATE INDEX IF NOT EXISTS idx_dpp_location_date
  ON driver_performance_predictions (location_id, prediction_date DESC);

CREATE INDEX IF NOT EXISTS idx_dpp_driver
  ON driver_performance_predictions (driver_id, prediction_date DESC);

CREATE INDEX IF NOT EXISTS idx_dpp_tier
  ON driver_performance_predictions (location_id, performance_tier, prediction_date DESC)
  WHERE settled_at IS NULL;

-- ── Prune-Funktion ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_performance_predictions(days_to_keep INT DEFAULT 90)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  deleted INT;
BEGIN
  DELETE FROM driver_performance_predictions
  WHERE prediction_date < CURRENT_DATE - days_to_keep;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
