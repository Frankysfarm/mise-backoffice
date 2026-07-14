-- Migration 232: Phase 1471-1475
-- Schicht-Ende-Prognose + Kunden-Benachrichtigungs-Opt-In

-- Kunden-Benachrichtigungs-Opt-In (Phase 1475)
CREATE TABLE IF NOT EXISTS customer_notification_optins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL,
  customer_id    TEXT,
  email          TEXT,
  push_token     TEXT,
  kanal          TEXT NOT NULL CHECK (kanal IN ('email', 'push', 'beide')),
  opt_in_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aktiv          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_notification_optins_location
  ON customer_notification_optins (location_id);

CREATE INDEX IF NOT EXISTS idx_customer_notification_optins_email
  ON customer_notification_optins (email)
  WHERE email IS NOT NULL;

-- Schicht-Ende-Log für Prognose-Auswertung (Phase 1471)
CREATE TABLE IF NOT EXISTS schicht_ende_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID NOT NULL,
  driver_id             UUID,
  geschaetztes_ende_iso TIMESTAMPTZ,
  tatsaechliches_ende   TIMESTAMPTZ,
  offene_stopps         INT DEFAULT 0,
  aktive_touren         INT DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schicht_ende_log_location
  ON schicht_ende_log (location_id, created_at DESC);
