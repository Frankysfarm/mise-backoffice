-- 143_customer_tracking_sse.sql
-- Phase 301 — Echtzeit-Kunden-Tracking via SSE (Server-Sent Events)
--
-- Speichert anonymisierte SSE-Session-Analytics für Live-Tracking-Nutzung.
-- Ermöglicht Auswertung: Wie viele Kunden verfolgen ihre Lieferung live?

-- ── SSE-Session-Protokoll ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracking_sse_sessions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID        NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  location_id      UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  bestellnummer    TEXT        NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_ping_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at        TIMESTAMPTZ,
  close_reason     TEXT,        -- 'delivered' | 'timeout' | 'client_disconnect' | 'error'
  frames_sent      INT         NOT NULL DEFAULT 0,
  ip_hash          TEXT,        -- SHA-256[:16] für Missbrauchsschutz, kein personenbezogener Bezug
  user_agent_hint  TEXT         -- z.B. 'mobile' | 'desktop'
);

CREATE INDEX IF NOT EXISTS idx_tss_order       ON tracking_sse_sessions(order_id);
CREATE INDEX IF NOT EXISTS idx_tss_location    ON tracking_sse_sessions(location_id);
CREATE INDEX IF NOT EXISTS idx_tss_started     ON tracking_sse_sessions(location_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tss_active      ON tracking_sse_sessions(location_id, closed_at)
  WHERE closed_at IS NULL;

ALTER TABLE tracking_sse_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tss_admin_rls" ON tracking_sse_sessions
  USING (location_id IN (
    SELECT location_id FROM employees WHERE user_id = auth.uid()
  ));

-- ── Tages-Aggregat-View ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_sse_tracking_stats AS
SELECT
  location_id,
  DATE(started_at)                               AS day,
  COUNT(*)                                       AS total_sessions,
  COUNT(*) FILTER (WHERE close_reason = 'delivered') AS completed_to_delivery,
  COUNT(*) FILTER (WHERE close_reason = 'timeout')   AS timed_out,
  ROUND(AVG(frames_sent))                        AS avg_frames_per_session,
  ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(closed_at, now()) - started_at)) / 60.0), 1)
                                                 AS avg_session_min
FROM tracking_sse_sessions
GROUP BY location_id, DATE(started_at);
