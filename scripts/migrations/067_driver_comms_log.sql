-- Migration 067: Fahrer-Kommunikations-Log
-- Verfolgt alle Nachrichten (Push/Broadcast/System) zwischen Dispatch und Fahrern

-- ─── Tabelle ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_communication_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id       UUID REFERENCES mise_drivers(id) ON DELETE SET NULL,
  -- NULL driver_id = Broadcast an alle Fahrer
  channel         TEXT NOT NULL CHECK (channel IN ('push','broadcast','in_app','system')),
  message_type    TEXT NOT NULL CHECK (message_type IN (
    'dispatch_assign','route_update','broadcast','surge_notify',
    'positioning','challenge','shift_alert','system','custom'
  )),
  direction       TEXT NOT NULL DEFAULT 'dispatch_to_driver'
    CHECK (direction IN ('dispatch_to_driver','system','driver_to_dispatch')),
  title           TEXT,
  body            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','delivered','read','failed')),
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  sent_by_name    TEXT,
  reference_type  TEXT,   -- 'tour'|'broadcast'|'surge_prediction'|...
  reference_id    TEXT,   -- UUID des referenzierten Objekts
  metadata        JSONB   NOT NULL DEFAULT '{}'
);

-- ─── Indizes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dcl_location_sent
  ON driver_communication_log(location_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_dcl_driver_sent
  ON driver_communication_log(driver_id, sent_at DESC)
  WHERE driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dcl_channel_type
  ON driver_communication_log(channel, message_type);

CREATE INDEX IF NOT EXISTS idx_dcl_status
  ON driver_communication_log(status, sent_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE driver_communication_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_iso_comms_log" ON driver_communication_log
  USING (location_id IN (
    SELECT l.id FROM locations l
    JOIN employees e ON e.tenant_id = l.tenant_id
    WHERE e.user_id = auth.uid()
  ));

-- ─── View: Tages-KPIs ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_comms_log_stats AS
SELECT
  location_id,
  COUNT(*)                                              AS total_messages,
  COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '24 hours') AS messages_today,
  COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '7 days')   AS messages_week,
  COUNT(*) FILTER (WHERE channel = 'push')              AS push_count,
  COUNT(*) FILTER (WHERE channel = 'broadcast')         AS broadcast_count,
  COUNT(*) FILTER (WHERE channel = 'in_app')            AS in_app_count,
  COUNT(*) FILTER (WHERE channel = 'system')            AS system_count,
  COUNT(*) FILTER (WHERE status = 'read')               AS read_count,
  COUNT(*) FILTER (WHERE status = 'delivered')          AS delivered_count,
  COUNT(*) FILTER (WHERE status = 'failed')             AS failed_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'read')
    / NULLIF(COUNT(*) FILTER (WHERE status IN ('delivered','read')), 0), 1
  )                                                     AS read_rate_pct,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status IN ('delivered','read'))
    / NULLIF(COUNT(*) FILTER (WHERE status IN ('sent','delivered','read')), 0), 1
  )                                                     AS delivery_rate_pct
FROM driver_communication_log
GROUP BY location_id;

-- ─── View: Pro-Fahrer Zusammenfassung ─────────────────────────────────────────
CREATE OR REPLACE VIEW v_comms_log_driver_summary AS
SELECT
  dcl.location_id,
  dcl.driver_id,
  d.name                                               AS driver_name,
  COUNT(*)                                             AS total_messages,
  COUNT(*) FILTER (WHERE dcl.sent_at >= NOW() - INTERVAL '24 hours') AS messages_today,
  MAX(dcl.sent_at)                                     AS last_message_at,
  COUNT(*) FILTER (WHERE dcl.status = 'read')          AS read_count,
  COUNT(*) FILTER (WHERE dcl.channel = 'push')         AS push_count,
  COUNT(*) FILTER (WHERE dcl.channel = 'broadcast')    AS broadcast_count
FROM driver_communication_log dcl
LEFT JOIN mise_drivers d ON d.id = dcl.driver_id
WHERE dcl.driver_id IS NOT NULL
GROUP BY dcl.location_id, dcl.driver_id, d.name;
