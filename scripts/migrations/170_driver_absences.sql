-- Migration 170: Driver Absence & Vacation Management
-- Verwaltet Abwesenheits- und Urlaubsanfragen der Fahrer.
-- Integriert mit Schichtplanung und Coverage-Analyse.

-- ── Konfiguration ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_absence_config (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id               UUID          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  is_enabled                BOOLEAN       NOT NULL DEFAULT true,
  requires_approval         BOOLEAN       NOT NULL DEFAULT true,
  max_vacation_days_per_year INTEGER      NOT NULL DEFAULT 28,
  max_sick_days_per_year    INTEGER       NOT NULL DEFAULT 14,
  min_notice_days           INTEGER       NOT NULL DEFAULT 2,   -- Mindestkündigungsfrist
  auto_approve_sick_days    BOOLEAN       NOT NULL DEFAULT true, -- Krankmeldungen automatisch genehmigen

  created_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE(location_id)
);

ALTER TABLE driver_absence_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svc_all_dac" ON driver_absence_config FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION set_updated_at_dac()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_dac_updated_at ON driver_absence_config;
CREATE TRIGGER trg_dac_updated_at
  BEFORE UPDATE ON driver_absence_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_dac();

-- ── Abwesenheits-Einträge ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_absences (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id         UUID          NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,

  absence_type      TEXT          NOT NULL CHECK (absence_type IN ('sick_day','vacation','personal_day','training','other')),
  start_date        DATE          NOT NULL,
  end_date          DATE          NOT NULL,
  days_count        INTEGER       GENERATED ALWAYS AS (end_date - start_date + 1) STORED,

  status            TEXT          NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','approved','rejected','cancelled')),
  reason            TEXT,
  admin_notes       TEXT,
  approved_by       UUID          REFERENCES employees(id) ON DELETE SET NULL,
  approved_at       TIMESTAMPTZ,

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_da_location_status   ON driver_absences(location_id, status);
CREATE INDEX IF NOT EXISTS idx_da_driver_date        ON driver_absences(driver_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_da_location_date      ON driver_absences(location_id, start_date, end_date);

ALTER TABLE driver_absences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svc_all_da"  ON driver_absences FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION set_updated_at_da()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_da_updated_at ON driver_absences;
CREATE TRIGGER trg_da_updated_at
  BEFORE UPDATE ON driver_absences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_da();

-- ── Prune-RPC ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_driver_absences(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted INTEGER;
BEGIN
  DELETE FROM driver_absences
    WHERE end_date < (CURRENT_DATE - days_to_keep)
      AND status IN ('approved','rejected','cancelled');
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ── Default-Konfiguration für bestehende Standorte ────────────────────────────

DO $$
BEGIN
  INSERT INTO driver_absence_config (location_id)
  SELECT id FROM locations
  ON CONFLICT (location_id) DO NOTHING;
END;
$$;
