-- Migration 074: Smart Peak Day Intelligence & Event Preparation Engine
-- Phase 120 — 2026-06-13
--
-- Erkennt Spitzentage im Voraus durch:
--  1. Historische Tages-Muster (tatsächliche vs. erwartete Last pro Wochentag)
--  2. Manuell gepflegte Event-Kalender (Feiertage, Sportspiele, Konzerte)
--  3. Automatische Peak-Alerts für die nächsten 14 Tage
--
-- Peak-Score 0–100:
--  0–29   normal (kein besonderer Handlungsbedarf)
--  30–59  erhöht (1–2 Fahrer extra empfohlen)
--  60–79  hoch   (3–4 Fahrer extra + Küchen-Vorbereitung)
--  80–100 extrem (Alle Hände an Deck, frühzeitig öffnen)

-- ─── Tages-Muster ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS peak_day_patterns (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  pattern_date        DATE        NOT NULL,                -- Das konkrete Datum des Tages
  weekday             SMALLINT    NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0=So,1=Mo,...,6=Sa
  month               SMALLINT    NOT NULL CHECK (month BETWEEN 1 AND 12),

  -- Tatsächliche Metriken (am Ende des Tages befüllt)
  actual_orders       INTEGER     NOT NULL DEFAULT 0,
  actual_revenue_eur  NUMERIC(10,2) NOT NULL DEFAULT 0,
  actual_drivers_peak INTEGER     NOT NULL DEFAULT 0,      -- max gleichzeitig aktive Fahrer
  actual_avg_eta_min  NUMERIC(5,1),
  actual_late_rate    NUMERIC(5,4) DEFAULT 0,             -- 0.0–1.0 Anteil verspätet

  -- Baseline-Werte (8-Wochen Durchschnitt gleicher Wochentag)
  baseline_orders     NUMERIC(8,2),
  baseline_revenue    NUMERIC(10,2),
  baseline_drivers    NUMERIC(5,2),

  -- Peak-Indikatoren
  orders_vs_baseline  NUMERIC(6,3),                        -- z.B. 1.45 = +45%
  peak_score          SMALLINT    NOT NULL DEFAULT 0 CHECK (peak_score BETWEEN 0 AND 100),
  was_peak_day        BOOLEAN     NOT NULL DEFAULT false,   -- peak_score >= 60

  -- Besonderheiten (optional: nachträgliche Ursachen-Erfassung)
  note                TEXT,
  has_linked_event    BOOLEAN     NOT NULL DEFAULT false,   -- war ein Event an diesem Tag?

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (location_id, pattern_date)
);

CREATE INDEX IF NOT EXISTS idx_peak_day_patterns_location_weekday
  ON peak_day_patterns (location_id, weekday);

CREATE INDEX IF NOT EXISTS idx_peak_day_patterns_location_date
  ON peak_day_patterns (location_id, pattern_date DESC);

CREATE INDEX IF NOT EXISTS idx_peak_day_patterns_peak
  ON peak_day_patterns (location_id, was_peak_day, peak_score DESC)
  WHERE was_peak_day = true;

ALTER TABLE peak_day_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_peak_day_patterns" ON peak_day_patterns;
CREATE POLICY "tenant_isolation_peak_day_patterns" ON peak_day_patterns
  USING (location_id IN (
    SELECT location_id FROM employees WHERE id = auth.uid()
  ));

-- ─── Event-Kalender ──────────────────────────────────────────────────────────

CREATE TYPE IF NOT EXISTS delivery_event_type AS ENUM (
  'public_holiday',
  'school_holiday',
  'sports_game',
  'concert_festival',
  'local_market',
  'weather_event',
  'promotion',
  'other'
);

CREATE TABLE IF NOT EXISTS delivery_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  event_date          DATE        NOT NULL,
  event_type          delivery_event_type NOT NULL DEFAULT 'other',
  title               TEXT        NOT NULL,
  description         TEXT,
  expected_demand_mult NUMERIC(4,2) NOT NULL DEFAULT 1.0 CHECK (expected_demand_mult > 0),
  extra_drivers_needed SMALLINT   NOT NULL DEFAULT 0 CHECK (extra_drivers_needed >= 0),
  kitchen_open_earlier_min SMALLINT NOT NULL DEFAULT 0,   -- Küche X Min früher öffnen
  notes_for_team      TEXT,
  created_by          UUID        REFERENCES employees(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (location_id, event_date, title)
);

CREATE INDEX IF NOT EXISTS idx_delivery_events_location_date
  ON delivery_events (location_id, event_date);

CREATE INDEX IF NOT EXISTS idx_delivery_events_upcoming
  ON delivery_events (location_id, event_date)
  WHERE event_date >= CURRENT_DATE;

ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_delivery_events" ON delivery_events;
CREATE POLICY "tenant_isolation_delivery_events" ON delivery_events
  USING (location_id IN (
    SELECT location_id FROM employees WHERE id = auth.uid()
  ));

