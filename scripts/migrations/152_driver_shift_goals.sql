-- ─── Phase 314 — Fahrer-Ziel-Engine ─────────────────────────────────────────
-- Schicht-Ziele pro Fahrer (Stops/€/Score) mit stündlichen Fortschritts-Snapshots.
-- Admins konfigurieren Location-weite Defaults.
-- Cron berechnet stündlich den Fortschritt je Fahrer.

-- ── 1. Config: Location-weite Schicht-Ziele ───────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_shift_goal_configs (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  target_stops        INT           NOT NULL DEFAULT 12,
  target_earnings_eur NUMERIC(10,2) NOT NULL DEFAULT 80,
  target_score        INT           NOT NULL DEFAULT 75,
  shift_start_hour    INT           NOT NULL DEFAULT 10,  -- UTC
  shift_hours_total   INT           NOT NULL DEFAULT 8,
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE(location_id)
);

-- ── 2. Stündliche Fortschritts-Snapshots je Fahrer ───────────────────────────
CREATE TABLE IF NOT EXISTS driver_shift_goal_snapshots (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id            UUID          NOT NULL,
  location_id          UUID          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  snapshot_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  stops_completed      INT           NOT NULL DEFAULT 0,
  earnings_eur         NUMERIC(10,2) NOT NULL DEFAULT 0,
  live_score           INT           NOT NULL DEFAULT 0,
  target_stops         INT           NOT NULL DEFAULT 12,
  target_earnings_eur  NUMERIC(10,2) NOT NULL DEFAULT 80,
  target_score         INT           NOT NULL DEFAULT 75,
  shift_pct_elapsed    NUMERIC(5,2)  NOT NULL DEFAULT 0,  -- 0..1
  stops_pace           VARCHAR(20)   NOT NULL DEFAULT 'on_track',
  earnings_pace        VARCHAR(20)   NOT NULL DEFAULT 'on_track',
  score_pace           VARCHAR(20)   NOT NULL DEFAULT 'on_track',
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── 3. Indizes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dsgc_location
  ON driver_shift_goal_configs(location_id);

CREATE INDEX IF NOT EXISTS idx_dsgs_driver_at
  ON driver_shift_goal_snapshots(driver_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_dsgs_location_at
  ON driver_shift_goal_snapshots(location_id, snapshot_at DESC);

-- ── 4. RLS (Service Role passiert alles) ──────────────────────────────────────
ALTER TABLE driver_shift_goal_configs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_shift_goal_snapshots  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all_dsgc" ON driver_shift_goal_configs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_all_dsgs" ON driver_shift_goal_snapshots
  FOR ALL USING (true) WITH CHECK (true);

-- ── 5. View: Neuester Snapshot je Fahrer + Location ──────────────────────────
CREATE OR REPLACE VIEW v_driver_shift_goal_latest AS
SELECT DISTINCT ON (driver_id, location_id)
  driver_id,
  location_id,
  snapshot_at,
  stops_completed,
  earnings_eur,
  live_score,
  target_stops,
  target_earnings_eur,
  target_score,
  shift_pct_elapsed,
  stops_pace,
  earnings_pace,
  score_pace
FROM driver_shift_goal_snapshots
ORDER BY driver_id, location_id, snapshot_at DESC;

-- ── 6. Cleanup-Funktion ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_driver_shift_goal_snapshots(days_old INT DEFAULT 7)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE cnt INT;
BEGIN
  DELETE FROM driver_shift_goal_snapshots
  WHERE snapshot_at < now() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN cnt;
END;
$$;

-- ── 7. updated_at Trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_fn_dsgc_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_dsgc_updated_at ON driver_shift_goal_configs;
CREATE TRIGGER trg_dsgc_updated_at
  BEFORE UPDATE ON driver_shift_goal_configs
  FOR EACH ROW EXECUTE FUNCTION trg_fn_dsgc_updated_at();
