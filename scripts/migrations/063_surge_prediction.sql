-- =============================================================
-- Migration 063: Predictive Surge Engine & Driver Mobilization
-- Sagt Nachfragespitzen 30–60 Min voraus + mobilisiert Fahrer proaktiv
-- =============================================================

-- 1. Surge-Vorhersagen
CREATE TABLE IF NOT EXISTS surge_predictions (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         text         NOT NULL,
  predicted_at        timestamptz  NOT NULL DEFAULT now(),
  surge_window_start  timestamptz  NOT NULL,
  surge_window_end    timestamptz  NOT NULL,
  predicted_intensity text         NOT NULL DEFAULT 'medium'
                      CHECK (predicted_intensity IN ('low', 'medium', 'high')),
  confidence_pct      int          NOT NULL DEFAULT 50
                      CHECK (confidence_pct BETWEEN 0 AND 100),
  signals             jsonb        NOT NULL DEFAULT '{}',
  broadcasts_sent     int          NOT NULL DEFAULT 0,
  actual_peak_orders  int,
  was_accurate        boolean,
  evaluated_at        timestamptz,
  created_at          timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_surge_predictions_location_time
  ON surge_predictions(location_id, predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_surge_predictions_window
  ON surge_predictions(location_id, surge_window_start)
  WHERE was_accurate IS NULL;

ALTER TABLE surge_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_surge_predictions
  ON surge_predictions FOR ALL
  USING (auth.role() = 'service_role');

-- 2. Fahrer-Mobilisierungs-Ereignisse
CREATE TABLE IF NOT EXISTS surge_mobilization_events (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id  uuid         NOT NULL REFERENCES surge_predictions(id) ON DELETE CASCADE,
  location_id    text         NOT NULL,
  driver_id      uuid         NOT NULL,
  notified_at    timestamptz  NOT NULL DEFAULT now(),
  came_online_at timestamptz,
  created_at     timestamptz  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobilization_prediction
  ON surge_mobilization_events(prediction_id);

CREATE INDEX IF NOT EXISTS idx_mobilization_driver
  ON surge_mobilization_events(driver_id, notified_at DESC);

ALTER TABLE surge_mobilization_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_mobilization_events
  ON surge_mobilization_events FOR ALL
  USING (auth.role() = 'service_role');

-- 3. View: Mobilisierungs-Effizienz (letzte 14 Tage)
CREATE OR REPLACE VIEW v_mobilization_effectiveness AS
SELECT
  sp.location_id,
  COUNT(sp.id)                                              AS predictions_total,
  COUNT(CASE WHEN sp.was_accurate = true  THEN 1 END)      AS accurate,
  COUNT(CASE WHEN sp.was_accurate = false THEN 1 END)      AS inaccurate,
  ROUND(
    COUNT(CASE WHEN sp.was_accurate = true THEN 1 END)::numeric /
    NULLIF(COUNT(CASE WHEN sp.was_accurate IS NOT NULL THEN 1 END), 0) * 100,
    1
  )                                                         AS accuracy_pct,
  COUNT(sme.id)                                             AS notifications_sent,
  COUNT(sme.came_online_at)                                 AS drivers_mobilized,
  ROUND(
    COUNT(sme.came_online_at)::numeric /
    NULLIF(COUNT(sme.id), 0) * 100,
    1
  )                                                         AS mobilization_rate_pct,
  ROUND(
    AVG(
      CASE WHEN sme.came_online_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (sme.came_online_at - sme.notified_at)) / 60
      END
    )::numeric,
    1
  )                                                         AS avg_response_time_min
FROM surge_predictions sp
LEFT JOIN surge_mobilization_events sme ON sme.prediction_id = sp.id
WHERE sp.predicted_at >= NOW() - INTERVAL '14 days'
GROUP BY sp.location_id;

-- 4. View: Letzte Vorhersagen (für Dashboard)
CREATE OR REPLACE VIEW v_recent_surge_predictions AS
SELECT
  sp.*,
  COUNT(sme.id)              AS notified_drivers,
  COUNT(sme.came_online_at)  AS responded_drivers
FROM surge_predictions sp
LEFT JOIN surge_mobilization_events sme ON sme.prediction_id = sp.id
WHERE sp.predicted_at >= NOW() - INTERVAL '48 hours'
GROUP BY sp.id
ORDER BY sp.predicted_at DESC;
