-- Migration 194: Emergency Capacity Engine — Phase 404
-- Bereitschaftspool + Notfall-Kapazitäts-Events

-- ── Fahrer-Bereitschaftspool ──────────────────────────────────────────────────
-- Fahrer, die außerhalb ihrer regulären Schicht als Bereitschaft eingetragen sind.
CREATE TABLE IF NOT EXISTS driver_standby_pool (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID        NOT NULL REFERENCES mise_locations(id) ON DELETE CASCADE,
  driver_id           UUID        NOT NULL REFERENCES mise_drivers(id)   ON DELETE CASCADE,
  available_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  available_until     TIMESTAMPTZ NOT NULL,
  avg_response_min    INTEGER     NOT NULL DEFAULT 20,   -- historisch: Ø Min bis Ankunft
  response_rate_pct   NUMERIC(5,2) NOT NULL DEFAULT 100, -- historische Akzeptanzrate 0–100
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (driver_id, location_id)
);

-- ── Notfall-Kapazitäts-Events ─────────────────────────────────────────────────
-- Wann wurde ein Kapazitätsengpass erkannt und wie wurde er gelöst.
CREATE TABLE IF NOT EXISTS emergency_capacity_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID        NOT NULL REFERENCES mise_locations(id) ON DELETE CASCADE,
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  severity            TEXT        NOT NULL DEFAULT 'warning',  -- warning | critical
  active_drivers      INTEGER     NOT NULL DEFAULT 0,
  required_drivers    INTEGER     NOT NULL DEFAULT 0,
  capacity_gap        INTEGER     NOT NULL DEFAULT 0,          -- required - active
  pending_orders      INTEGER     NOT NULL DEFAULT 0,
  standby_notified    INTEGER     NOT NULL DEFAULT 0,
  standby_responded   INTEGER     NOT NULL DEFAULT 0,
  standby_activated   INTEGER     NOT NULL DEFAULT 0,
  resolved_at         TIMESTAMPTZ,
  resolution_type     TEXT,                                    -- drivers_arrived|demand_dropped|manual|auto_resolved
  auto_resolved       BOOLEAN     NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Einzel-Antworten der Bereitschaftsfahrer ──────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_response_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES emergency_capacity_events(id) ON DELETE CASCADE,
  driver_id       UUID        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id     UUID        NOT NULL,
  notified_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response        TEXT        NOT NULL DEFAULT 'no_response', -- accepted|declined|no_response
  responded_at    TIMESTAMPTZ,
  activated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, driver_id)
);

-- ── Indizes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_driver_standby_pool_location
  ON driver_standby_pool(location_id, is_active, available_until);

CREATE INDEX IF NOT EXISTS idx_emergency_capacity_events_location
  ON emergency_capacity_events(location_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_capacity_events_open
  ON emergency_capacity_events(location_id) WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_emergency_response_log_event
  ON emergency_response_log(event_id, driver_id);

-- ── updated_at Trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_driver_standby_pool_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_driver_standby_pool_updated_at ON driver_standby_pool;
CREATE TRIGGER trg_driver_standby_pool_updated_at
  BEFORE UPDATE ON driver_standby_pool
  FOR EACH ROW EXECUTE FUNCTION update_driver_standby_pool_updated_at();

-- ── Prune-RPC ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_emergency_capacity_events(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER AS $$
  WITH del AS (
    DELETE FROM emergency_capacity_events
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER FROM del;
$$;

-- ── View: Zusammenfassung je Standort ─────────────────────────────────────────
CREATE OR REPLACE VIEW v_emergency_capacity_summary AS
SELECT
  l.id                  AS location_id,
  l.name                AS location_name,
  COUNT(DISTINCT sp.driver_id)
    FILTER (WHERE sp.is_active AND sp.available_until > NOW())
                        AS standby_pool_size,
  COUNT(DISTINCT e.id)
    FILTER (WHERE e.resolved_at IS NULL)
                        AS open_emergencies,
  MAX(e.detected_at)
    FILTER (WHERE e.resolved_at IS NULL)
                        AS latest_emergency_at,
  COUNT(DISTINCT e.id)
    FILTER (WHERE e.detected_at >= NOW() - INTERVAL '7 days')
                        AS events_last_7d
FROM mise_locations l
LEFT JOIN driver_standby_pool sp     ON sp.location_id = l.id
LEFT JOIN emergency_capacity_events e ON e.location_id = l.id
WHERE l.is_active = true
GROUP BY l.id, l.name;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE driver_standby_pool       ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_capacity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_response_log    ENABLE ROW LEVEL SECURITY;

-- driver_standby_pool
CREATE POLICY "service_role full on driver_standby_pool"
  ON driver_standby_pool FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read own driver_standby_pool"
  ON driver_standby_pool FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM tenant_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "authenticated write admin on driver_standby_pool"
  ON driver_standby_pool FOR ALL TO authenticated
  USING (location_id IN (
    SELECT location_id FROM tenant_users
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  ));

-- emergency_capacity_events
CREATE POLICY "service_role full on emergency_capacity_events"
  ON emergency_capacity_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read own emergency_capacity_events"
  ON emergency_capacity_events FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM tenant_users WHERE user_id = auth.uid()
  ));

-- emergency_response_log
CREATE POLICY "service_role full on emergency_response_log"
  ON emergency_response_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read own emergency_response_log"
  ON emergency_response_log FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM tenant_users WHERE user_id = auth.uid()
  ));
