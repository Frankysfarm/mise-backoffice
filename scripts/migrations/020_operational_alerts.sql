-- ============================================================
-- Migration 020: Operational Alerts Engine
-- Phase 20 — Schwellenwert-basierte Betriebsalarme
-- ============================================================

-- Konfigurierbare Alert-Schwellenwerte pro Location + Alert-Typ
CREATE TABLE IF NOT EXISTS delivery_alert_rules (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   text        NOT NULL,
  alert_type    text        NOT NULL,   -- dispatch_queue_high | no_drivers_online | kitchen_overload | stale_orders_critical | eta_accuracy_low
  threshold_value integer   NOT NULL,   -- Zahlenwert (z.B. 5 offene Bestellungen, 70 % On-Time-Rate)
  window_minutes  integer   NOT NULL DEFAULT 5,  -- Wie lange Bedingung gelten muss (0 = sofort)
  severity        text      NOT NULL DEFAULT 'warning', -- info | warning | critical
  enabled         boolean   NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id, alert_type)
);

-- Alert-Verlauf (aktive + aufgelöste Alarme)
CREATE TABLE IF NOT EXISTS delivery_alerts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   text        NOT NULL,
  alert_type    text        NOT NULL,
  severity      text        NOT NULL DEFAULT 'warning',
  message       text        NOT NULL,
  details       jsonb,
  auto_resolve  boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   text        -- user_id oder 'auto'
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_alert_rules_location
  ON delivery_alert_rules(location_id);

CREATE INDEX IF NOT EXISTS idx_alerts_active
  ON delivery_alerts(location_id, alert_type, resolved_at)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_history
  ON delivery_alerts(location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_type_active
  ON delivery_alerts(alert_type, resolved_at)
  WHERE resolved_at IS NULL;

-- View: nur aktive (nicht aufgelöste) Alarme
CREATE OR REPLACE VIEW v_active_alerts AS
SELECT
  id,
  location_id,
  alert_type,
  severity,
  message,
  details,
  auto_resolve,
  created_at,
  EXTRACT(EPOCH FROM (now() - created_at)) / 60 AS age_minutes
FROM delivery_alerts
WHERE resolved_at IS NULL
ORDER BY
  CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
  created_at DESC;

-- View: Alert-Zusammenfassung pro Location (Dashboard-Chip)
CREATE OR REPLACE VIEW v_alert_summary AS
SELECT
  location_id,
  COUNT(*)                                                       AS total_active,
  COUNT(*) FILTER (WHERE severity = 'critical')                  AS critical_count,
  COUNT(*) FILTER (WHERE severity = 'warning')                   AS warning_count,
  MAX(created_at)                                                AS latest_alert_at,
  MIN(CASE WHEN severity = 'critical' THEN created_at END)       AS oldest_critical_at
FROM delivery_alerts
WHERE resolved_at IS NULL
GROUP BY location_id;
