-- Migration 183: Smart Shift Extension & Overtime Alert Engine
-- Phase 383

-- ── 1. shift_extension_requests ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_extension_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  shift_id         uuid        NOT NULL REFERENCES driver_shifts(id) ON DELETE CASCADE,
  driver_id        uuid        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  extra_minutes    int         NOT NULL CHECK(extra_minutes > 0),
  reason           text,
  auto_detected    boolean     NOT NULL DEFAULT false,
  status           text        NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','declined','expired')),
  decided_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at       timestamptz,
  requested_at     timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ser_location_status
  ON shift_extension_requests(location_id, status);
CREATE INDEX IF NOT EXISTS idx_ser_shift_id
  ON shift_extension_requests(shift_id);
CREATE INDEX IF NOT EXISTS idx_ser_requested_at
  ON shift_extension_requests(requested_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION touch_shift_extension_requests()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_ser_updated_at ON shift_extension_requests;
CREATE TRIGGER trg_ser_updated_at
  BEFORE UPDATE ON shift_extension_requests
  FOR EACH ROW EXECUTE FUNCTION touch_shift_extension_requests();

-- ── 2. driver_overtime_summary ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_overtime_summary (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         uuid    NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  summary_date        date    NOT NULL,
  affected_drivers    int     NOT NULL DEFAULT 0,
  total_overtime_min  int     NOT NULL DEFAULT 0,
  avg_overtime_min    numeric(8,2),
  extension_requests  int     NOT NULL DEFAULT 0,
  approved_requests   int     NOT NULL DEFAULT 0,
  estimated_cost_eur  numeric(10,2),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_dos_location_date
  ON driver_overtime_summary(location_id, summary_date DESC);

CREATE OR REPLACE FUNCTION touch_driver_overtime_summary()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_dos_updated_at ON driver_overtime_summary;
CREATE TRIGGER trg_dos_updated_at
  BEFORE UPDATE ON driver_overtime_summary
  FOR EACH ROW EXECUTE FUNCTION touch_driver_overtime_summary();

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE shift_extension_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full ser" ON shift_extension_requests;
CREATE POLICY "service_role full ser" ON shift_extension_requests
  TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated read ser" ON shift_extension_requests;
CREATE POLICY "authenticated read ser" ON shift_extension_requests
  FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM mise_staff WHERE user_id = auth.uid()
  ));

ALTER TABLE driver_overtime_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role full dos" ON driver_overtime_summary;
CREATE POLICY "service_role full dos" ON driver_overtime_summary
  TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated read dos" ON driver_overtime_summary;
CREATE POLICY "authenticated read dos" ON driver_overtime_summary
  FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM mise_staff WHERE user_id = auth.uid()
  ));

-- ── 4. Prune RPC ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_shift_extension_requests(days_to_keep int DEFAULT 60)
  RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM shift_extension_requests
   WHERE requested_at < now() - (days_to_keep || ' days')::interval
     AND status IN ('approved','declined','expired');
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ── 5. View: active extension requests ────────────────────────────────────────
CREATE OR REPLACE VIEW v_active_extension_requests AS
SELECT
  ser.id,
  ser.location_id,
  ser.shift_id,
  ser.driver_id,
  md.name          AS driver_name,
  md.vehicle       AS driver_vehicle,
  ds.planned_end,
  ser.extra_minutes,
  ser.reason,
  ser.auto_detected,
  ser.status,
  ser.requested_at
FROM shift_extension_requests ser
JOIN mise_drivers   md ON md.id = ser.driver_id
JOIN driver_shifts  ds ON ds.id = ser.shift_id
WHERE ser.status = 'pending'
ORDER BY ser.requested_at;
