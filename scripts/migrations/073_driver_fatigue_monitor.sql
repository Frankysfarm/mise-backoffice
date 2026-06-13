-- Migration 073: Smart Driver Fatigue & Shift Health Monitor
-- Phase 119 — 2026-06-13
--
-- Tracks driver fatigue indicators during active shifts:
-- hours online, deliveries per hour, break gaps, speed drift, error rate.
-- Produces a fatigue risk score (0–100, higher = more fatigued) per driver
-- so dispatch operators can act before safety becomes a concern.

-- ─── Tabellen ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_fatigue_snapshots (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id             UUID        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  snapshot_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Shift context
  shift_id              UUID,                         -- references driver_shifts(id) if exists
  hours_on_shift        NUMERIC(5,2) NOT NULL DEFAULT 0,   -- h since shift start or first delivery
  shift_deliveries      INTEGER      NOT NULL DEFAULT 0,   -- total deliveries this shift

  -- Rate metrics (rolling window)
  deliveries_last_60min INTEGER      NOT NULL DEFAULT 0,
  deliveries_last_30min INTEGER      NOT NULL DEFAULT 0,
  avg_delivery_min_shift NUMERIC(5,1),                     -- avg delivery time this shift
  avg_delivery_min_last3 NUMERIC(5,1),                     -- avg of last 3 deliveries

  -- Break indicators
  last_delivery_ago_min INTEGER,                           -- minutes since last completed delivery
  longest_break_min     INTEGER      NOT NULL DEFAULT 0,   -- longest break this shift
  break_count           INTEGER      NOT NULL DEFAULT 0,   -- breaks >15 min this shift

  -- Performance drift
  speed_drift_pct       NUMERIC(6,2) DEFAULT 0,            -- % slower vs. shift start (positive = slower)
  late_deliveries_shift  INTEGER     NOT NULL DEFAULT 0,   -- deliveries past eta_latest
  late_rate_shift       NUMERIC(5,3) DEFAULT 0,            -- late / total (0–1)

  -- Computed score
  fatigue_score         SMALLINT     NOT NULL DEFAULT 0    CHECK (fatigue_score BETWEEN 0 AND 100),
  risk_level            TEXT         NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),

  UNIQUE (driver_id, snapshot_at)
);

