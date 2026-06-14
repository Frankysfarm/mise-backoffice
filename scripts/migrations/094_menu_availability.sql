-- 094_menu_availability.sql
-- Phase 185: Smart Dynamic Menu Availability Engine
-- Küche kann Menü-Artikel manuell oder automatisch bei Überlastung deaktivieren

-- Konfiguration + Zustand pro Artikel
CREATE TABLE IF NOT EXISTS menu_availability_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,

  -- Auto-disable Konfiguration
  auto_disable_enabled BOOLEAN NOT NULL DEFAULT true,
  queue_depth_threshold INT NOT NULL DEFAULT 8,   -- deaktivieren wenn Queue > N

  -- Aktueller Zustand
  is_disabled BOOLEAN NOT NULL DEFAULT false,
  disabled_reason TEXT,
  disabled_until TIMESTAMPTZ,                      -- NULL = unbefristet
  disabled_by TEXT,                                -- 'auto' | Mitarbeitername
  disabled_at TIMESTAMPTZ,

  -- Statistik (7-Tage-Rollup, täglich per Cron aktualisiert)
  disable_count_7d INT NOT NULL DEFAULT 0,
  last_auto_disabled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(location_id, item_name)
);

-- Ereignis-Log (alle Zustandswechsel)
CREATE TABLE IF NOT EXISTS menu_availability_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'auto_disabled', 'manual_disabled',
    'auto_restored', 'manual_restored',
    'item_added', 'item_removed'
  )),
  trigger_queue_depth INT,
  trigger_reason TEXT,
  disabled_by TEXT,
  duration_min INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- View: aktueller Verfügbarkeitsstatus (bereinigt abgelaufene Sperren)
CREATE OR REPLACE VIEW v_menu_availability_state AS
SELECT
  mao.id,
  mao.location_id,
  mao.item_name,
  mao.auto_disable_enabled,
  mao.queue_depth_threshold,
  mao.disable_count_7d,
  mao.last_auto_disabled_at,
  mao.disabled_reason,
  mao.disabled_until,
  mao.disabled_by,
  mao.disabled_at,
  mao.created_at,
  mao.updated_at,
  -- Zustand: berücksichtigt abgelaufene Zeitfenster
  CASE
    WHEN mao.is_disabled
      AND (mao.disabled_until IS NULL OR mao.disabled_until > now())
    THEN true
    ELSE false
  END AS is_disabled,
  CASE
    WHEN mao.is_disabled
      AND (mao.disabled_until IS NULL OR mao.disabled_until > now())
    THEN 'disabled'::TEXT
    ELSE 'available'::TEXT
  END AS current_state,
  CASE
    WHEN mao.disabled_until IS NOT NULL AND mao.disabled_until > now()
    THEN GREATEST(0, EXTRACT(EPOCH FROM (mao.disabled_until - now()))::INT / 60)
    ELSE NULL
  END AS disabled_minutes_remaining,
  l.name AS location_name
FROM menu_availability_overrides mao
JOIN locations l ON l.id = mao.location_id;

-- Indizes
CREATE INDEX IF NOT EXISTS idx_menu_avail_location
  ON menu_availability_overrides(location_id);

CREATE INDEX IF NOT EXISTS idx_menu_avail_disabled
  ON menu_availability_overrides(location_id, is_disabled)
  WHERE is_disabled = true;

CREATE INDEX IF NOT EXISTS idx_menu_avail_events_loc_time
  ON menu_availability_events(location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_menu_avail_events_type
  ON menu_availability_events(location_id, event_type, created_at DESC);

-- RLS
ALTER TABLE menu_availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_availability_events    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_menu_avail"
  ON menu_availability_overrides FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_menu_avail_events"
  ON menu_availability_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Hilfsfunktion: 7-Tage-Zähler aktualisieren (per Cron)
CREATE OR REPLACE FUNCTION refresh_menu_disable_counts()
RETURNS VOID AS $$
BEGIN
  UPDATE menu_availability_overrides mao
  SET
    disable_count_7d = (
      SELECT COUNT(*)
      FROM menu_availability_events mae
      WHERE mae.location_id = mao.location_id
        AND mae.item_name   = mao.item_name
        AND mae.event_type  IN ('auto_disabled', 'manual_disabled')
        AND mae.created_at  >= now() - INTERVAL '7 days'
    ),
    updated_at = now();
END;
$$ LANGUAGE plpgsql;
