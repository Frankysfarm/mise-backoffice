-- Migration 169: Tour Profit Snapshots
-- Persistente Tages-Snapshots für historische Gewinnanalyse pro Standort.
-- Aggregiert delivery_trip_costs täglich um 02:45 UTC via Cron.

-- ── Tages-Snapshots ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tour_profit_snapshots (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id               UUID          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  snapshot_date             DATE          NOT NULL,

  -- Volumina
  tours_completed           INTEGER       NOT NULL DEFAULT 0,
  deliveries_count          INTEGER       NOT NULL DEFAULT 0,
  total_distance_km         NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Finanzen
  total_revenue_eur         NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_cost_eur            NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_profit_eur          NUMERIC(10,2) NOT NULL DEFAULT 0,
  margin_pct                NUMERIC(6,2),

  -- Durchschnitte
  avg_profit_per_tour_eur   NUMERIC(10,2),
  avg_margin_pct            NUMERIC(6,2),
  avg_trip_duration_min     NUMERIC(8,2),

  -- Zonen-Aufschlüsselung (JSONB: { "A": { revenue, cost, profit, tours }, ... })
  zone_breakdown            JSONB         NOT NULL DEFAULT '{}',

  -- Fahrzeug-Aufschlüsselung (JSONB: { "bike": { revenue, cost, profit, tours }, ... })
  vehicle_breakdown         JSONB         NOT NULL DEFAULT '{}',

  -- Top-Fahrer nach Gewinn
  top_driver_id             UUID,
  top_driver_name           TEXT,
  top_driver_profit_eur     NUMERIC(10,2),
  top_driver_margin_pct     NUMERIC(6,2),

  created_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),

  UNIQUE(location_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_tps_location_date ON tour_profit_snapshots(location_id, snapshot_date DESC);

-- RLS
ALTER TABLE tour_profit_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svc_all_tps" ON tour_profit_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- updated_at Trigger
CREATE OR REPLACE FUNCTION set_updated_at_tps()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_tps_updated_at ON tour_profit_snapshots;
CREATE TRIGGER trg_tps_updated_at
  BEFORE UPDATE ON tour_profit_snapshots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_tps();

-- ── Prune-Funktion ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_tour_profit_snapshots(days_to_keep INTEGER DEFAULT 90)
RETURNS TABLE(pruned INTEGER) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE _pruned INTEGER;
BEGIN
  DELETE FROM tour_profit_snapshots
  WHERE snapshot_date < (CURRENT_DATE - days_to_keep);
  GET DIAGNOSTICS _pruned = ROW_COUNT;
  RETURN QUERY SELECT _pruned;
END;
$$;

-- ── 30-Tage-Trend-View ─────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_tour_profit_trend_30d AS
SELECT
  location_id,
  snapshot_date,
  tours_completed,
  deliveries_count,
  total_revenue_eur,
  total_cost_eur,
  total_profit_eur,
  margin_pct,
  avg_profit_per_tour_eur
FROM tour_profit_snapshots
WHERE snapshot_date >= CURRENT_DATE - 30
ORDER BY location_id, snapshot_date DESC;
