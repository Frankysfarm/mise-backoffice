-- Migration 041: Customer Push Notification Engine
-- Phase 49: Outbound SMS/Email/WhatsApp notifications via webhook per tenant
-- Builds on customer_delivery_events (Migration 031)

-- ── Config-Tabelle: eine Zeile pro Location ───────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_notification_config (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      text        NOT NULL,
  is_enabled       boolean     NOT NULL DEFAULT false,
  webhook_url      text,                   -- HTTP endpoint of SMS/email provider
  webhook_secret   text,                   -- HMAC-SHA256 signing secret
  enabled_events   text[]      NOT NULL DEFAULT ARRAY[
                                 'driver_departing',
                                 'driver_nearby',
                                 'delivered',
                                 'cancelled',
                                 'delayed'
                               ]::text[],
  message_prefix   text,                   -- prepended to every message, e.g. "Hallo {name}, "
  max_per_order    int         NOT NULL DEFAULT 5,
  timeout_ms       int         NOT NULL DEFAULT 8000,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_notification_config_location_uniq UNIQUE (location_id)
);

-- ── Queue-Tabelle ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_notification_queue (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      text        NOT NULL,
  order_id         text        NOT NULL,
  event_id         uuid,                   -- FK customer_delivery_events.id (informational)
  event_type       text        NOT NULL,
  customer_phone   text,
  customer_email   text,
  customer_name    text,
  message_de       text        NOT NULL,
  metadata         jsonb,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','sent','failed','skipped')),
  attempt_count    int         NOT NULL DEFAULT 0,
  last_attempt_at  timestamptz,
  next_retry_at    timestamptz,
  sent_at          timestamptz,
  webhook_status   int,
  webhook_response text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Indizes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cnq_pending
  ON customer_notification_queue (location_id, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_cnq_order
  ON customer_notification_queue (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cnq_status_retry
  ON customer_notification_queue (status, next_retry_at)
  WHERE status = 'pending';

-- ── View: versandbereite Nachrichten ──────────────────────────────────────────
CREATE OR REPLACE VIEW v_pending_customer_notifications AS
SELECT
  q.id,
  q.location_id,
  q.order_id,
  q.event_id,
  q.event_type,
  q.customer_phone,
  q.customer_email,
  q.customer_name,
  q.message_de,
  q.metadata,
  q.attempt_count,
  c.webhook_url,
  c.webhook_secret,
  c.timeout_ms,
  c.message_prefix
FROM customer_notification_queue q
JOIN customer_notification_config c ON c.location_id = q.location_id
WHERE q.status = 'pending'
  AND (q.next_retry_at IS NULL OR q.next_retry_at <= now())
  AND c.is_enabled = true
  AND c.webhook_url IS NOT NULL
ORDER BY q.created_at
LIMIT 200;

-- ── View: Admin-Überblick (neueste 500) ──────────────────────────────────────
CREATE OR REPLACE VIEW v_customer_notification_log AS
SELECT
  q.id,
  q.location_id,
  q.order_id,
  q.event_type,
  q.customer_phone,
  q.customer_email,
  q.customer_name,
  q.message_de,
  q.status,
  q.attempt_count,
  q.webhook_status,
  q.sent_at,
  q.created_at
FROM customer_notification_queue q
ORDER BY q.created_at DESC
LIMIT 500;

-- ── Per-Order-Zähler-Funktion ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION count_customer_notifications_for_order(
  p_order_id text
) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(*)::int
  FROM customer_notification_queue
  WHERE order_id = p_order_id
    AND status IN ('pending', 'sent');
$$;
