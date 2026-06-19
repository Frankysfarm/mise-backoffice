-- Migration 130: Delivery Admin Notification Center
-- Zentrales Benachrichtigungs-System für kritische Delivery-Events
-- Ereignisse: Fahrerverzögerung, Stornierung, ETA-Konfidenz, Batch-Stuck, etc.

-- ── Haupttabelle ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS delivery_admin_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL,
  type            text NOT NULL CHECK (type IN (
    'driver_delay',
    'order_cancelled',
    'eta_confidence_low',
    'batch_stuck',
    'no_driver_available',
    'high_cancellation_rate',
    'driver_offline_mid_tour',
    'sla_breach_imminent',
    'surge_active',
    'kitchen_backlog'
  )),
  severity        text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  title           text NOT NULL,
  body            text NOT NULL,
  metadata        jsonb,
  -- Referenzen
  order_id        uuid,
  driver_id       uuid,
  batch_id        uuid,
  -- Status
  is_read         boolean NOT NULL DEFAULT false,
  is_dismissed    boolean NOT NULL DEFAULT false,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  -- Dedup-Key: verhindert Doppel-Alerts für dasselbe Event
  dedup_key       text UNIQUE,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notif_location_unread
  ON delivery_admin_notifications (location_id, is_dismissed, created_at DESC)
  WHERE is_dismissed = false;

CREATE INDEX IF NOT EXISTS idx_admin_notif_type
  ON delivery_admin_notifications (location_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notif_severity
  ON delivery_admin_notifications (location_id, severity, is_dismissed)
  WHERE is_dismissed = false;

-- RLS
ALTER TABLE delivery_admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_notif_location_isolation" ON delivery_admin_notifications;
CREATE POLICY "admin_notif_location_isolation"
  ON delivery_admin_notifications
  USING (
    location_id IN (
      SELECT tenant_id FROM employees WHERE id = auth.uid()
      UNION
      SELECT location_id FROM employees WHERE id = auth.uid()
    )
  );

-- ── updated_at Trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_admin_notif_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_admin_notif_updated_at ON delivery_admin_notifications;
CREATE TRIGGER trg_admin_notif_updated_at
  BEFORE UPDATE ON delivery_admin_notifications
  FOR EACH ROW EXECUTE FUNCTION update_admin_notif_updated_at();

-- ── VIEWs ────────────────────────────────────────────────────────────────────

-- Aktive (nicht-verworfene) Notifications mit Zusammenfassung
CREATE OR REPLACE VIEW v_admin_notifications_active AS
SELECT
  n.*,
  EXTRACT(EPOCH FROM (now() - n.created_at)) / 60 AS age_minutes
FROM delivery_admin_notifications n
WHERE n.is_dismissed = false
  AND (n.expires_at IS NULL OR n.expires_at > now())
ORDER BY
  CASE n.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
  n.created_at DESC;

-- Zusammenfassung pro Location
CREATE OR REPLACE VIEW v_admin_notification_summary AS
SELECT
  location_id,
  COUNT(*) FILTER (WHERE NOT is_dismissed AND (expires_at IS NULL OR expires_at > now())) AS total_active,
  COUNT(*) FILTER (WHERE NOT is_dismissed AND NOT is_read AND (expires_at IS NULL OR expires_at > now())) AS total_unread,
  COUNT(*) FILTER (WHERE severity = 'critical' AND NOT is_dismissed AND (expires_at IS NULL OR expires_at > now())) AS critical_count,
  COUNT(*) FILTER (WHERE severity = 'warning' AND NOT is_dismissed AND (expires_at IS NULL OR expires_at > now())) AS warning_count,
  MAX(created_at) FILTER (WHERE NOT is_dismissed) AS latest_notification_at
FROM delivery_admin_notifications
GROUP BY location_id;

-- ── RPC: Prune alte Notifications ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_old_admin_notifications(days_to_keep integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM delivery_admin_notifications
  WHERE created_at < now() - (days_to_keep || ' days')::interval
    AND (is_dismissed = true OR is_read = true);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN jsonb_build_object('pruned', deleted_count);
END;
$$;

-- ── RPC: Bulk-Dismiss (alle einer Location) ───────────────────────────────────

CREATE OR REPLACE FUNCTION dismiss_all_notifications(p_location_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE delivery_admin_notifications
  SET is_dismissed = true,
      acknowledged_by = p_user_id,
      acknowledged_at = now()
  WHERE location_id = p_location_id
    AND is_dismissed = false;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN jsonb_build_object('dismissed', updated_count);
END;
$$;
