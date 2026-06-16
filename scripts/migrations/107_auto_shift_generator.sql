-- 107_auto_shift_generator.sql
-- Phase 209: Auto-Shift-Generator
-- Converts capacity plan gaps into concrete driver shift drafts for manager approval.

-- ── auto_shift_drafts ──────────────────────────────────────────────────────────
-- One draft per generation run per location. Managers review and apply/discard.
CREATE TABLE IF NOT EXISTS auto_shift_drafts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_draft_status CHECK (status IN ('pending', 'applied', 'discarded')),
  gaps_found      integer NOT NULL DEFAULT 0,
  shifts_proposed integer NOT NULL DEFAULT 0,
  coverage_before integer NOT NULL DEFAULT 0, -- pct
  coverage_after  integer NOT NULL DEFAULT 0, -- pct (estimated after applying)
  applied_at      timestamptz,
  applied_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  discarded_at    timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE auto_shift_drafts IS
  'Auto-generated shift draft batches. status=pending until manager applies or discards.';

CREATE INDEX IF NOT EXISTS idx_auto_shift_drafts_location_status
  ON auto_shift_drafts (location_id, status, created_at DESC);

-- ── auto_shift_draft_items ────────────────────────────────────────────────────
-- One row per proposed driver shift within a draft.
CREATE TABLE IF NOT EXISTS auto_shift_draft_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id        uuid NOT NULL REFERENCES auto_shift_drafts(id) ON DELETE CASCADE,
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id       uuid NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  shift_date      date NOT NULL,
  start_hour      smallint NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  end_hour        smallint NOT NULL CHECK (end_hour BETWEEN 1 AND 24),
  drivers_needed  integer NOT NULL DEFAULT 1,
  coverage_gap    integer NOT NULL DEFAULT 1,
  expected_orders integer NOT NULL DEFAULT 0,
  is_peak         boolean NOT NULL DEFAULT false,
  driver_rank     integer NOT NULL DEFAULT 1, -- 1 = best candidate for this slot
  reliability_score integer NOT NULL DEFAULT 50, -- 0-100
  status          text NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_item_status CHECK (status IN ('pending', 'applied', 'skipped')),
  applied_shift_id uuid REFERENCES driver_shifts(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE auto_shift_draft_items IS
  'Individual shift proposals within an auto-shift draft. '
  'driver_rank=1 means best reliability candidate for the slot.';

CREATE INDEX IF NOT EXISTS idx_auto_shift_items_draft
  ON auto_shift_draft_items (draft_id, shift_date, start_hour);

CREATE INDEX IF NOT EXISTS idx_auto_shift_items_driver
  ON auto_shift_draft_items (driver_id, shift_date);

CREATE INDEX IF NOT EXISTS idx_auto_shift_items_location
  ON auto_shift_draft_items (location_id, shift_date);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE auto_shift_drafts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_shift_draft_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_auto_shift_drafts" ON auto_shift_drafts;
CREATE POLICY "service_role_auto_shift_drafts" ON auto_shift_drafts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_auto_shift_items" ON auto_shift_draft_items;
CREATE POLICY "service_role_auto_shift_items" ON auto_shift_draft_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── v_auto_shift_draft_summary ────────────────────────────────────────────────
-- Quick summary of latest draft per location.
CREATE OR REPLACE VIEW v_auto_shift_draft_summary AS
SELECT
  d.id,
  d.location_id,
  d.status,
  d.gaps_found,
  d.shifts_proposed,
  d.coverage_before,
  d.coverage_after,
  d.created_at,
  d.applied_at,
  COUNT(i.id) FILTER (WHERE i.status = 'pending') AS items_pending,
  COUNT(i.id) FILTER (WHERE i.status = 'applied') AS items_applied,
  COUNT(i.id) FILTER (WHERE i.status = 'skipped') AS items_skipped,
  MIN(i.shift_date) AS earliest_date,
  MAX(i.shift_date) AS latest_date
FROM auto_shift_drafts d
LEFT JOIN auto_shift_draft_items i ON i.draft_id = d.id
GROUP BY d.id, d.location_id, d.status, d.gaps_found, d.shifts_proposed,
         d.coverage_before, d.coverage_after, d.created_at, d.applied_at;

-- ── cleanup function ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_auto_shift_drafts(days_to_keep integer DEFAULT 30)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE deleted integer;
BEGIN
  DELETE FROM auto_shift_drafts
  WHERE status IN ('applied', 'discarded')
    AND created_at < NOW() - (days_to_keep || ' days')::interval;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
