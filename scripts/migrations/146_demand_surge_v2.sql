-- 146_demand_surge_v2.sql
-- Phase 304 — Predictive Demand Surge Detection V2
--
-- Tabellen:
--   demand_surge_v2_baseline — Stündliche Basiskurve (Mittelwert + StdDev)
--   demand_surge_v2_alerts   — Detektierte Surge-Alerts mit Forecast

-- ── Stündliche Baseline (8-Wochen-Rolling-Average) ───────────────────────────
-- Wird täglich via rebuildHourlyBaseline() aktualisiert.
-- 7 Wochentage × 24 Stunden = 168 Slots je Location.

CREATE TABLE IF NOT EXISTS demand_surge_v2_baseline (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week   SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sonntag
  hour_of_day   SMALLINT    NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  mean_per_hour NUMERIC(6,1) NOT NULL DEFAULT 0,
  stddev        NUMERIC(6,2) NOT NULL DEFAULT 1,
  data_points   SMALLINT    NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (location_id, day_of_week, hour_of_day)
);

CREATE INDEX IF NOT EXISTS idx_surge_baseline_location
  ON demand_surge_v2_baseline(location_id, day_of_week, hour_of_day);

ALTER TABLE demand_surge_v2_baseline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "surge_baseline_admin" ON demand_surge_v2_baseline
  USING (location_id IN (SELECT location_id FROM employees WHERE user_id = auth.uid()));

-- ── Surge Alerts ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS demand_surge_v2_alerts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  surge_level     TEXT        NOT NULL CHECK (surge_level IN ('low','medium','high')),
  z_score         NUMERIC(5,2) NOT NULL,
  order_rate      NUMERIC(6,1) NOT NULL,   -- Bestellungen/h zum Zeitpunkt der Detektion
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  forecast_next_60 INT        NOT NULL DEFAULT 0,  -- Vorhergesagte Bestellungen nächste 60 Min
  dismissed       BOOLEAN     NOT NULL DEFAULT false,
  dismissed_at    TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_surge_alerts_location
  ON demand_surge_v2_alerts(location_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_surge_alerts_active
  ON demand_surge_v2_alerts(location_id, dismissed, resolved_at)
  WHERE dismissed = false AND resolved_at IS NULL;

ALTER TABLE demand_surge_v2_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "surge_alerts_admin" ON demand_surge_v2_alerts
  USING (location_id IN (SELECT location_id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "surge_alerts_service_write" ON demand_surge_v2_alerts
  FOR ALL WITH CHECK (true);

-- ── Auto-Resolve: Alert als gelöst markieren wenn neue Detektion 'normal' zeigt ─
-- Wird via API aufgerufen nach detectDemandSurgeV2() → level = 'normal'
CREATE OR REPLACE FUNCTION resolve_old_surge_alerts(p_location_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE resolved INT;
BEGIN
  UPDATE demand_surge_v2_alerts
    SET resolved_at = now()
  WHERE location_id = p_location_id
    AND dismissed   = false
    AND resolved_at IS NULL
    AND detected_at < now() - INTERVAL '90 minutes';
  GET DIAGNOSTICS resolved = ROW_COUNT;
  RETURN resolved;
END;
$$;

-- ── Cleanup (30 Tage alte Alerts löschen) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_surge_v2_alerts(days_old INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE deleted INT;
BEGIN
  DELETE FROM demand_surge_v2_alerts
  WHERE detected_at < now() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