-- ─── Peak-Alerts ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS peak_day_alerts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  alert_date          DATE        NOT NULL,               -- Für welchen Tag gilt die Warnung?
  peak_score          SMALLINT    NOT NULL CHECK (peak_score BETWEEN 0 AND 100),
  risk_level          TEXT        NOT NULL CHECK (risk_level IN ('elevated','high','extreme')),
  predicted_orders    INTEGER,
  predicted_revenue   NUMERIC(10,2),
  extra_drivers_rec   SMALLINT    NOT NULL DEFAULT 0,
  kitchen_earlier_min SMALLINT    NOT NULL DEFAULT 0,
  trigger_reasons     TEXT[]      NOT NULL DEFAULT '{}',  -- z.B. {'weekend','summer_month','linked_event'}
  linked_event_id     UUID        REFERENCES delivery_events(id),
  dismissed_at        TIMESTAMPTZ,
  dismissed_by        UUID        REFERENCES employees(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Nur ein offener Alert pro Tag
  UNIQUE (location_id, alert_date)
);

CREATE INDEX IF NOT EXISTS idx_peak_day_alerts_location_open
  ON peak_day_alerts (location_id, alert_date)
  WHERE dismissed_at IS NULL;

ALTER TABLE peak_day_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_peak_day_alerts" ON peak_day_alerts;
CREATE POLICY "tenant_isolation_peak_day_alerts" ON peak_day_alerts
  USING (location_id IN (
    SELECT location_id FROM employees WHERE id = auth.uid()
  ));

-- ─── View: Upcoming Peaks (nächste 14 Tage) ──────────────────────────────────

CREATE OR REPLACE VIEW v_upcoming_peak_days AS
SELECT
  a.id,
  a.location_id,
  a.alert_date,
  a.peak_score,
  a.risk_level,
  a.predicted_orders,
  a.predicted_revenue,
  a.extra_drivers_rec,
  a.kitchen_earlier_min,
  a.trigger_reasons,
  a.dismissed_at IS NULL                         AS is_active,
  EXTRACT(DOW FROM a.alert_date)::SMALLINT        AS weekday,
  TO_CHAR(a.alert_date, 'TMDay')                  AS weekday_name,
  (a.alert_date - CURRENT_DATE)                   AS days_until,
  e.id                                            AS event_id,
  e.title                                         AS event_title,
  e.event_type,
  e.extra_drivers_needed                          AS event_extra_drivers,
  e.kitchen_open_earlier_min                      AS event_kitchen_min
FROM peak_day_alerts a
LEFT JOIN delivery_events e ON e.id = a.linked_event_id
WHERE a.alert_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 14
ORDER BY a.alert_date;

-- ─── View: Historical Pattern Summary pro Wochentag ──────────────────────────

CREATE OR REPLACE VIEW v_weekday_pattern_summary AS
SELECT
  location_id,
  weekday,
  COUNT(*)                                         AS sample_days,
  ROUND(AVG(actual_orders), 1)                     AS avg_orders,
  ROUND(AVG(actual_revenue_eur), 2)                AS avg_revenue_eur,
  ROUND(AVG(actual_drivers_peak), 1)               AS avg_peak_drivers,
  ROUND(AVG(actual_avg_eta_min), 1)                AS avg_eta_min,
  ROUND(AVG(actual_late_rate)::NUMERIC, 4)         AS avg_late_rate,
  COUNT(*) FILTER (WHERE was_peak_day)             AS peak_day_count,
  ROUND(
    COUNT(*) FILTER (WHERE was_peak_day)::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 1
  )                                                AS peak_day_pct,
  ROUND(AVG(peak_score), 1)                        AS avg_peak_score,
  MAX(peak_score)                                  AS max_peak_score,
  MAX(actual_orders)                               AS record_orders,
  MAX(actual_revenue_eur)                          AS record_revenue
FROM peak_day_patterns
WHERE pattern_date >= CURRENT_DATE - 56          -- 8-Wochen-Fenster
GROUP BY location_id, weekday
ORDER BY location_id, weekday;

-- ─── View: Event Impact History ───────────────────────────────────────────────

CREATE OR REPLACE VIEW v_event_impact_history AS
SELECT
  e.id,
  e.location_id,
  e.event_date,
  e.event_type,
  e.title,
  e.expected_demand_mult,
  e.extra_drivers_needed,
  p.actual_orders,
  p.actual_revenue_eur,
  p.baseline_orders,
  p.orders_vs_baseline          AS actual_demand_mult,
  p.peak_score,
  CASE
    WHEN p.orders_vs_baseline IS NULL THEN NULL
    WHEN ABS(p.orders_vs_baseline - e.expected_demand_mult) <= 0.15 THEN 'accurate'
    WHEN p.orders_vs_baseline > e.expected_demand_mult THEN 'underestimated'
    ELSE 'overestimated'
  END                           AS forecast_accuracy
FROM delivery_events e
LEFT JOIN peak_day_patterns p
  ON p.location_id = e.location_id
  AND p.pattern_date = e.event_date
ORDER BY e.event_date DESC;

-- ─── Cleanup-Funktion ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_old_peak_alerts(days_back INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM peak_day_alerts
  WHERE alert_date < CURRENT_DATE - days_back
    AND dismissed_at IS NOT NULL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
