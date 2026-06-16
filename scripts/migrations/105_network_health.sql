-- Migration 105: Smart Delivery Network Health Engine
-- Phase 206
--
-- Speichert stündliche Snapshots des Gesamt-Netzwerk-Gesundheits-Scores (0–100)
-- aus 7 gewichteten Faktoren.

-- ── Haupt-Tabelle ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_network_snapshots (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 7 Faktoren
  f_on_time       NUMERIC(5,2) NOT NULL DEFAULT 0,      -- 0–25: On-Time-Rate 24 h
  f_satisfaction  NUMERIC(5,2) NOT NULL DEFAULT 0,      -- 0–20: Ø Kundenbewertung 7 Tage
  f_utilization   NUMERIC(5,2) NOT NULL DEFAULT 0,      -- 0–15: Fahrer-Auslastung
  f_dispatch      NUMERIC(5,2) NOT NULL DEFAULT 0,      -- 0–15: Dispatch-Wartezeit
  f_cancellation  NUMERIC(5,2) NOT NULL DEFAULT 0,      -- 0–10: inverse Stornierungsrate
  f_capacity      NUMERIC(5,2) NOT NULL DEFAULT 0,      -- 0–10: Supply vs. Demand-Balance
  f_profitability NUMERIC(5,2) NOT NULL DEFAULT 0,      -- 0–5:  Marge-Score

  -- Komposit-Score & Grade
  health_score    NUMERIC(5,2) NOT NULL DEFAULT 0,      -- 0–100
  grade           TEXT         NOT NULL DEFAULT 'fair'  -- excellent/good/fair/poor/critical
    CHECK (grade IN ('excellent','good','fair','poor','critical')),

  -- Rohdaten für Kontext
  on_time_rate_pct        NUMERIC(5,2),
  avg_rating              NUMERIC(4,2),
  driver_utilization_pct  NUMERIC(5,2),
  avg_dispatch_wait_min   NUMERIC(6,2),
  cancellation_rate_pct   NUMERIC(5,2),
  active_drivers          INTEGER,
  pending_orders          INTEGER,

  UNIQUE (location_id, captured_at)
);

ALTER TABLE delivery_network_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON delivery_network_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_dns_location_captured
  ON delivery_network_snapshots (location_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_dns_score
  ON delivery_network_snapshots (health_score);

-- ── VIEW: aktuellster Snapshot je Location (≤ 2 h alt) ───────────────────────
CREATE OR REPLACE VIEW v_network_health_current AS
SELECT DISTINCT ON (s.location_id)
  s.*,
  l.name AS location_name
FROM delivery_network_snapshots s
JOIN locations l ON l.id = s.location_id
WHERE s.captured_at >= NOW() - INTERVAL '2 hours'
ORDER BY s.location_id, s.captured_at DESC;

-- ── VIEW: 7-Tage-Stunden-Trend ────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_network_health_7d AS
SELECT
  location_id,
  date_trunc('hour', captured_at) AS hour,
  ROUND(AVG(health_score)::NUMERIC, 2)   AS avg_score,
  ROUND(AVG(f_on_time)::NUMERIC, 2)      AS avg_on_time,
  ROUND(AVG(f_satisfaction)::NUMERIC, 2) AS avg_satisfaction,
  ROUND(AVG(f_utilization)::NUMERIC, 2)  AS avg_utilization,
  ROUND(AVG(f_dispatch)::NUMERIC, 2)     AS avg_dispatch,
  ROUND(AVG(f_cancellation)::NUMERIC, 2) AS avg_cancellation,
  ROUND(AVG(f_capacity)::NUMERIC, 2)     AS avg_capacity,
  ROUND(AVG(f_profitability)::NUMERIC, 2) AS avg_profitability,
  COUNT(*) AS snapshot_count
FROM delivery_network_snapshots
WHERE captured_at >= NOW() - INTERVAL '7 days'
GROUP BY location_id, date_trunc('hour', captured_at)
ORDER BY location_id, hour;

-- ── Cleanup-Funktion ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_network_snapshots(older_than_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM delivery_network_snapshots
  WHERE captured_at < NOW() - (older_than_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
