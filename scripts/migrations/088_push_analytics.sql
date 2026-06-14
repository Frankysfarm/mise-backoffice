-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 088: Unified Push Notification Analytics
-- Phase 175 — Cross-Channel Push Performance Dashboard
--
-- Aggregiert täglich aus:
--   customer_web_push_log  (VAPID Browser-Push)
--   whatsapp_message_log   (WhatsApp Business API)
--   mise_push_outbox       (Fahrer-App Push)
-- ─────────────────────────────────────────────────────────────────────────────

-- Tägliche Pre-Aggregation pro Location + Channel + Event-Type
CREATE TABLE IF NOT EXISTS push_analytics_daily (
  id            bigserial     PRIMARY KEY,
  location_id   uuid          NOT NULL,
  channel       text          NOT NULL CHECK (channel IN ('vapid','whatsapp','driver')),
  snapshot_date date          NOT NULL DEFAULT CURRENT_DATE,
  event_type    text          NOT NULL DEFAULT 'all',
  sent          integer       NOT NULL DEFAULT 0,
  delivered     integer       NOT NULL DEFAULT 0,
  failed        integer       NOT NULL DEFAULT 0,
  expired       integer       NOT NULL DEFAULT 0,
  read_count    integer       NOT NULL DEFAULT 0,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (location_id, channel, snapshot_date, event_type)
);

CREATE INDEX IF NOT EXISTS idx_pad_loc_date
  ON push_analytics_daily(location_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_pad_channel
  ON push_analytics_daily(location_id, channel, snapshot_date DESC);

-- Auto-Update updated_at
CREATE OR REPLACE FUNCTION update_push_analytics_daily_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_pad_updated_at ON push_analytics_daily;
CREATE TRIGGER trg_pad_updated_at
  BEFORE UPDATE ON push_analytics_daily
  FOR EACH ROW EXECUTE FUNCTION update_push_analytics_daily_updated_at();

-- ── 7-Tage-Kanal-Vergleich ───────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_push_channel_7d AS
SELECT
  location_id,
  channel,
  SUM(sent)       AS sent_7d,
  SUM(delivered)  AS delivered_7d,
  SUM(failed)     AS failed_7d,
  SUM(expired)    AS expired_7d,
  SUM(read_count) AS read_7d,
  ROUND(
    100.0 * SUM(delivered) / NULLIF(SUM(sent) + SUM(failed), 0),
    1
  ) AS delivery_rate_pct,
  ROUND(
    100.0 * SUM(read_count) / NULLIF(SUM(delivered), 0),
    1
  ) AS read_rate_pct
FROM push_analytics_daily
WHERE snapshot_date >= CURRENT_DATE - 6
GROUP BY location_id, channel;

-- ── Event-Type-Aufschlüsselung (alle Kanäle, 30 Tage) ──────────────────────
CREATE OR REPLACE VIEW v_push_event_breakdown AS
SELECT
  location_id,
  channel,
  event_type,
  SUM(sent)       AS sent_30d,
  SUM(delivered)  AS delivered_30d,
  SUM(failed)     AS failed_30d,
  ROUND(
    100.0 * SUM(delivered) / NULLIF(SUM(sent) + SUM(failed), 0),
    1
  ) AS delivery_rate_pct
FROM push_analytics_daily
WHERE snapshot_date >= CURRENT_DATE - 29
  AND event_type <> 'all'
GROUP BY location_id, channel, event_type
ORDER BY location_id, channel, sent_30d DESC;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE push_analytics_daily ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_analytics_daily' AND policyname = 'svc_all_pad'
  ) THEN
    CREATE POLICY svc_all_pad ON push_analytics_daily
      FOR ALL TO service_role USING (true);
  END IF;
END $$;
