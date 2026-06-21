-- Migration 177: Tour Efficiency Daily — tägliche EUR/Stopp-Aggregation + Benchmark
-- Phase 362: Persistierbare Effizienz-Metriken für historisches Reporting

CREATE TABLE IF NOT EXISTS tour_efficiency_daily (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day_berlin      DATE NOT NULL,  -- Lokales Berliner Datum (Europe/Berlin)

  -- Effizienz-Kern-KPIs
  total_tours          INT NOT NULL DEFAULT 0,
  total_stops          INT NOT NULL DEFAULT 0,
  total_revenue_eur    NUMERIC(10,2) NOT NULL DEFAULT 0,
  revenue_per_stop_eur NUMERIC(8,4),  -- EUR/Stopp (revenue / stops)

  -- Benchmark-Werte (Perzentile über alle Fahrer des Tages)
  p25_rev_per_stop     NUMERIC(8,4),
  p50_rev_per_stop     NUMERIC(8,4),
  p75_rev_per_stop     NUMERIC(8,4),
  p90_rev_per_stop     NUMERIC(8,4),

  -- Fahrer-Breakdown
  driver_count         INT NOT NULL DEFAULT 0,
  avg_stops_per_driver NUMERIC(6,2),
  best_driver_id       UUID REFERENCES employees(id),
  best_driver_rev_per_stop NUMERIC(8,4),

  -- Timing-KPIs
  avg_delivery_min     NUMERIC(6,2),
  avg_bundle_size      NUMERIC(4,2),
  on_time_pct          NUMERIC(5,2),

  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (location_id, day_berlin)
);

CREATE INDEX IF NOT EXISTS idx_ted_location_day ON tour_efficiency_daily(location_id, day_berlin DESC);

-- Fahrer-Level-Tages-Detail (Benchmark-Grundlage)
CREATE TABLE IF NOT EXISTS tour_efficiency_driver_daily (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day_berlin      DATE NOT NULL,
  driver_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  tours_completed  INT NOT NULL DEFAULT 0,
  stops_completed  INT NOT NULL DEFAULT 0,
  revenue_eur      NUMERIC(10,2) NOT NULL DEFAULT 0,
  rev_per_stop_eur NUMERIC(8,4),
  avg_delivery_min NUMERIC(6,2),
  on_time_pct      NUMERIC(5,2),

  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (location_id, day_berlin, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_tedd_location_day ON tour_efficiency_driver_daily(location_id, day_berlin DESC);
CREATE INDEX IF NOT EXISTS idx_tedd_driver ON tour_efficiency_driver_daily(driver_id, day_berlin DESC);

-- RLS
ALTER TABLE tour_efficiency_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_ted" ON tour_efficiency_daily
  USING (location_id IN (
    SELECT l.id FROM locations l
    JOIN employees e ON e.tenant_id = l.tenant_id
    WHERE e.auth_user_id = auth.uid()
  ));

ALTER TABLE tour_efficiency_driver_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_tedd" ON tour_efficiency_driver_daily
  USING (location_id IN (
    SELECT l.id FROM locations l
    JOIN employees e ON e.tenant_id = l.tenant_id
    WHERE e.auth_user_id = auth.uid()
  ));

-- Prune-Funktionen
CREATE OR REPLACE FUNCTION prune_tour_efficiency_daily(days_old INT DEFAULT 365)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE deleted INT;
BEGIN
  DELETE FROM tour_efficiency_daily
  WHERE day_berlin < (CURRENT_DATE - days_old);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  DELETE FROM tour_efficiency_driver_daily
  WHERE day_berlin < (CURRENT_DATE - days_old);
  RETURN deleted;
END;
$$;
