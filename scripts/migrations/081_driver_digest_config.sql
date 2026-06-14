-- 081_driver_digest_config.sql
-- Fahrer Tagesabschluss-E-Mail — Konfiguration + Versand-Log

-- ── Konfiguration pro Standort ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_digest_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  enabled             BOOLEAN NOT NULL DEFAULT false,
  send_hour_utc       SMALLINT NOT NULL DEFAULT 20 CHECK (send_hour_utc >= 0 AND send_hour_utc <= 23),
  include_ranking     BOOLEAN NOT NULL DEFAULT true,
  include_next_shift  BOOLEAN NOT NULL DEFAULT true,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT driver_digest_config_location_unique UNIQUE (location_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_digest_config_location ON driver_digest_config(location_id);

ALTER TABLE driver_digest_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_digest_config_rls" ON driver_digest_config
  USING (location_id IN (
    SELECT tenant_id FROM employees WHERE id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION driver_digest_config_set_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS driver_digest_config_updated ON driver_digest_config;
CREATE TRIGGER driver_digest_config_updated
  BEFORE UPDATE ON driver_digest_config
  FOR EACH ROW EXECUTE FUNCTION driver_digest_config_set_updated();

-- ── Versand-Log pro Fahrer pro Tag ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_digest_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id    UUID NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  driver_name  TEXT,
  digest_date  DATE NOT NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error        TEXT,
  CONSTRAINT driver_digest_log_unique UNIQUE (driver_id, digest_date)
);

CREATE INDEX IF NOT EXISTS idx_driver_digest_log_location ON driver_digest_log(location_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_digest_log_driver   ON driver_digest_log(driver_id, digest_date DESC);

ALTER TABLE driver_digest_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_digest_log_rls" ON driver_digest_log
  USING (location_id IN (
    SELECT tenant_id FROM employees WHERE id = auth.uid()
  ));
