-- Phase 25: Webhook System + External Integration Engine
-- Erlaubt externe Systeme (POS, Payment, Analytics) Delivery-Events per HTTP zu empfangen.
-- Jeder Webhook abonniert bestimmte Event-Typen und erhält HMAC-signierte POST-Requests.

-- ============================================================
-- Tabellen
-- ============================================================

CREATE TABLE IF NOT EXISTS delivery_webhooks (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          text        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  url                  text        NOT NULL,
  secret               text        NOT NULL,               -- HMAC-SHA256 Signing-Key
  events               text[]      NOT NULL DEFAULT '{}',  -- abonnierte Event-Typen
  is_active            boolean     NOT NULL DEFAULT true,
  description          text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  last_delivered_at    timestamptz,
  consecutive_failures int         NOT NULL DEFAULT 0,
  UNIQUE(location_id, url)
);

COMMENT ON TABLE delivery_webhooks IS
  'Externe Webhook-Endpunkte pro Location. Empfangen HMAC-signierte Delivery-Events.';

CREATE TABLE IF NOT EXISTS delivery_webhook_deliveries (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      uuid        NOT NULL REFERENCES delivery_webhooks(id) ON DELETE CASCADE,
  location_id     text        NOT NULL,
  event_type      text        NOT NULL,
  payload         jsonb       NOT NULL DEFAULT '{}',
  delivered_at    timestamptz,                  -- gesetzt wenn HTTP 2xx oder endgültig fehlgeschlagen
  response_status int,                          -- HTTP-Statuscode der Antwort (-1 = Netzwerkfehler)
  response_body   text,                         -- erste 500 Zeichen der Antwort
  attempt_count   int         NOT NULL DEFAULT 1,
  next_retry_at   timestamptz,                  -- NULL = kein weiterer Retry geplant
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE delivery_webhook_deliveries IS
  'Auslieferungs-Log: ein Eintrag pro Event-Zustellversuch. Enthält Retry-State.';

-- ============================================================
-- Indizes
-- ============================================================

-- Pending-Queue: offene Zustellungen sortiert nach Fälligkeitszeitpunkt
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending
  ON delivery_webhook_deliveries(next_retry_at ASC NULLS FIRST, created_at ASC)
  WHERE delivered_at IS NULL;

-- Admin-Timeline: Deliveries einer Location chronologisch
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_location
  ON delivery_webhook_deliveries(location_id, created_at DESC);

-- Aktive Webhooks einer Location schnell finden
CREATE INDEX IF NOT EXISTS idx_delivery_webhooks_location_active
  ON delivery_webhooks(location_id)
  WHERE is_active = true;

-- ============================================================
-- Summary-View (Admin-Dashboard)
-- ============================================================

CREATE OR REPLACE VIEW v_webhook_summary AS
SELECT
  w.id,
  w.location_id,
  w.url,
  w.events,
  w.is_active,
  w.description,
  w.last_delivered_at,
  w.consecutive_failures,
  w.created_at,
  w.updated_at,
  COUNT(d.id) FILTER (
    WHERE d.delivered_at IS NOT NULL
      AND d.response_status >= 200
      AND d.response_status < 300
  )::int AS total_delivered,
  COUNT(d.id) FILTER (
    WHERE d.delivered_at IS NULL
      AND d.attempt_count < 5
  )::int AS pending_deliveries,
  COUNT(d.id) FILTER (
    WHERE d.delivered_at IS NOT NULL
      AND (d.response_status < 0 OR d.response_status >= 400)
  )::int AS failed_deliveries
FROM delivery_webhooks w
LEFT JOIN delivery_webhook_deliveries d ON d.webhook_id = w.id
GROUP BY w.id;

COMMENT ON VIEW v_webhook_summary IS
  'Webhook-Status mit Erfolgs-/Fehler-/Pending-Zählern für Admin-UI.';
