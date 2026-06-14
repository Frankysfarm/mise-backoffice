-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 089: Push-Notification Scheduling Engine
-- Phase 177 — Geplante Kampagnen + Best-Time-to-Send
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Kampagnen-Tabelle ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_campaigns (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id     uuid          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name            text          NOT NULL,
  channel         text          NOT NULL CHECK (channel IN ('vapid','whatsapp','driver','all')),
  -- Nachricht
  title           text          NOT NULL,
  body            text          NOT NULL,
  url             text,
  -- Zielgruppe
  audience        text          NOT NULL DEFAULT 'all'
                                CHECK (audience IN ('all','active_7d','active_30d','inactive_30d','inactive_90d')),
  -- Zeitplan
  status          text          NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','scheduled','running','completed','cancelled','failed')),
  scheduled_at    timestamptz,                        -- NULL = sofort (manuell ausführen)
  use_best_time   boolean       NOT NULL DEFAULT false, -- Best-Time-to-Send nutzen
  best_time_window_start int    DEFAULT 8,             -- UTC-Stunde (inkl.)
  best_time_window_end   int    DEFAULT 21,            -- UTC-Stunde (exkl.)
  -- Ergebnis
  started_at      timestamptz,
  completed_at    timestamptz,
  recipients_total   integer   DEFAULT 0,
  recipients_sent    integer   DEFAULT 0,
  recipients_failed  integer   DEFAULT 0,
  -- Metadaten
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pc_location       ON push_campaigns(location_id, status);
CREATE INDEX IF NOT EXISTS idx_pc_scheduled      ON push_campaigns(scheduled_at) WHERE status = 'scheduled';

-- ── Versandprotokoll ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_campaign_sends (
  id             uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id    uuid         NOT NULL REFERENCES push_campaigns(id) ON DELETE CASCADE,
  location_id    uuid         NOT NULL,
  channel        text         NOT NULL,
  recipient_ref  text         NOT NULL,    -- subscription_id / phone / driver_id
  status         text         NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued','sent','delivered','failed','skipped')),
  error_msg      text,
  sent_at        timestamptz,
  delivered_at   timestamptz,
  created_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcs_campaign ON push_campaign_sends(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_pcs_location ON push_campaign_sends(location_id, created_at DESC);

-- ── Trigger: updated_at ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_push_campaigns_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_push_campaigns_updated_at ON push_campaigns;
CREATE TRIGGER set_push_campaigns_updated_at
  BEFORE UPDATE ON push_campaigns
  FOR EACH ROW EXECUTE FUNCTION trg_push_campaigns_updated_at();

-- ── View: Kampagnen-Performance ───────────────────────────────────────────────

CREATE OR REPLACE VIEW v_campaign_performance AS
SELECT
  c.id,
  c.location_id,
  c.name,
  c.channel,
  c.audience,
  c.status,
  c.scheduled_at,
  c.started_at,
  c.completed_at,
  c.recipients_total,
  c.recipients_sent,
  c.recipients_failed,
  CASE WHEN c.recipients_sent > 0
    THEN ROUND(100.0 * c.recipients_sent / NULLIF(c.recipients_total, 0), 1)
    ELSE NULL
  END AS send_rate_pct,
  COUNT(s.id) FILTER (WHERE s.status = 'delivered') AS delivered_count,
  CASE WHEN COUNT(s.id) FILTER (WHERE s.status IN ('sent','delivered')) > 0
    THEN ROUND(
      100.0 * COUNT(s.id) FILTER (WHERE s.status = 'delivered') /
      NULLIF(COUNT(s.id) FILTER (WHERE s.status IN ('sent','delivered')), 0), 1)
    ELSE NULL
  END AS delivery_rate_pct,
  EXTRACT(EPOCH FROM (c.completed_at - c.started_at))::int AS duration_sec,
  c.created_at
FROM push_campaigns c
LEFT JOIN push_campaign_sends s ON s.campaign_id = c.id
GROUP BY c.id;

-- ── View: Beste Sendezeiten (aus push_analytics_daily) ───────────────────────

CREATE OR REPLACE VIEW v_best_send_hours AS
-- Aggregiert aus push_analytics_daily pro Location + UTC-Stunde die Ø-Lieferrate
-- (Proxy: Stunden mit hohem Volumen + hoher Lieferrate = gute Sendezeit)
-- Da push_analytics_daily keine Stunden-Granularität hat, verwenden wir
-- whatsapp_message_log als stündliche Datenquelle
SELECT
  wml.location_id,
  EXTRACT(HOUR FROM wml.created_at AT TIME ZONE 'UTC')::int AS hour_utc,
  COUNT(*)                                             AS total_sent,
  COUNT(*) FILTER (WHERE wml.status IN ('delivered','read')) AS total_delivered,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE wml.status IN ('delivered','read')) /
    NULLIF(COUNT(*), 0), 1
  )                                                    AS delivery_rate_pct,
  -- Score: Volumen × Lieferrate (höher = bessere Sendezeit)
  ROUND(
    COUNT(*) *
    (COUNT(*) FILTER (WHERE wml.status IN ('delivered','read'))::float /
     NULLIF(COUNT(*), 0)), 1
  )                                                    AS send_score
FROM whatsapp_message_log wml
WHERE wml.created_at >= now() - INTERVAL '30 days'
GROUP BY wml.location_id, EXTRACT(HOUR FROM wml.created_at AT TIME ZONE 'UTC')
ORDER BY wml.location_id, send_score DESC;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE push_campaigns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_campaign_sends  ENABLE ROW LEVEL SECURITY;

-- Service-Role kann alles (Cron + API-Routes)
DROP POLICY IF EXISTS "service_all_push_campaigns"      ON push_campaigns;
DROP POLICY IF EXISTS "service_all_push_campaign_sends" ON push_campaign_sends;

CREATE POLICY "service_all_push_campaigns"
  ON push_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_all_push_campaign_sends"
  ON push_campaign_sends FOR ALL TO service_role USING (true) WITH CHECK (true);
