-- 080_digest_email_config.sql
-- Tagesbericht E-Mail-Versand Konfiguration + Log

-- ── Konfiguration pro Standort ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digest_email_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  enabled             BOOLEAN NOT NULL DEFAULT false,
  send_hour_utc       SMALLINT NOT NULL DEFAULT 7 CHECK (send_hour_utc >= 0 AND send_hour_utc <= 23),
  include_ai_summary  BOOLEAN NOT NULL DEFAULT true,
  extra_recipients    TEXT[]  NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT digest_email_config_location_unique UNIQUE (location_id)
);

CREATE INDEX IF NOT EXISTS idx_digest_email_config_location ON digest_email_config(location_id);

ALTER TABLE digest_email_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "digest_email_config_rls" ON digest_email_config
  USING (location_id IN (
    SELECT tenant_id FROM employees WHERE id = auth.uid()
  ));

-- updated_at auto-trigger
CREATE OR REPLACE FUNCTION digest_email_config_set_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS digest_email_config_updated ON digest_email_config;
CREATE TRIGGER digest_email_config_updated
  BEFORE UPDATE ON digest_email_config
  FOR EACH ROW EXECUTE FUNCTION digest_email_config_set_updated();

-- ── Versand-Log ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digest_email_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  digest_date       DATE NOT NULL,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipients_count  SMALLINT NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error             TEXT,
  CONSTRAINT digest_email_log_unique UNIQUE (location_id, digest_date)
);

CREATE INDEX IF NOT EXISTS idx_digest_email_log_location ON digest_email_log(location_id, sent_at DESC);

ALTER TABLE digest_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "digest_email_log_rls" ON digest_email_log
  USING (location_id IN (
    SELECT tenant_id FROM employees WHERE id = auth.uid()
  ));
