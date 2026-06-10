-- Migration 047: Fahrer-Pausen-Tracking
--
-- Zweck:
--   1. shift_breaks           — erfasste Pausen pro Schicht
--   2. v_shift_break_summary  — Pausen-Gesamtzeit pro Schicht
--   3. v_driver_active_minutes_today — Netto-Aktivzeit (Schicht - Pausen)
--   4. get_driver_active_minutes()  — Hilfsfunktion für Snapshot-Engine

-- ============================================================
-- 1. shift_breaks
-- ============================================================
CREATE TABLE IF NOT EXISTS shift_breaks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id     uuid NOT NULL REFERENCES driver_shifts(id) ON DELETE CASCADE,
  driver_id    uuid NOT NULL REFERENCES mise_drivers(id)  ON DELETE CASCADE,
  location_id  uuid NOT NULL REFERENCES locations(id)     ON DELETE CASCADE,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  break_type   text NOT NULL DEFAULT 'pause'
    CHECK(break_type IN ('pause','personal','technical','mandatory')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT break_end_after_start CHECK(ended_at IS NULL OR ended_at > started_at)
);

COMMENT ON TABLE shift_breaks IS
  'Erfasste Pausen während aktiver Fahrerschichten. '
  'ended_at=NULL bedeutet: Pause läuft noch. '
  'break_type: pause=freiwillig, personal=persönlich, technical=technisches Problem, mandatory=Pflichtpause.';

-- ============================================================
-- 2. Indizes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_shift_breaks_shift
  ON shift_breaks (shift_id);

CREATE INDEX IF NOT EXISTS idx_shift_breaks_driver_day
  ON shift_breaks (driver_id, started_at);

-- Partial-Index für offene Pausen (ended_at IS NULL — häufigste Abfrage bei Fahrer-App)
CREATE INDEX IF NOT EXISTS idx_shift_breaks_open
  ON shift_breaks (shift_id, driver_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shift_breaks_location
  ON shift_breaks (location_id, started_at);

-- ============================================================
-- 3. v_shift_break_summary
--    Gesamtpausen-Zeit pro Schicht.
--    Enthält nur beendete Pausen (ended_at IS NOT NULL).
-- ============================================================
CREATE OR REPLACE VIEW v_shift_break_summary AS
SELECT
  sb.shift_id,
  sb.driver_id,
  sb.location_id,
  COUNT(*)                                                        AS break_count,
  COALESCE(
    SUM(EXTRACT(EPOCH FROM (sb.ended_at - sb.started_at)) / 60),
    0
  )::int                                                          AS total_break_minutes,
  MAX(sb.started_at)                                              AS last_break_started_at
FROM shift_breaks sb
WHERE sb.ended_at IS NOT NULL
GROUP BY sb.shift_id, sb.driver_id, sb.location_id;

COMMENT ON VIEW v_shift_break_summary IS
  'Aggregierte Pausen-Zeiten pro Schicht (nur beendete Pausen). '
  'total_break_minutes = Minuten die nicht aktiv gearbeitet wurde.';

-- ============================================================
-- 4. v_driver_active_minutes_today
--    Netto-Aktivzeit für jeden Fahrer heute:
--    (actual_end - actual_start) - total_break_minutes
--    Für Snapshot-Engine und Leaderboard.
-- ============================================================
CREATE OR REPLACE VIEW v_driver_active_minutes_today AS
SELECT
  ds.driver_id,
  ds.location_id,
  ds.id                                                           AS shift_id,
  ds.actual_start,
  COALESCE(ds.actual_end, now())                                  AS shift_end,
  COALESCE(
    EXTRACT(EPOCH FROM (COALESCE(ds.actual_end, now()) - ds.actual_start)) / 60,
    0
  )::int                                                          AS gross_shift_minutes,
  COALESCE(bs.total_break_minutes, 0)                             AS break_minutes,
  GREATEST(
    0,
    COALESCE(
      EXTRACT(EPOCH FROM (COALESCE(ds.actual_end, now()) - ds.actual_start)) / 60,
      0
    )::int - COALESCE(bs.total_break_minutes, 0)
  )                                                               AS net_active_minutes
FROM driver_shifts ds
LEFT JOIN v_shift_break_summary bs ON bs.shift_id = ds.id
WHERE ds.actual_start IS NOT NULL
  AND (ds.actual_end IS NULL OR ds.actual_end >= now() - interval '24 hours')
  AND ds.actual_start >= now() - interval '24 hours';

COMMENT ON VIEW v_driver_active_minutes_today IS
  'Netto-Aktivzeit für Fahrer in den letzten 24h: '
  'Schichtdauer abzüglich erfasster Pausen. '
  'Basis für tägliche Performance-Snapshots und Leaderboard.';

-- ============================================================
-- 5. get_driver_active_minutes(driver_id, date_str)
--    Gibt Netto-Aktivminuten für einen Fahrer an einem bestimmten Tag.
--    Verwendet driver_shifts + shift_breaks für genaue Berechnung.
-- ============================================================
CREATE OR REPLACE FUNCTION get_driver_active_minutes(
  p_driver_id   uuid,
  p_date        date DEFAULT CURRENT_DATE
)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    SUM(
      GREATEST(0,
        EXTRACT(EPOCH FROM (
          COALESCE(ds.actual_end, least(now(), (p_date + 1)::timestamptz)) - ds.actual_start
        )) / 60 - COALESCE(bs.total_break_minutes, 0)
      )
    )::int,
    0
  )
  FROM driver_shifts ds
  LEFT JOIN v_shift_break_summary bs ON bs.shift_id = ds.id
  WHERE ds.driver_id    = p_driver_id
    AND ds.actual_start IS NOT NULL
    AND ds.actual_start >= p_date::timestamptz
    AND ds.actual_start <  (p_date + 1)::timestamptz
    AND ds.status IN ('active', 'completed');
$$;

COMMENT ON FUNCTION get_driver_active_minutes(uuid, date) IS
  'Berechnet Netto-Aktivminuten (Schicht - Pausen) für einen Fahrer an einem Tag. '
  'Wird von der Snapshot-Engine für genaue active_minutes verwendet.';
