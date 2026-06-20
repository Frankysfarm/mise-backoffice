-- Phase 320: Delivery Analytics Dashboard
-- Tägliche aggregierte Lieferkennzahlen: Lieferrate, ø-Zeit, SLA, Top-Fahrer

CREATE TABLE IF NOT EXISTS delivery_analytics_snapshots (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id              uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  analytics_date           date        NOT NULL,
  total_orders             integer     NOT NULL DEFAULT 0,
  delivery_orders          integer     NOT NULL DEFAULT 0,
  completed_deliveries     integer     NOT NULL DEFAULT 0,
  cancelled_orders         integer     NOT NULL DEFAULT 0,
  delivery_rate            numeric(5,2),   -- completed_deliveries / delivery_orders × 100
  avg_delivery_min         numeric(6,2),   -- ø Minuten Abholung → Übergabe
  sla_total                integer     NOT NULL DEFAULT 0,   -- Bestellungen mit eta_latest
  sla_on_time              integer     NOT NULL DEFAULT 0,   -- davon pünktlich geliefert
  sla_compliance_pct       numeric(5,2),   -- sla_on_time / sla_total × 100
  cancellation_rate        numeric(5,2),   -- cancelled / total × 100
  total_revenue_eur        numeric(10,2),
  revenue_per_delivery_eur numeric(8,2),
  active_drivers           integer     NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id, analytics_date)
);

ALTER TABLE delivery_analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees read own location analytics" ON delivery_analytics_snapshots
  FOR SELECT USING (
    location_id IN (
      SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_das_loc_date
  ON delivery_analytics_snapshots (location_id, analytics_date DESC);

-- Cleanup RPC
CREATE OR REPLACE FUNCTION prune_delivery_analytics(days_old int DEFAULT 90)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted int;
BEGIN
  DELETE FROM delivery_analytics_snapshots
    WHERE analytics_date < (current_date - days_old);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
