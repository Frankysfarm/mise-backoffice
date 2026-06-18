-- Migration 111: Smart Delivery Benchmarking Engine
-- Daily multi-dimensional benchmark snapshot per location.
-- Combines quality_score + carbon + SLA + throughput into one composite rank.

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: delivery_benchmarks
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_benchmarks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bench_date            date NOT NULL DEFAULT CURRENT_DATE,

  -- Dimension scores (0–100)
  quality_score         numeric(5,2) NOT NULL DEFAULT 0, -- from delivery_quality_scores
  sla_score             numeric(5,2) NOT NULL DEFAULT 0, -- SLA on-time compliance
  carbon_score          numeric(5,2) NOT NULL DEFAULT 0, -- eco-efficiency (0=car-only, 100=full-eco)
  throughput_score      numeric(5,2) NOT NULL DEFAULT 0, -- orders per active driver-hour
  efficiency_score      numeric(5,2) NOT NULL DEFAULT 0, -- avg delivery time vs zone target

  -- Composite (GENERATED): 35% quality + 25% SLA + 20% throughput + 10% carbon + 10% efficiency
  overall_score         numeric(5,2) GENERATED ALWAYS AS (
    ROUND(
      quality_score    * 0.35 +
      sla_score        * 0.25 +
      throughput_score * 0.20 +
      carbon_score     * 0.10 +
      efficiency_score * 0.10,
      2
    )
  ) STORED,

  -- Grade (GENERATED)
  grade                 char(1) GENERATED ALWAYS AS (
    CASE
      WHEN (quality_score * 0.35 + sla_score * 0.25 + throughput_score * 0.20 + carbon_score * 0.10 + efficiency_score * 0.10) >= 90 THEN 'A'
      WHEN (quality_score * 0.35 + sla_score * 0.25 + throughput_score * 0.20 + carbon_score * 0.10 + efficiency_score * 0.10) >= 75 THEN 'B'
      WHEN (quality_score * 0.35 + sla_score * 0.25 + throughput_score * 0.20 + carbon_score * 0.10 + efficiency_score * 0.10) >= 60 THEN 'C'
      WHEN (quality_score * 0.35 + sla_score * 0.25 + throughput_score * 0.20 + carbon_score * 0.10 + efficiency_score * 0.10) >= 45 THEN 'D'
      ELSE 'F'
    END
  ) STORED,

  -- Raw metrics
  total_orders          int  NOT NULL DEFAULT 0,
  completed_deliveries  int  NOT NULL DEFAULT 0,
  on_time_deliveries    int  NOT NULL DEFAULT 0,
  avg_delivery_min      numeric(6,2),
  active_driver_hours   numeric(8,2),
  total_distance_km     numeric(10,2),
  eco_tour_pct          numeric(5,2),
  sla_breach_count      int  NOT NULL DEFAULT 0,

  -- Rank among all locations (filled by snapshotAllLocations)
  location_rank         int,
  total_locations       int,

  -- Weakest dimension for recommendations
  weakest_dimension     text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (location_id, bench_date)
);

CREATE INDEX IF NOT EXISTS idx_delivery_benchmarks_location_date
  ON delivery_benchmarks (location_id, bench_date DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_benchmarks_date_score
  ON delivery_benchmarks (bench_date DESC, overall_score DESC);

-- RLS
ALTER TABLE delivery_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON delivery_benchmarks
  FOR ALL TO service_role USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_delivery_benchmarks_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE OR REPLACE TRIGGER trg_delivery_benchmarks_ts
  BEFORE UPDATE ON delivery_benchmarks
  FOR EACH ROW EXECUTE FUNCTION update_delivery_benchmarks_ts();

-- ──────────────────────────────────────────────────────────────────────────────
-- VIEW: v_benchmark_ranking  (latest snapshot per location, with rank)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_benchmark_ranking AS
WITH latest AS (
  SELECT DISTINCT ON (location_id)
    db.*,
    t.name AS location_name
  FROM delivery_benchmarks db
  JOIN tenants t ON t.id = db.location_id
  ORDER BY location_id, bench_date DESC
)
SELECT
  *,
  RANK() OVER (ORDER BY overall_score DESC) AS live_rank,
  COUNT(*) OVER () AS live_total
FROM latest;

-- ──────────────────────────────────────────────────────────────────────────────
-- VIEW: v_benchmark_trend  (30 days per location)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_benchmark_trend AS
SELECT
  location_id,
  bench_date,
  overall_score,
  quality_score,
  sla_score,
  carbon_score,
  throughput_score,
  efficiency_score,
  grade,
  location_rank,
  total_locations,
  total_orders,
  avg_delivery_min
FROM delivery_benchmarks
WHERE bench_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY location_id, bench_date DESC;

-- ──────────────────────────────────────────────────────────────────────────────
-- FUNCTION: prune_old_benchmarks  (keep last N days)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_benchmarks(days_to_keep int DEFAULT 90)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted int;
BEGIN
  DELETE FROM delivery_benchmarks
  WHERE bench_date < CURRENT_DATE - (days_to_keep || ' days')::interval;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
