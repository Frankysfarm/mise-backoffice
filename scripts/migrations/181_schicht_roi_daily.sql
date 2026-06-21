-- Migration 181: Schicht-ROI Tages-Snapshots
-- Persistiert täglich aggregierte ROI-Kennzahlen je Standort
-- für Trend-Analyse im Lieferdienst-Dashboard.

CREATE TABLE IF NOT EXISTS schicht_roi_daily (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id               UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  snapshot_date             DATE        NOT NULL,

  -- Umsatz
  revenue_eur               NUMERIC(10,2) NOT NULL DEFAULT 0,   -- Lieferumsatz (gesamtbetrag)
  delivery_fee_eur          NUMERIC(10,2) NOT NULL DEFAULT 0,   -- davon Liefergebühren
  delivery_count            INTEGER       NOT NULL DEFAULT 0,   -- abgeschlossene Lieferbestellungen
  avg_order_value_eur       NUMERIC(8,2),                       -- Ø Bestellwert

  -- Fahrereinsatz
  active_driver_count       INTEGER       NOT NULL DEFAULT 0,   -- Fahrer mit Schicht
  active_driver_hours       NUMERIC(8,2)  NOT NULL DEFAULT 0,   -- Summe geplante Fahrerstunden

  -- Kosten (geschätzt aus driver_shifts.base_wage_eur × Schichtlänge)
  estimated_cost_eur        NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Berechnete KPIs
  revenue_per_driver_hour   NUMERIC(8,2),   -- revenue_eur / active_driver_hours
  cost_per_delivery         NUMERIC(8,2),   -- estimated_cost_eur / delivery_count
  net_margin_eur            NUMERIC(10,2),  -- revenue_eur - estimated_cost_eur
  net_margin_pct            NUMERIC(5,2),   -- net_margin_eur / revenue_eur * 100

  -- Peak-Stunde (Berliner Zeit, 0–23)
  peak_hour                 SMALLINT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (location_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_schicht_roi_daily_loc_date
  ON schicht_roi_daily (location_id, snapshot_date DESC);

-- RLS: nur service_role schreibt
ALTER TABLE schicht_roi_daily ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='schicht_roi_daily' AND policyname='service_role full'
  ) THEN
    CREATE POLICY "service_role full" ON schicht_roi_daily
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- authenticated: kann eigene Location lesen
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='schicht_roi_daily' AND policyname='authenticated read own location'
  ) THEN
    CREATE POLICY "authenticated read own location" ON schicht_roi_daily
      FOR SELECT TO authenticated
      USING (
        location_id IN (
          SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- updated_at Trigger
CREATE OR REPLACE FUNCTION trg_schicht_roi_daily_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_schicht_roi_daily_updated_at ON schicht_roi_daily;
CREATE TRIGGER trg_schicht_roi_daily_updated_at
  BEFORE UPDATE ON schicht_roi_daily
  FOR EACH ROW EXECUTE PROCEDURE trg_schicht_roi_daily_updated_at();

-- Prune-RPC
CREATE OR REPLACE FUNCTION prune_schicht_roi_daily(days_to_keep INTEGER DEFAULT 180)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pruned INTEGER;
BEGIN
  DELETE FROM schicht_roi_daily
  WHERE snapshot_date < CURRENT_DATE - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS pruned = ROW_COUNT;
  RETURN pruned;
END; $$;

-- View: 30-Tage-Trend aller Standorte (für schnelle Dashboard-Abfragen)
CREATE OR REPLACE VIEW v_schicht_roi_trend_30d AS
SELECT
  location_id,
  snapshot_date,
  revenue_eur,
  delivery_fee_eur,
  delivery_count,
  active_driver_count,
  active_driver_hours,
  estimated_cost_eur,
  revenue_per_driver_hour,
  cost_per_delivery,
  net_margin_eur,
  net_margin_pct,
  peak_hour
FROM schicht_roi_daily
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY location_id, snapshot_date DESC;