CREATE INDEX IF NOT EXISTS idx_fatigue_loc_driver_time
  ON driver_fatigue_snapshots (location_id, driver_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_fatigue_loc_time
  ON driver_fatigue_snapshots (location_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_fatigue_risk_level
  ON driver_fatigue_snapshots (location_id, risk_level)
  WHERE risk_level IN ('high', 'critical');

-- ─── Table: fatigue alerts ────────────────────────────────────────────────────
-- One open alert per driver at a time (UNIQUE partial index on open alerts)

CREATE TABLE IF NOT EXISTS driver_fatigue_alerts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id      UUID        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  triggered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ,
  risk_level     TEXT        NOT NULL CHECK (risk_level IN ('medium','high','critical')),
  fatigue_score  SMALLINT    NOT NULL,
  trigger_reason TEXT        NOT NULL,    -- e.g. 'hours_exceeded|speed_drift|late_rate'
  action_taken   TEXT        NOT NULL DEFAULT 'none',  -- none | break_recommended | shift_ended | admin_notified
  notes          TEXT,
  snapshot_id    UUID REFERENCES driver_fatigue_snapshots(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fatigue_alerts_open_driver
  ON driver_fatigue_alerts (driver_id)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fatigue_alerts_loc_time
  ON driver_fatigue_alerts (location_id, triggered_at DESC);

-- ─── Views ───────────────────────────────────────────────────────────────────

-- Current fatigue state per driver (latest snapshot per driver, last 3h)
CREATE OR REPLACE VIEW v_driver_fatigue_current AS
SELECT DISTINCT ON (fs.driver_id)
  fs.id,
  fs.location_id,
  fs.driver_id,
  fs.snapshot_at,
  fs.hours_on_shift,
  fs.shift_deliveries,
  fs.deliveries_last_60min,
  fs.deliveries_last_30min,
  fs.avg_delivery_min_shift,
  fs.avg_delivery_min_last3,
  fs.last_delivery_ago_min,
  fs.longest_break_min,
  fs.break_count,
  fs.speed_drift_pct,
  fs.late_deliveries_shift,
  fs.late_rate_shift,
  fs.fatigue_score,
  fs.risk_level,
  d.name        AS driver_name,
  d.vehicle     AS driver_vehicle,
  d.state       AS driver_state,
  fa.id         AS open_alert_id,
  fa.triggered_at AS alert_triggered_at,
  fa.action_taken AS alert_action
FROM driver_fatigue_snapshots fs
JOIN mise_drivers d ON d.id = fs.driver_id
LEFT JOIN driver_fatigue_alerts fa
  ON fa.driver_id = fs.driver_id AND fa.resolved_at IS NULL
WHERE fs.snapshot_at > NOW() - INTERVAL '3 hours'
ORDER BY fs.driver_id, fs.snapshot_at DESC;

-- 24h fatigue trend per location (hourly buckets)
CREATE OR REPLACE VIEW v_fatigue_trend_24h AS
SELECT
  location_id,
  date_trunc('hour', snapshot_at)            AS hour_bucket,
  COUNT(*)                                   AS snapshot_count,
  ROUND(AVG(fatigue_score)::NUMERIC, 1)      AS avg_fatigue_score,
  MAX(fatigue_score)                         AS max_fatigue_score,
  COUNT(*) FILTER (WHERE risk_level = 'critical') AS critical_count,
  COUNT(*) FILTER (WHERE risk_level = 'high')     AS high_count,
  COUNT(*) FILTER (WHERE risk_level = 'medium')   AS medium_count
FROM driver_fatigue_snapshots
WHERE snapshot_at > NOW() - INTERVAL '24 hours'
GROUP BY location_id, date_trunc('hour', snapshot_at)
ORDER BY location_id, hour_bucket DESC;

-- Alert summary
CREATE OR REPLACE VIEW v_fatigue_alert_stats AS
SELECT
  location_id,
  COUNT(*)                                     FILTER (WHERE resolved_at IS NULL)                    AS open_count,
  COUNT(*)                                     FILTER (WHERE triggered_at > NOW() - INTERVAL '24h') AS alerts_24h,
  COUNT(*)                                     FILTER (WHERE triggered_at > NOW() - INTERVAL '7d')  AS alerts_7d,
  COUNT(*)                                     FILTER (WHERE risk_level = 'critical' AND resolved_at IS NULL) AS critical_open,
  COUNT(DISTINCT driver_id)                    FILTER (WHERE resolved_at IS NULL)                    AS drivers_at_risk,
  ROUND(AVG(fatigue_score)::NUMERIC, 1)        FILTER (WHERE resolved_at IS NULL)                    AS avg_open_score
FROM driver_fatigue_alerts
GROUP BY location_id;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE driver_fatigue_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_fatigue_alerts    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fatigue_snapshots_loc ON driver_fatigue_snapshots;
CREATE POLICY fatigue_snapshots_loc ON driver_fatigue_snapshots
  USING (location_id IN (
    SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS fatigue_alerts_loc ON driver_fatigue_alerts;
CREATE POLICY fatigue_alerts_loc ON driver_fatigue_alerts
  USING (location_id IN (
    SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
  ));

-- ─── Cleanup function ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_old_fatigue_snapshots(retain_days INTEGER DEFAULT 30)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE removed INTEGER;
BEGIN
  DELETE FROM driver_fatigue_snapshots
  WHERE snapshot_at < NOW() - (retain_days || ' days')::INTERVAL;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;
