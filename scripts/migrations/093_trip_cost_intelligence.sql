-- Phase 183: Smart Trip Cost Intelligence Engine
-- Per-batch cost & margin analytics: driver time + fuel + packaging vs. delivery fee revenue

-- ── Cost configuration per location ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS delivery_cost_config (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id             UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Driver hourly rate (gross, includes employer costs)
  cost_driver_hourly_eur  NUMERIC(8,2) NOT NULL DEFAULT 12.00,

  -- Per-km fuel/wear cost by vehicle type
  cost_per_km_bicycle_eur NUMERIC(6,4) NOT NULL DEFAULT 0.00,
  cost_per_km_ebike_eur   NUMERIC(6,4) NOT NULL DEFAULT 0.05,
  cost_per_km_scooter_eur NUMERIC(6,4) NOT NULL DEFAULT 0.18,
  cost_per_km_moped_eur   NUMERIC(6,4) NOT NULL DEFAULT 0.18,
  cost_per_km_car_eur     NUMERIC(6,4) NOT NULL DEFAULT 0.30,

  -- Fixed costs per delivery stop
  cost_packaging_eur      NUMERIC(6,4) NOT NULL DEFAULT 0.50,
  cost_insurance_per_del  NUMERIC(6,4) NOT NULL DEFAULT 0.20,

  -- Platform cut (% of delivery fee, 0 for own fleet)
  platform_fee_pct        NUMERIC(5,2) NOT NULL DEFAULT 0.00,

  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(location_id)
);

CREATE OR REPLACE FUNCTION trg_cost_config_upd() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_cost_config_updated ON delivery_cost_config;
CREATE TRIGGER trg_cost_config_updated
  BEFORE UPDATE ON delivery_cost_config
  FOR EACH ROW EXECUTE FUNCTION trg_cost_config_upd();

ALTER TABLE delivery_cost_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svc_all_dcc" ON delivery_cost_config FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Per-batch trip cost record ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS delivery_trip_costs (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              UUID         NOT NULL REFERENCES mise_delivery_batches(id) ON DELETE CASCADE,
  location_id           UUID         NOT NULL,
  driver_id             UUID,

  -- Timing
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  trip_duration_min     NUMERIC(8,2),

  -- Distance & stops
  total_distance_km     NUMERIC(8,3) NOT NULL DEFAULT 0,
  stops_count           INT          NOT NULL DEFAULT 0,

  -- Cost components (EUR)
  cost_driver_time_eur  NUMERIC(8,2) NOT NULL DEFAULT 0,
  cost_fuel_km_eur      NUMERIC(8,2) NOT NULL DEFAULT 0,
  cost_packaging_eur    NUMERIC(8,2) NOT NULL DEFAULT 0,
  cost_insurance_eur    NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_cost_eur        NUMERIC(8,2) NOT NULL DEFAULT 0,

  -- Revenue
  delivery_fees_eur     NUMERIC(8,2) NOT NULL DEFAULT 0,
  platform_fees_eur     NUMERIC(8,2) NOT NULL DEFAULT 0,
  net_revenue_eur       NUMERIC(8,2) NOT NULL DEFAULT 0,

  -- Margin (revenue - cost)
  gross_margin_eur      NUMERIC(8,2) NOT NULL DEFAULT 0,
  margin_pct            NUMERIC(6,2),

  -- Vehicle type used
  vehicle_type          TEXT,

  computed_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id)
);

CREATE INDEX IF NOT EXISTS idx_dtc_location_date   ON delivery_trip_costs(location_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_dtc_driver          ON delivery_trip_costs(driver_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_dtc_margin          ON delivery_trip_costs(location_id, margin_pct NULLS LAST);

ALTER TABLE delivery_trip_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svc_all_dtc" ON delivery_trip_costs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Daily aggregate view ─────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_trip_cost_daily AS
SELECT
  location_id,
  DATE(computed_at AT TIME ZONE 'UTC')         AS snapshot_date,
  COUNT(*)                                      AS trips_count,
  SUM(stops_count)                              AS deliveries_count,
  ROUND(SUM(total_distance_km)::NUMERIC, 1)    AS total_distance_km,
  ROUND(SUM(total_cost_eur)::NUMERIC, 2)       AS total_cost_eur,
  ROUND(SUM(delivery_fees_eur)::NUMERIC, 2)    AS total_fees_eur,
  ROUND(SUM(net_revenue_eur)::NUMERIC, 2)      AS total_revenue_eur,
  ROUND(SUM(gross_margin_eur)::NUMERIC, 2)     AS total_margin_eur,
  ROUND(AVG(trip_duration_min)::NUMERIC, 1)    AS avg_trip_min,
  ROUND(AVG(total_distance_km)::NUMERIC, 2)    AS avg_distance_km,
  ROUND(AVG(gross_margin_eur)::NUMERIC, 2)     AS avg_margin_eur,
  ROUND(
    (SUM(gross_margin_eur) / NULLIF(SUM(net_revenue_eur), 0) * 100)::NUMERIC, 1
  )                                             AS margin_pct,
  SUM(CASE WHEN gross_margin_eur < 0 THEN 1 ELSE 0 END) AS loss_trips
FROM delivery_trip_costs
GROUP BY location_id, DATE(computed_at AT TIME ZONE 'UTC');

-- ── 30-day rolling summary view ──────────────────────────────────────────────

CREATE OR REPLACE VIEW v_trip_cost_summary_30d AS
SELECT
  location_id,
  COUNT(*)                                                              AS trips_count,
  SUM(stops_count)                                                      AS deliveries_count,
  ROUND(SUM(total_distance_km)::NUMERIC, 1)                            AS total_distance_km,
  ROUND(SUM(cost_driver_time_eur)::NUMERIC, 2)                         AS cost_driver_total,
  ROUND(SUM(cost_fuel_km_eur)::NUMERIC, 2)                             AS cost_fuel_total,
  ROUND(SUM(cost_packaging_eur)::NUMERIC, 2)                           AS cost_packaging_total,
  ROUND(SUM(cost_insurance_eur)::NUMERIC, 2)                           AS cost_insurance_total,
  ROUND(SUM(total_cost_eur)::NUMERIC, 2)                               AS total_cost_eur,
  ROUND(SUM(delivery_fees_eur)::NUMERIC, 2)                            AS total_fees_eur,
  ROUND(SUM(net_revenue_eur)::NUMERIC, 2)                              AS total_revenue_eur,
  ROUND(SUM(gross_margin_eur)::NUMERIC, 2)                             AS total_margin_eur,
  ROUND(AVG(gross_margin_eur)::NUMERIC, 2)                             AS avg_margin_per_trip,
  ROUND(
    (SUM(gross_margin_eur) / NULLIF(SUM(net_revenue_eur), 0) * 100)::NUMERIC, 1
  )                                                                     AS overall_margin_pct,
  SUM(CASE WHEN gross_margin_eur < 0 THEN 1 ELSE 0 END)               AS loss_trips,
  ROUND(
    (SUM(CASE WHEN gross_margin_eur < 0 THEN 1 ELSE 0 END)::FLOAT
     / NULLIF(COUNT(*), 0) * 100)::NUMERIC, 1
  )                                                                     AS loss_trip_pct
FROM delivery_trip_costs
WHERE computed_at >= NOW() - INTERVAL '30 days'
GROUP BY location_id;
