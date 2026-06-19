-- 145_status_push_log.sql
-- Phase 303 — Status-Push-Bridge: Deduplizierungs-Log
--
-- Stellt sicher, dass jede Push-Benachrichtigung je Bestellung+Event
-- nur einmal gesendet wird, auch bei Race Conditions oder Retry-Logik.

CREATE TABLE IF NOT EXISTS status_push_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID        NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  location_id UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  fired_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Deduplizierungs-Constraint: je Bestellung+Event nur einmal
  UNIQUE (order_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_status_push_log_order    ON status_push_log(order_id);
CREATE INDEX IF NOT EXISTS idx_status_push_log_location ON status_push_log(location_id, fired_at DESC);

ALTER TABLE status_push_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_push_log_admin_rls" ON status_push_log
  USING (location_id IN (
    SELECT location_id FROM employees WHERE user_id = auth.uid()
  ));

-- Service-Role darf immer schreiben (für Server-Side Bridge)
CREATE POLICY "status_push_log_service_insert" ON status_push_log
  FOR INSERT
  WITH CHECK (true);

-- ── Cleanup-Funktion (via Cron, 30+ Tage alte Einträge löschen) ───────────────
CREATE OR REPLACE FUNCTION prune_status_push_log(days_old INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted INT;
BEGIN
  DELETE FROM status_push_log WHERE fired_at < now() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
