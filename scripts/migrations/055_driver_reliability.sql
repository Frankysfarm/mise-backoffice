-- Migration 055: Fahrer-Zuverlässigkeits-Score + No-Show-Tracking
--
-- Zweck:
--   1. driver_shift_events       — individuelle Schicht-Ereignisse (no_show, late_start, early_end, perfect)
--   2. driver_reliability_scores — aggregierter Zuverlässigkeits-Score je Fahrer × Standort
--   3. Indizes für performante Cron-Abfragen
--
-- Score-Formel:
--   100 − (no_shows × 25) − (late_starts × 5) − (early_ends × 10) + (perfects × 2), floor 0
--   ≥ 90 = Sehr zuverlässig  |  75–89 = Gut  |  50–74 = Mittel  |  < 50 = Kritisch
--
-- No-Show-Erkennung (Cron alle 30 Min):
--   Schichten mit status='missed' AND planned_start 30–120 Min in der Vergangenheit
--   → Event schreiben + Broadcast an verfügbare Fahrer senden

-- ============================================================
-- 1. driver_shift_events
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_shift_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    uuid        NOT NULL,
  location_id  uuid        NOT NULL,
  shift_id     uuid,
  event_type   text        NOT NULL
    CHECK (event_type IN ('no_show', 'late_start', 'early_end', 'perfect')),
  planned_start  timestamptz,
  actual_start   timestamptz,
  late_minutes   int,
  recorded_at    timestamptz NOT NULL DEFAULT now(),
  notes          text
);

COMMENT ON TABLE driver_shift_events IS
  'Einzelne Schicht-Qualitäts-Ereignisse je Fahrer. '
  'no_show: Fahrer nicht erschienen. '
  'late_start: ≥15 Min verspätet eingecheckt. '
  'early_end: Schicht ohne Absprache früher beendet. '
  'perfect: Pünktlich gestartet + vollständig abgeschlossen.';

-- ============================================================
-- 2. driver_reliability_scores
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_reliability_scores (
  driver_id     uuid        NOT NULL,
  location_id   uuid        NOT NULL,
  score         numeric(5,2) NOT NULL DEFAULT 100,
  total_shifts  int         NOT NULL DEFAULT 0,
  no_shows      int         NOT NULL DEFAULT 0,
  late_starts   int         NOT NULL DEFAULT 0,
  early_ends    int         NOT NULL DEFAULT 0,
  perfect_shifts int        NOT NULL DEFAULT 0,
  no_show_rate  numeric(5,2) NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (driver_id, location_id)
);

COMMENT ON TABLE driver_reliability_scores IS
  'Aggregierter Zuverlässigkeits-Score je Fahrer × Standort. '
  'Wird vom Cron nach jedem Schicht-Ereignis neu berechnet.';

-- ============================================================
-- 3. Indizes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_dse_driver_loc
  ON driver_shift_events (driver_id, location_id);

CREATE INDEX IF NOT EXISTS idx_dse_shift_type
  ON driver_shift_events (shift_id, event_type)
  WHERE shift_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dse_recorded
  ON driver_shift_events (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_dse_loc_type_recorded
  ON driver_shift_events (location_id, event_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_drs_loc_score
  ON driver_reliability_scores (location_id, score DESC);

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE driver_shift_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_reliability_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_shift_events' AND policyname = 'service-only-dse'
  ) THEN
    CREATE POLICY "service-only-dse"
      ON driver_shift_events USING (false);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_reliability_scores' AND policyname = 'service-only-drs'
  ) THEN
    CREATE POLICY "service-only-drs"
      ON driver_reliability_scores USING (false);
  END IF;
END $$;
