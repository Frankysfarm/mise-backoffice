-- ─── Phase 308 — Shift Goals ────────────────────────────────────────────────
-- Tages-/Schichtziele je Location konfigurierbar speichern.
-- TagesZielCockpit pollt /api/delivery/admin/shift-goals und zeigt Ist vs. Soll.

CREATE TABLE IF NOT EXISTS shift_goals (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id        TEXT        NOT NULL UNIQUE,
  target_orders      INT         NOT NULL DEFAULT 60,
  target_revenue_eur NUMERIC(10,2) NOT NULL DEFAULT 1500.00,
  shift_hours_total  NUMERIC(4,2)  NOT NULL DEFAULT 8.0,
  shift_start_hour   SMALLINT    NOT NULL DEFAULT 10, -- UTC hour when shift starts
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_goals_location ON shift_goals (location_id);

-- RLS
ALTER TABLE shift_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_goals_location_rls" ON shift_goals
  USING (location_id = current_setting('app.location_id', true));

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_shift_goals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shift_goals_updated_at ON shift_goals;
CREATE TRIGGER trg_shift_goals_updated_at
  BEFORE UPDATE ON shift_goals
  FOR EACH ROW EXECUTE FUNCTION update_shift_goals_updated_at();
