-- Migration 189 — Phase 396 Backend: Executive KPI Snapshots
-- Aggregiert alle Schlüssel-KPIs je Standort + Tag für das Executive Dashboard.
-- Quellen: customer_orders, mise_drivers, delivery_performance, ops_health_snapshots,
--          schicht_roi_daily, driver_score_daily, driver_capacity_snapshots

-- ── Haupt-Snapshot-Tabelle ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS executive_kpi_snapshots (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID        NOT NULL,
  snapshot_date         DATE        NOT NULL,

  -- Umsatz & Bestellvolumen
  revenue_eur           NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_count        INTEGER     NOT NULL DEFAULT 0,
  avg_order_value_eur   NUMERIC(8,2),

  -- Lieferperformance
  avg_delivery_min      NUMERIC(6,1),
  on_time_pct           NUMERIC(5,1),
  cancelled_count       INTEGER     NOT NULL DEFAULT 0,
  cancellation_rate_pct NUMERIC(5,1),

  -- Fahrer
  active_driver_count   INTEGER     NOT NULL DEFAULT 0,
  online_driver_count   INTEGER     NOT NULL DEFAULT 0,
  orders_per_driver     NUMERIC(6,1),

  -- Ops-Health (aus ops_health_snapshots, täglicher Ø)
  avg_ops_health_score  NUMERIC(5,1),
  min_ops_health_score  NUMERIC(5,1),

  -- Schicht-ROI (aus schicht_roi_daily)
  net_margin_eur        NUMERIC(10,2),
  net_margin_pct        NUMERIC(5,1),
  cost_per_delivery_eur NUMERIC(8,2),
  revenue_per_driver_h  NUMERIC(8,2),

  -- Fahrer-Score (aus driver_score_daily, täglicher Ø)
  avg_driver_score      NUMERIC(5,1),
  drivers_grade_a_pct   NUMERIC(5,1),

  -- Kapazitäts-Status (letzter Snapshot des Tages)
  capacity_status       TEXT,  -- free/normal/busy/overloaded/unknown

  -- Metadaten
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (location_id, snapshot_date)
);

-- Index für Trend-Abfragen
CREATE INDEX IF NOT EXISTS idx_exec_kpi_location_date
  ON executive_kpi_snapshots (location_id, snapshot_date DESC);

-- RLS
ALTER TABLE executive_kpi_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'executive_kpi_snapshots' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON executive_kpi_snapshots
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'executive_kpi_snapshots' AND policyname = 'authenticated_read_own_location'
  ) THEN
    CREATE POLICY authenticated_read_own_location ON executive_kpi_snapshots
      FOR SELECT TO authenticated
      USING (
        location_id IN (
          SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- updated_at Trigger
CREATE OR REPLACE FUNCTION update_executive_kpi_snapshots_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_exec_kpi_updated_at ON executive_kpi_snapshots;
CREATE TRIGGER trg_exec_kpi_updated_at
  BEFORE UPDATE ON executive_kpi_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_executive_kpi_snapshots_updated_at();

-- ── Gap-Fill-Log: welche Standort/Datum-Kombinationen wurden nachgeholt ───────
CREATE TABLE IF NOT EXISTS schicht_roi_gap_fill_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID        NOT NULL,
  fill_date   DATE        NOT NULL,
  filled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_by TEXT       NOT NULL DEFAULT 'cron',
  UNIQUE (location_id, fill_date, triggered_by)
);

CREATE INDEX IF NOT EXISTS idx_roi_gap_fill_location_date
  ON schicht_roi_gap_fill_log (location_id, fill_date DESC);

ALTER TABLE schicht_roi_gap_fill_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'schicht_roi_gap_fill_log' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON schicht_roi_gap_fill_log
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Prune-Funktion für executive_kpi_snapshots ────────────────────────────────
CREATE OR REPLACE FUNCTION prune_executive_kpi_snapshots(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pruned INTEGER;
BEGIN
  DELETE FROM executive_kpi_snapshots
  WHERE snapshot_date < (CURRENT_DATE - days_to_keep);
  GET DIAGNOSTICS pruned = ROW_COUNT;
  RETURN pruned;
END;
$$;

-- ── 30-Tage-Trend-View ────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_executive_kpi_trend_30d AS
SELECT
  location_id,
  snapshot_date,
  revenue_eur,
  delivery_count,
  avg_delivery_min,
  on_time_pct,
  net_margin_pct,
  avg_ops_health_score,
  avg_driver_score,
  active_driver_count,
  capacity_status
FROM executive_kpi_snapshots
WHERE snapshot_date >= CURRENT_DATE - 30
ORDER BY location_id, snapshot_date DESC;
