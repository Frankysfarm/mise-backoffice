-- Migration 077: Auto-Shift Vorschläge Engine
-- Basierend auf Nachfrage-Prognose + bestehenden Schichten werden
-- automatisch Lückenfüller-Schichten vorgeschlagen.

CREATE TABLE IF NOT EXISTS delivery_shift_suggestions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id      uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  suggestion_date  date NOT NULL,
  start_hour       smallint NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour         smallint NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
  drivers_needed   smallint NOT NULL DEFAULT 1,
  drivers_scheduled smallint NOT NULL DEFAULT 0,
  coverage_gap     smallint NOT NULL DEFAULT 0,  -- drivers_needed - drivers_scheduled
  expected_orders  smallint NOT NULL DEFAULT 0,
  confidence       numeric(5,2) NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'ignored', 'applied')),
  generated_by     text NOT NULL DEFAULT 'auto',
  accepted_at      timestamptz,
  accepted_by      uuid REFERENCES auth.users(id),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, suggestion_date, start_hour)
);

CREATE INDEX IF NOT EXISTS idx_shift_suggestions_location_date
  ON delivery_shift_suggestions(location_id, suggestion_date);

CREATE INDEX IF NOT EXISTS idx_shift_suggestions_pending
  ON delivery_shift_suggestions(location_id, status)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION update_shift_suggestion_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_shift_suggestions_updated_at ON delivery_shift_suggestions;
CREATE TRIGGER trg_shift_suggestions_updated_at
  BEFORE UPDATE ON delivery_shift_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_shift_suggestion_updated_at();

ALTER TABLE delivery_shift_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "shift_suggestions_authenticated"
  ON delivery_shift_suggestions
  FOR ALL
  USING (auth.role() = 'authenticated');
