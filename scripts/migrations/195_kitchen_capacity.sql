-- Migration 195: Kitchen Capacity Intelligence Engine — Phase 407
-- Echtzeit-Snapshot der Küchenkapazität + Circuit-Breaker-Tabelle

-- ── Echtzeit-Kapazitäts-Snapshots ────────────────────────────────────────────
-- Alle 2 Minuten: aktuelle Küchenlast, Überlast-Score, Status.
CREATE TABLE IF NOT EXISTS mise_kitchen_capacity_snapshots (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID         NOT NULL REFERENCES mise_locations(id) ON DELETE CASCADE,
  captured_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Aktuelle Orderzahlen
  active_orders       INTEGER      NOT NULL DEFAULT 0,  -- status: bestätigt | in_zubereitung
  ready_orders        INTEGER      NOT NULL DEFAULT 0,  -- status: fertig (wartet auf Fahrer)
  orders_last_hour    INTEGER      NOT NULL DEFAULT 0,  -- empfangen in letzten 60 Min

  -- Küchen-Timing-Metriken
  avg_prep_min        NUMERIC(6,2),                    -- Ø tatsächliche Prep-Zeit letzte Stunde
  max_prep_min        NUMERIC(6,2),                    -- Maximum Prep-Zeit letzte Stunde
  prep_overrun_count  INTEGER      NOT NULL DEFAULT 0,  -- Bestellungen > 1.5× Ø

  -- Kapazitäts-Berechnung
  capacity_pct        NUMERIC(6,2) NOT NULL DEFAULT 0, -- geschätzte Auslastung 0–100
  overload_score      NUMERIC(6,2) NOT NULL DEFAULT 0, -- Komposit-Überlast-Score 0–100

  -- Status
  status              TEXT         NOT NULL DEFAULT 'optimal',
                                  -- optimal | busy | overloaded | circuit_open
  circuit_active      BOOLEAN      NOT NULL DEFAULT false,

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Circuit-Breaker-Zustand ───────────────────────────────────────────────────
-- Max 1 Zeile pro Location (UNIQUE). Wird via UPSERT gesteuert.
CREATE TABLE IF NOT EXISTS mise_kitchen_circuit_breaker (
  id                        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id               UUID         NOT NULL REFERENCES mise_locations(id) ON DELETE CASCADE,
  is_active                 BOOLEAN      NOT NULL DEFAULT false,
  activated_at              TIMESTAMPTZ,
  activated_by              TEXT,                  -- 'auto' | 'admin:<name>'
  auto_deactivate_at        TIMESTAMPTZ,           -- Ablaufzeitpunkt (optional)
  deactivated_at            TIMESTAMPTZ,
  deactivation_reason       TEXT,
  reason                    TEXT,                  -- Begründung für Aktivierung
  consecutive_overload_ticks INTEGER     NOT NULL DEFAULT 0, -- Ø Ticks mit score ≥ 80
  total_activations         INTEGER      NOT NULL DEFAULT 0,
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (location_id)
);

-- ── Indizes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kitchen_capacity_snapshots_location_time
  ON mise_kitchen_capacity_snapshots(location_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_kitchen_capacity_snapshots_status
  ON mise_kitchen_capacity_snapshots(status, captured_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE mise_kitchen_capacity_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mise_kitchen_circuit_breaker     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_kitchen_capacity_snapshots" ON mise_kitchen_capacity_snapshots;
CREATE POLICY "anon_select_kitchen_capacity_snapshots"
  ON mise_kitchen_capacity_snapshots FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_all_kitchen_capacity_snapshots" ON mise_kitchen_capacity_snapshots;
CREATE POLICY "service_all_kitchen_capacity_snapshots"
  ON mise_kitchen_capacity_snapshots FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "anon_select_kitchen_circuit_breaker" ON mise_kitchen_circuit_breaker;
CREATE POLICY "anon_select_kitchen_circuit_breaker"
  ON mise_kitchen_circuit_breaker FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_all_kitchen_circuit_breaker" ON mise_kitchen_circuit_breaker;
CREATE POLICY "service_all_kitchen_circuit_breaker"
  ON mise_kitchen_circuit_breaker FOR ALL USING (auth.role() = 'service_role');

-- ── Prune-Funktion ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_kitchen_capacity_snapshots(days_old INTEGER DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE removed INTEGER;
BEGIN
  DELETE FROM mise_kitchen_capacity_snapshots
  WHERE captured_at < NOW() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

-- ── Aggregations-View (für Trend-Chart) ───────────────────────────────────────
CREATE OR REPLACE VIEW v_kitchen_capacity_hourly AS
SELECT
  location_id,
  date_trunc('hour', captured_at)       AS hour_bucket,
  AVG(active_orders)::NUMERIC(6,1)      AS avg_active_orders,
  AVG(ready_orders)::NUMERIC(6,1)       AS avg_ready_orders,
  AVG(capacity_pct)::NUMERIC(6,1)       AS avg_capacity_pct,
  AVG(overload_score)::NUMERIC(6,1)     AS avg_overload_score,
  MAX(overload_score)::NUMERIC(6,1)     AS max_overload_score,
  COUNT(*)                              AS snapshot_count,
  SUM(CASE WHEN status = 'overloaded' THEN 1 ELSE 0 END) AS overloaded_ticks,
  SUM(CASE WHEN circuit_active THEN 1 ELSE 0 END)        AS circuit_active_ticks
FROM mise_kitchen_capacity_snapshots
WHERE captured_at >= NOW() - INTERVAL '48 hours'
GROUP BY location_id, date_trunc('hour', captured_at)
ORDER BY location_id, hour_bucket DESC;
