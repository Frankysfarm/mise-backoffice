-- Migration 017: Fahrer-Schicht-Management + Einsatzplanung
--
-- Zweck:
--   1. driver_shifts          — geplante und tatsächliche Schichten
--   2. coverage_requirements  — Mindest-/Ziel-Fahrerzahl pro Stunde
--   3. v_shift_coverage       — Abdeckungs-Analyse für die nächsten 24h
--   4. auto_close_missed_shifts() — stale scheduled Schichten schließen
--   5. Indizes

-- ============================================================
-- 1. driver_shifts
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_shifts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       uuid NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id     uuid NOT NULL REFERENCES locations(id)   ON DELETE CASCADE,
  planned_start   timestamptz NOT NULL,
  planned_end     timestamptz NOT NULL,
  actual_start    timestamptz,
  actual_end      timestamptz,
  status          text NOT NULL DEFAULT 'scheduled'
    CHECK(status IN ('scheduled','active','completed','missed','cancelled')),
  notes           text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shift_end_after_start CHECK(planned_end > planned_start)
);

COMMENT ON TABLE driver_shifts IS
  'Geplante und tatsächliche Fahrerschichten. '
  'status=scheduled bis Schichtbeginn, active=läuft gerade, '
  'completed=regulär beendet, missed=nicht erschienen, cancelled=storniert.';

-- ============================================================
-- 2. coverage_requirements
--    Mindest- und Ziel-Fahrerzahl pro Wochentag / Stunde
-- ============================================================
CREATE TABLE IF NOT EXISTS coverage_requirements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week     int  NOT NULL CHECK(day_of_week BETWEEN 0 AND 6), -- 0=Sonntag … 6=Samstag
  hour_of_day     int  NOT NULL CHECK(hour_of_day BETWEEN 0 AND 23),
  min_drivers     int  NOT NULL DEFAULT 1 CHECK(min_drivers >= 0),
  target_drivers  int  NOT NULL DEFAULT 2 CHECK(target_drivers >= min_drivers),
  UNIQUE(location_id, day_of_week, hour_of_day)
);

COMMENT ON TABLE coverage_requirements IS
  'Mindest- und Ziel-Fahrerzahl pro Wochentag und Stunde für jede Location. '
  'Basis für Einsatzplanung und Gap-Warnungen.';

-- ============================================================
-- 3. Indizes
-- ============================================================

-- Schnelle Abfragen nach aktiven/kommenden Schichten
CREATE INDEX IF NOT EXISTS idx_driver_shifts_location_start
  ON driver_shifts (location_id, planned_start);

CREATE INDEX IF NOT EXISTS idx_driver_shifts_driver_status
  ON driver_shifts (driver_id, status);

-- Partial-Index: nur aktive/geplante Schichten (die meisten Queries)
CREATE INDEX IF NOT EXISTS idx_driver_shifts_active
  ON driver_shifts (location_id, planned_start, planned_end)
  WHERE status IN ('scheduled', 'active');

-- Coverage per Location
CREATE INDEX IF NOT EXISTS idx_coverage_req_location
  ON coverage_requirements (location_id, day_of_week, hour_of_day);

-- ============================================================
-- 4. v_shift_coverage VIEW
--    Zeigt für die nächsten 24h ob Schichten die Anforderungen erfüllen.
--    Spalten:
--      slot_start        — UTC-Stunde
--      location_id
--      scheduled_drivers — Anzahl Fahrer mit Schicht in diesem Slot
--      min_drivers       — Mindestanforderung (0 wenn keine Anforderung)
--      target_drivers    — Ziel (0 wenn keine)
--      gap               — scheduled_drivers - min_drivers (negativ = Unterdeckung)
--      covered           — true wenn gap >= 0
-- ============================================================
CREATE OR REPLACE VIEW v_shift_coverage AS
WITH
  slots AS (
    -- Stunden-Slots für die nächsten 24h
    SELECT generate_series(
      date_trunc('hour', now()),
      date_trunc('hour', now()) + interval '23 hours',
      interval '1 hour'
    ) AS slot_start
  ),
  locations_list AS (
    SELECT DISTINCT location_id FROM driver_shifts
    WHERE status IN ('scheduled', 'active')
    UNION
    SELECT DISTINCT location_id FROM coverage_requirements
  ),
  slot_location AS (
    SELECT s.slot_start, l.location_id
    FROM slots s CROSS JOIN locations_list l
  ),
  shift_counts AS (
    SELECT
      date_trunc('hour', ds.planned_start) AS slot_start,
      ds.location_id,
      COUNT(*) AS scheduled_drivers
    FROM driver_shifts ds
    WHERE ds.status IN ('scheduled', 'active')
      AND ds.planned_start <= date_trunc('hour', now()) + interval '24 hours'
      AND ds.planned_end   >  date_trunc('hour', now())
    GROUP BY 1, 2
  ),
  req AS (
    SELECT
      cr.location_id,
      cr.day_of_week,
      cr.hour_of_day,
      cr.min_drivers,
      cr.target_drivers
    FROM coverage_requirements cr
  )
SELECT
  sl.slot_start,
  sl.location_id,
  COALESCE(sc.scheduled_drivers, 0)   AS scheduled_drivers,
  COALESCE(r.min_drivers,    0)       AS min_drivers,
  COALESCE(r.target_drivers, 0)       AS target_drivers,
  COALESCE(sc.scheduled_drivers, 0) - COALESCE(r.min_drivers, 0) AS gap,
  COALESCE(sc.scheduled_drivers, 0) >= COALESCE(r.min_drivers, 0) AS covered
FROM slot_location sl
LEFT JOIN shift_counts sc
  ON sc.slot_start   = sl.slot_start
  AND sc.location_id = sl.location_id
LEFT JOIN req r
  ON r.location_id  = sl.location_id
  AND r.day_of_week = EXTRACT(DOW FROM sl.slot_start)::int
  AND r.hour_of_day = EXTRACT(HOUR FROM sl.slot_start)::int
ORDER BY sl.slot_start, sl.location_id;

COMMENT ON VIEW v_shift_coverage IS
  'Schicht-Abdeckungs-Analyse für die nächsten 24h: '
  'vergleicht geplante Fahrer vs. Mindestanforderungen pro Stunden-Slot.';

-- ============================================================
-- 5. auto_close_missed_shifts()
--    Markiert Schichten als "missed" die vor >30 Min hätten starten
--    sollen, aber nie auf "active" gesetzt wurden.
--    Setzt zugehörige "active" Schichten auf "completed" wenn
--    geplantes Ende >30 Min überschritten wurde.
--    Wird vom Cron aufgerufen.
-- ============================================================
CREATE OR REPLACE FUNCTION auto_close_missed_shifts()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int := 0;
BEGIN
  -- Missed: geplanter Start vor >30 Min, noch scheduled, nie gestartet
  UPDATE driver_shifts
  SET status = 'missed'
  WHERE status = 'scheduled'
    AND planned_start < now() - interval '30 minutes'
    AND actual_start IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Completed: active Schicht, geplantes Ende vor >30 Min überschritten
  UPDATE driver_shifts
  SET status = 'completed',
      actual_end = now()
  WHERE status = 'active'
    AND planned_end < now() - interval '30 minutes'
    AND actual_end IS NULL;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION auto_close_missed_shifts() IS
  'Cron-Hilfsfunktion: markiert vergessene Schichten als missed / completed. '
  'Gibt Anzahl der als missed markierten Schichten zurück.';
