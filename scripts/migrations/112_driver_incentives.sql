-- Migration 112: Real-time Driver Incentive Engine (Phase 221)
-- Per-delivery incentives triggered by live conditions:
-- surge_multiplier, quality_bonus, shift_milestone, rush_hour_flat, comeback_bonus

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: driver_incentive_configs
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_incentive_configs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  incentive_type       text NOT NULL CHECK (incentive_type IN (
    'surge_multiplier',   -- extra % of liefergebuehr when surge is active
    'quality_bonus',      -- flat EUR per delivery when location quality score ≥ threshold
    'shift_milestone',    -- bonus after reaching N deliveries in current shift
    'rush_hour_flat',     -- flat EUR per delivery during peak hours
    'comeback_bonus'      -- flat EUR for first delivery after long offline period
  )),
  label                text NOT NULL,
  is_active            boolean NOT NULL DEFAULT true,

  -- surge_multiplier params
  extra_pct            numeric(5,2)  NOT NULL DEFAULT 0
    CHECK (extra_pct  >= 0 AND extra_pct  <= 500),

  -- quality_bonus params
  quality_score_min    numeric(5,2)  NOT NULL DEFAULT 70
    CHECK (quality_score_min >= 0 AND quality_score_min <= 100),
  flat_eur             numeric(6,2)  NOT NULL DEFAULT 0
    CHECK (flat_eur >= 0),

  -- shift_milestone params
  milestone_at         int NOT NULL DEFAULT 10
    CHECK (milestone_at >= 1),
  milestone_bonus_eur  numeric(6,2) NOT NULL DEFAULT 0
    CHECK (milestone_bonus_eur >= 0),

  -- rush_hour_flat params (UTC hour 0-23)
  rush_hour_start      int NOT NULL DEFAULT 11
    CHECK (rush_hour_start BETWEEN 0 AND 23),
  rush_hour_end        int NOT NULL DEFAULT 14
    CHECK (rush_hour_end BETWEEN 0 AND 23),

  -- comeback_bonus params
  min_offline_hours    int NOT NULL DEFAULT 8
    CHECK (min_offline_hours >= 1),
  comeback_bonus_eur   numeric(6,2) NOT NULL DEFAULT 0
    CHECK (comeback_bonus_eur >= 0),

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  UNIQUE (location_id, incentive_type)
);

CREATE INDEX IF NOT EXISTS idx_incentive_configs_location
  ON driver_incentive_configs (location_id);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION _set_incentive_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_incentive_config_updated ON driver_incentive_configs;
CREATE TRIGGER trg_incentive_config_updated
  BEFORE UPDATE ON driver_incentive_configs
  FOR EACH ROW EXECUTE FUNCTION _set_incentive_config_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- TABLE: driver_incentive_events
-- Per-delivery incentive earned (append-only log)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_incentive_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  driver_id            uuid NOT NULL,   -- mise_drivers.id
  order_id             uuid REFERENCES customer_orders(id) ON DELETE SET NULL,

  incentive_type       text NOT NULL,
  trigger_label        text NOT NULL,   -- human-readable reason
  base_value           numeric(8,2) NOT NULL DEFAULT 0, -- liefergebuehr for multiplier types
  bonus_eur            numeric(6,2) NOT NULL DEFAULT 0,
  shift_delivery_nr    int NOT NULL DEFAULT 1,  -- nth delivery in current shift

  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),

  earned_at            timestamptz NOT NULL DEFAULT now(),
  approved_at          timestamptz,

  -- prevent double-counting per order per incentive type
  UNIQUE (driver_id, order_id, incentive_type)
);

CREATE INDEX IF NOT EXISTS idx_incentive_events_driver_earned
  ON driver_incentive_events (driver_id, earned_at DESC);

CREATE INDEX IF NOT EXISTS idx_incentive_events_location_earned
  ON driver_incentive_events (location_id, earned_at DESC);

CREATE INDEX IF NOT EXISTS idx_incentive_events_status
  ON driver_incentive_events (status) WHERE status = 'pending';

-- RLS: service_role full access
ALTER TABLE driver_incentive_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_incentive_configs"
  ON driver_incentive_configs FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE driver_incentive_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_incentive_events"
  ON driver_incentive_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- VIEW: v_driver_incentive_today
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_driver_incentive_today AS
SELECT
  die.driver_id,
  md.name                                   AS driver_name,
  die.location_id,
  COALESCE(SUM(die.bonus_eur)
    FILTER (WHERE die.status IN ('pending','approved','paid')), 0) AS total_eur_today,
  COALESCE(SUM(die.bonus_eur)
    FILTER (WHERE die.status = 'pending'), 0)                     AS pending_eur,
  COALESCE(SUM(die.bonus_eur)
    FILTER (WHERE die.status IN ('approved','paid')), 0)          AS confirmed_eur,
  COUNT(*)
    FILTER (WHERE die.status IN ('pending','approved','paid'))    AS events_today
FROM driver_incentive_events die
LEFT JOIN mise_drivers md ON md.id = die.driver_id
WHERE die.earned_at >= CURRENT_DATE
GROUP BY die.driver_id, md.name, die.location_id;

-- ──────────────────────────────────────────────────────────────────────────────
-- VIEW: v_driver_incentive_leaderboard
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_driver_incentive_leaderboard AS
SELECT
  driver_id,
  driver_name,
  location_id,
  total_eur_today,
  confirmed_eur,
  events_today,
  RANK() OVER (PARTITION BY location_id ORDER BY total_eur_today DESC) AS rank
FROM v_driver_incentive_today
WHERE total_eur_today > 0;

-- ──────────────────────────────────────────────────────────────────────────────
-- FUNCTION: approve_pending_incentives
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION approve_pending_incentives(p_location_id uuid DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  updated_count int;
BEGIN
  IF p_location_id IS NOT NULL THEN
    UPDATE driver_incentive_events
    SET status = 'approved', approved_at = now()
    WHERE status = 'pending'
      AND location_id = p_location_id
      AND earned_at < now() - INTERVAL '5 minutes';
  ELSE
    UPDATE driver_incentive_events
    SET status = 'approved', approved_at = now()
    WHERE status = 'pending'
      AND earned_at < now() - INTERVAL '5 minutes';
  END IF;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- FUNCTION: prune_old_incentive_events
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_incentive_events(keep_days int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted int;
BEGIN
  DELETE FROM driver_incentive_events
  WHERE earned_at < now() - (keep_days || ' days')::interval;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
