-- 106_capacity_planner.sql
-- Phase 207: Predictive Capacity Planner
-- 7-day driver capacity predictions based on demand forecasts + scheduled shifts

CREATE TABLE IF NOT EXISTS capacity_plan_slots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  slot_date             date NOT NULL,
  hour_of_day           smallint NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  weekday               smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  expected_orders       integer NOT NULL DEFAULT 0,
  recommended_drivers   integer NOT NULL DEFAULT 1,
  scheduled_drivers     integer NOT NULL DEFAULT 0,
  coverage_gap          integer GENERATED ALWAYS AS (GREATEST(0, recommended_drivers - scheduled_drivers)) STORED,
  is_overstaffed        boolean GENERATED ALWAYS AS (scheduled_drivers > recommended_drivers + 1) STORED,
  is_peak               boolean NOT NULL DEFAULT false,
  confidence_pct        integer NOT NULL DEFAULT 70 CHECK (confidence_pct BETWEEN 0 AND 100),
  demand_source         text NOT NULL DEFAULT 'forecast'
    CONSTRAINT chk_demand_source CHECK (demand_source IN ('forecast', 'historical', 'manual')),
  generated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_capacity_plan_slot
  ON capacity_plan_slots (location_id, slot_date, hour_of_day);

CREATE INDEX IF NOT EXISTS idx_capacity_plan_date
  ON capacity_plan_slots (location_id, slot_date);

CREATE INDEX IF NOT EXISTS idx_capacity_plan_gaps
  ON capacity_plan_slots (location_id, slot_date, hour_of_day)
  WHERE coverage_gap > 0;

ALTER TABLE capacity_plan_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_capacity_plan" ON capacity_plan_slots;
CREATE POLICY "service_role_capacity_plan" ON capacity_plan_slots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- View: next 7 days (for weekly grid)
CREATE OR REPLACE VIEW v_capacity_week_ahead AS
SELECT cps.*
FROM capacity_plan_slots cps
WHERE cps.slot_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '6 days')::date;

-- View: upcoming coverage gaps today (from current hour)
CREATE OR REPLACE VIEW v_capacity_gaps_24h AS
SELECT cps.*
FROM capacity_plan_slots cps
WHERE
  cps.slot_date = CURRENT_DATE
  AND cps.coverage_gap > 0
  AND cps.hour_of_day >= EXTRACT(HOUR FROM NOW() AT TIME ZONE 'UTC')::smallint
ORDER BY cps.hour_of_day;

-- Cleanup function
CREATE OR REPLACE FUNCTION prune_old_capacity_slots(days_to_keep integer DEFAULT 14)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE deleted integer;
BEGIN
  DELETE FROM capacity_plan_slots WHERE slot_date < CURRENT_DATE - (days_to_keep || ' days')::interval;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
