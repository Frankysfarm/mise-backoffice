-- Migration 085: WhatsApp Business API Integration
-- WhatsApp-Konfiguration, Nachrichten-Log, Opt-In-Tracking

-- ── Konfiguration pro Location ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_whatsapp_config (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  is_enabled       boolean NOT NULL DEFAULT false,
  -- Meta WhatsApp Business API
  provider         text NOT NULL DEFAULT 'meta' CHECK (provider IN ('meta', 'twilio', 'disabled')),
  meta_phone_id    text,
  meta_access_token text,
  twilio_sid       text,
  twilio_token     text,
  twilio_whatsapp_from text,
  -- Template-IDs (müssen im WA Business Manager freigegeben sein)
  template_driver_assigned   text DEFAULT 'mise_driver_assigned',
  template_driver_departing  text DEFAULT 'mise_driver_departing',
  template_driver_nearby     text DEFAULT 'mise_driver_nearby',
  template_delivered         text DEFAULT 'mise_delivered',
  template_cancelled         text DEFAULT 'mise_cancelled',
  template_delayed           text DEFAULT 'mise_delayed',
  -- Nachrichten-Sprache (IETF)
  language_code    text NOT NULL DEFAULT 'de',
  -- Eingeschaltete Events
  enabled_events   text[] NOT NULL DEFAULT ARRAY['driver_departing','driver_nearby','delivered','cancelled'],
  -- Opt-In-Modus: 'explicit' (Checkbox), 'implicit' (Bestätigungsnachricht)
  optin_mode       text NOT NULL DEFAULT 'explicit' CHECK (optin_mode IN ('explicit', 'implicit')),
  -- Tages-Limit pro Telefonnummer (0 = unlimitiert)
  daily_limit_per_number int NOT NULL DEFAULT 10,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id)
);

-- ── Kunden Opt-In ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_optins (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  phone          text NOT NULL,
  opted_in       boolean NOT NULL DEFAULT true,
  opted_in_at    timestamptz,
  opted_out_at   timestamptz,
  source         text DEFAULT 'checkout',  -- checkout | sms_reply | admin
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, phone)
);

-- ── Nachrichten-Log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_message_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id        uuid REFERENCES customer_orders(id) ON DELETE SET NULL,
  phone           text NOT NULL,
  event_type      text NOT NULL,
  template_name   text,
  provider        text NOT NULL DEFAULT 'meta',
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','delivered','read')),
  provider_msg_id text,
  error_message   text,
  sent_at         timestamptz,
  delivered_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Indizes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wa_config_location     ON delivery_whatsapp_config(location_id);
CREATE INDEX IF NOT EXISTS idx_wa_optins_location     ON whatsapp_optins(location_id);
CREATE INDEX IF NOT EXISTS idx_wa_optins_phone        ON whatsapp_optins(location_id, phone);
CREATE INDEX IF NOT EXISTS idx_wa_log_location        ON whatsapp_message_log(location_id);
CREATE INDEX IF NOT EXISTS idx_wa_log_order           ON whatsapp_message_log(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_log_created         ON whatsapp_message_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_log_status_pending  ON whatsapp_message_log(location_id, status) WHERE status = 'pending';

-- ── Dashboard-VIEW ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_whatsapp_stats AS
SELECT
  l.id                          AS location_id,
  l.name                        AS location_name,
  COUNT(wml.id)                 AS total_messages,
  COUNT(wml.id) FILTER (WHERE wml.status = 'sent')      AS sent_count,
  COUNT(wml.id) FILTER (WHERE wml.status = 'delivered') AS delivered_count,
  COUNT(wml.id) FILTER (WHERE wml.status = 'failed')    AS failed_count,
  COUNT(wml.id) FILTER (WHERE wml.created_at >= NOW() - INTERVAL '24 hours') AS last_24h,
  COUNT(DISTINCT wml.phone)     AS unique_recipients,
  COUNT(wo.id) FILTER (WHERE wo.opted_in = true) AS active_optins,
  ROUND(
    100.0 * COUNT(wml.id) FILTER (WHERE wml.status IN ('sent','delivered'))
    / NULLIF(COUNT(wml.id) FILTER (WHERE wml.status IN ('sent','delivered','failed')), 0),
    1
  )                             AS delivery_rate_pct
FROM locations l
LEFT JOIN whatsapp_message_log wml ON wml.location_id = l.id
LEFT JOIN whatsapp_optins wo       ON wo.location_id  = l.id
GROUP BY l.id, l.name;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE delivery_whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_optins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_log     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_rw_whatsapp_config" ON delivery_whatsapp_config;
DROP POLICY IF EXISTS "service_rw_whatsapp_optins" ON whatsapp_optins;
DROP POLICY IF EXISTS "service_rw_whatsapp_log"    ON whatsapp_message_log;

CREATE POLICY "service_rw_whatsapp_config" ON delivery_whatsapp_config
  USING (auth.role() = 'service_role');
CREATE POLICY "service_rw_whatsapp_optins" ON whatsapp_optins
  USING (auth.role() = 'service_role');
CREATE POLICY "service_rw_whatsapp_log"    ON whatsapp_message_log
  USING (auth.role() = 'service_role');
