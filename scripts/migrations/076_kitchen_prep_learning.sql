-- Migration 076: Kitchen Prep Time Learning Engine
-- Lernt echte Zubereitungszeiten pro Location und Tageszeit-Bucket.
-- Kalibriert estimated_prep_min automatisch aus historischen Daten.

-- 1) Feld ready_at zu kitchen_timings hinzufügen (Zeitstempel "Essen fertig")
ALTER TABLE kitchen_timings ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

-- 2) Einzelbeobachtungen: für jede fertige Bestellung actual vs. estimated prep time
CREATE TABLE IF NOT EXISTS kitchen_prep_observations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id        UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id           UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  item_count         INT NOT NULL DEFAULT 1,
  estimated_prep_min NUMERIC(6,2) NOT NULL,
  actual_prep_min    NUMERIC(6,2) NOT NULL,
  hour_of_day        INT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  day_of_week        INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sonntag
  hour_bucket        INT NOT NULL CHECK (hour_bucket BETWEEN 0 AND 4),
  -- 0=Morgen(06-10), 1=Mittag(11-13), 2=Nachmittag(14-16), 3=Abend(17-21), 4=Spät(22-05)
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_kpo_location_bucket
  ON kitchen_prep_observations (location_id, hour_bucket, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_kpo_recorded_at
  ON kitchen_prep_observations (recorded_at DESC);

-- RLS: location-basierte Isolation
ALTER TABLE kitchen_prep_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "location_isolation" ON kitchen_prep_observations
  USING (location_id IN (
    SELECT tenant_id FROM employees WHERE user_id = auth.uid()
  ));

-- 3) Gelernte Profile: Zubereitungszeit-Statistiken pro Location + Tageszeit-Bucket
CREATE TABLE IF NOT EXISTS kitchen_prep_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  hour_bucket      INT NOT NULL CHECK (hour_bucket BETWEEN 0 AND 4),
  observations     INT NOT NULL DEFAULT 0,
  mean_prep_min    NUMERIC(6,2) NOT NULL DEFAULT 15,
  p75_prep_min     NUMERIC(6,2) NOT NULL DEFAULT 18,  -- empfohlene Schätzung
  p90_prep_min     NUMERIC(6,2) NOT NULL DEFAULT 22,  -- Puffer für hohe Last
  stddev_min       NUMERIC(6,2) NOT NULL DEFAULT 3,
  avg_delta_min    NUMERIC(6,2) NOT NULL DEFAULT 0,   -- systematische Abweichung
  accuracy_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,   -- % mit |delta| <= 3 Min
  last_updated     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, hour_bucket)
);

ALTER TABLE kitchen_prep_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "location_isolation" ON kitchen_prep_profiles
  USING (location_id IN (
    SELECT tenant_id FROM employees WHERE user_id = auth.uid()
  ));

-- 4) View: 30-Tage-Genauigkeits-Zusammenfassung pro Location
CREATE OR REPLACE VIEW v_prep_accuracy_30d AS
SELECT
  location_id,
  COUNT(*)                                                           AS total_observations,
  ROUND(AVG(actual_prep_min)::NUMERIC, 1)                           AS avg_actual_min,
  ROUND(AVG(estimated_prep_min)::NUMERIC, 1)                        AS avg_estimated_min,
  ROUND(AVG(actual_prep_min - estimated_prep_min)::NUMERIC, 1)      AS avg_delta_min,
  ROUND(STDDEV(actual_prep_min)::NUMERIC, 1)                        AS stddev_min,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY actual_prep_min)::NUMERIC, 1) AS p75_min,
  ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY actual_prep_min)::NUMERIC, 1) AS p90_min,
  ROUND(
    COUNT(*) FILTER (WHERE ABS(actual_prep_min - estimated_prep_min) <= 3)
    * 100.0 / NULLIF(COUNT(*), 0)
  , 1)                                                               AS accuracy_pct,
  MAX(recorded_at)                                                   AS last_observation_at
FROM kitchen_prep_observations
WHERE recorded_at > NOW() - INTERVAL '30 days'
GROUP BY location_id;

-- 5) View: Ausreißer (|delta| > 8 Min in letzten 7 Tagen)
CREATE OR REPLACE VIEW v_prep_outliers_7d AS
SELECT
  o.location_id,
  o.order_id,
  o.estimated_prep_min,
  o.actual_prep_min,
  ROUND((o.actual_prep_min - o.estimated_prep_min)::NUMERIC, 1) AS delta_min,
  o.hour_of_day,
  o.day_of_week,
  o.item_count,
  o.recorded_at,
  co.bestellnummer,
  co.item_count AS order_item_count
FROM kitchen_prep_observations o
LEFT JOIN customer_orders co ON co.id = o.order_id
WHERE o.recorded_at > NOW() - INTERVAL '7 days'
  AND ABS(o.actual_prep_min - o.estimated_prep_min) > 8
ORDER BY ABS(o.actual_prep_min - o.estimated_prep_min) DESC;

-- 6) View: Stunden-Bucket-Statistiken (alle Zeit)
CREATE OR REPLACE VIEW v_prep_bucket_stats AS
SELECT
  location_id,
  hour_bucket,
  CASE hour_bucket
    WHEN 0 THEN 'Morgen (06–10)'
    WHEN 1 THEN 'Mittag (11–13)'
    WHEN 2 THEN 'Nachmittag (14–16)'
    WHEN 3 THEN 'Abend (17–21)'
    WHEN 4 THEN 'Spät (22–05)'
  END AS bucket_label,
  COUNT(*)                                                                         AS observations,
  ROUND(AVG(actual_prep_min)::NUMERIC, 1)                                         AS mean_prep_min,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY actual_prep_min)::NUMERIC, 1) AS p75_prep_min,
  ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY actual_prep_min)::NUMERIC, 1) AS p90_prep_min,
  ROUND(STDDEV(actual_prep_min)::NUMERIC, 1)                                      AS stddev_min,
  ROUND(AVG(actual_prep_min - estimated_prep_min)::NUMERIC, 1)                    AS avg_delta_min
FROM kitchen_prep_observations
WHERE recorded_at > NOW() - INTERVAL '90 days'
GROUP BY location_id, hour_bucket
ORDER BY location_id, hour_bucket;

-- 7) Cleanup-Funktion für alte Beobachtungen
CREATE OR REPLACE FUNCTION prune_old_prep_observations(days_old INT DEFAULT 90)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM kitchen_prep_observations
  WHERE recorded_at < NOW() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
