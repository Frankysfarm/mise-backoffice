-- ============================================================
-- Migration 139: Smart Batch Monitor
-- Phase 273 — Echtzeit-Batch-Gesundheits-Monitoring
--
-- Tabellen:
--   batch_health_snapshots  — stündliche Batch-Gesundheits-Snapshots
--
-- Views:
--   v_batch_health_latest   — neuester Snapshot je Location
--   v_stuck_batches         — aktive Batches ohne Fortschritt > 15 Min
--
-- Indizes, RLS, Trigger
-- ============================================================

-- ── Tabelle ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS batch_health_snapshots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  snapshot_at           timestamptz NOT NULL DEFAULT now(),

  -- Aktive Batch-Metriken
  active_batches        int  NOT NULL DEFAULT 0,
  stuck_batches         int  NOT NULL DEFAULT 0,   -- kein Fortschritt > 15 Min
  eta_breach_risk       int  NOT NULL DEFAULT 0,   -- Batches mit ETA-Überschreitungsrisiko
  avg_completion_pct    numeric(5,2),              -- Ø Abschluss-Prozent (stops completed / planned)
  avg_batch_age_min     numeric(6,1),              -- Ø Alter aktiver Batches in Minuten
  total_open_stops      int  NOT NULL DEFAULT 0,   -- Summe offener Stops
  total_done_stops      int  NOT NULL DEFAULT 0,   -- Summe abgeschlossener Stops

  -- Gesundheits-Score
  health_score          int  NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  -- warning wenn health_score < 70, critical wenn < 40
  health_status         text NOT NULL DEFAULT 'ok'
                         CHECK (health_status IN ('ok', 'warning', 'critical')),

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (location_id, snapshot_at)
);

CREATE INDEX IF NOT EXISTS idx_batch_health_snapshots_location_time
  ON batch_health_snapshots (location_id, snapshot_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE batch_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "batch_health_snapshots_location_access"
  ON batch_health_snapshots
  FOR ALL
  USING (
    location_id IN (
      SELECT e.location_id
      FROM employees e
      WHERE e.auth_user_id = auth.uid()
    )
  );

-- ── updated_at Trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _trg_batch_health_snapshots_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_batch_health_snapshots_updated_at ON batch_health_snapshots;
CREATE TRIGGER trg_batch_health_snapshots_updated_at
  BEFORE UPDATE ON batch_health_snapshots
  FOR EACH ROW EXECUTE FUNCTION _trg_batch_health_snapshots_updated_at();

-- ── Views ─────────────────────────────────────────────────────────────────────

-- Neuester Snapshot je Location
CREATE OR REPLACE VIEW v_batch_health_latest AS
SELECT DISTINCT ON (bhs.location_id)
  bhs.*,
  l.name AS location_name
FROM batch_health_snapshots bhs
JOIN locations l ON l.id = bhs.location_id
ORDER BY bhs.location_id, bhs.snapshot_at DESC;

-- Aktive Batches ohne Stop-Fortschritt seit > 15 Min
CREATE OR REPLACE VIEW v_stuck_batches AS
SELECT
  b.id AS batch_id,
  b.location_id,
  b.driver_id,
  b.state,
  b.created_at AS batch_started_at,
  EXTRACT(EPOCH FROM (now() - b.created_at)) / 60.0 AS age_min,
  COUNT(s.id) FILTER (WHERE s.state IN ('pending','arrived')) AS open_stops,
  COUNT(s.id) FILTER (WHERE s.state = 'delivered')            AS done_stops,
  MAX(s.completed_at) AS last_stop_completed_at,
  EXTRACT(EPOCH FROM (now() - MAX(s.completed_at))) / 60.0 AS min_since_last_stop
FROM mise_delivery_batches b
JOIN mise_batch_stops s ON s.batch_id = b.id
WHERE b.state NOT IN ('delivered','cancelled')
GROUP BY b.id, b.location_id, b.driver_id, b.state, b.created_at
HAVING (
  -- Batch älter als 15 Min UND kein Stop in den letzten 15 Min abgeschlossen
  EXTRACT(EPOCH FROM (now() - b.created_at)) / 60.0 > 15
  AND (
    MAX(s.completed_at) IS NULL
    OR EXTRACT(EPOCH FROM (now() - MAX(s.completed_at))) / 60.0 > 15
  )
  AND COUNT(s.id) FILTER (WHERE s.state IN ('pending','arrived')) > 0
);

-- ── Cleanup RPC ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_old_batch_health_snapshots(p_days int DEFAULT 14)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM batch_health_snapshots
  WHERE snapshot_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
