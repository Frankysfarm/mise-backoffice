-- Migration 160: Driver Incentive Engine V2
-- Peak-Hour-Multiplikator + Treue-Streak-Multiplikator + Echtzeit-Punkte-Ledger
-- 2026-06-20

-- ── Konfiguration je Standort ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_incentive_v2_config (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid NOT NULL UNIQUE,
  enabled          bool NOT NULL DEFAULT true,
  -- Basisstruktur
  base_points_per_delivery int NOT NULL DEFAULT 10,
  -- Peak-Hour-Konfiguration
  peak_hours       int[] NOT NULL DEFAULT '{11,12,13,18,19,20}',
  peak_multiplier  numeric(4,2) NOT NULL DEFAULT 2.0,
  -- Loyalty-Streak
  loyalty_min_shifts   int NOT NULL DEFAULT 3,
  loyalty_multiplier   numeric(4,2) NOT NULL DEFAULT 1.5,
  -- Umrechnung
  points_to_eur_rate   numeric(8,4) NOT NULL DEFAULT 0.01, -- 100 Punkte = 1 EUR
  -- Auszahlung
  min_payout_points    int NOT NULL DEFAULT 500,
  auto_approve         bool NOT NULL DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Treue-Streaks (konsekutive Schichten) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_loyalty_streaks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid NOT NULL,
  driver_id        uuid NOT NULL,
  current_streak   int NOT NULL DEFAULT 0,
  longest_streak   int NOT NULL DEFAULT 0,
  last_shift_date  date,
  streak_broken_at timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, driver_id)
);

-- ── Punkte-Ledger (alle Earn-Events) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_incentive_v2_points (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL,
  driver_id       uuid NOT NULL,
  order_id        uuid,
  reason          text NOT NULL, -- 'peak_hour' | 'loyalty_streak' | 'base_delivery' | 'on_time_bonus'
  base_points     int NOT NULL DEFAULT 0,
  multiplier      numeric(4,2) NOT NULL DEFAULT 1.0,
  total_points    int NOT NULL DEFAULT 0,
  eur_equivalent  numeric(8,4) NOT NULL DEFAULT 0,
  peak_hour       bool NOT NULL DEFAULT false,
  streak_applied  bool NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','cancelled')),
  earned_at       timestamptz NOT NULL DEFAULT now(),
  approved_at     timestamptz,
  paid_at         timestamptz
);

-- ── Smart Reorder Notification Log ───────────────────────────────────────────
-- Protokolliert welche item_demand_alerts bereits gepusht wurden (Deduplizierung)
CREATE TABLE IF NOT EXISTS reorder_push_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  item_name   text NOT NULL,
  alert_level text NOT NULL,
  pushed_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, item_name, alert_level)
);

-- ── Indizes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_drv_incentive_v2_points_loc_driver
  ON driver_incentive_v2_points (location_id, driver_id, earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_drv_incentive_v2_points_order
  ON driver_incentive_v2_points (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drv_loyalty_streaks_driver
  ON driver_loyalty_streaks (driver_id);
CREATE INDEX IF NOT EXISTS idx_reorder_push_log_loc
  ON reorder_push_log (location_id, pushed_at DESC);

-- ── Trigger updated_at ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_drv_incentive_v2_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_drv_incentive_v2_config_updated_at ON driver_incentive_v2_config;
CREATE TRIGGER trg_drv_incentive_v2_config_updated_at
  BEFORE UPDATE ON driver_incentive_v2_config
  FOR EACH ROW EXECUTE FUNCTION set_drv_incentive_v2_config_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE driver_incentive_v2_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_loyalty_streaks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_incentive_v2_points   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reorder_push_log             ENABLE ROW LEVEL SECURITY;

-- Config: employees lesen eigene location, service_role schreibt
CREATE POLICY "employees_read_incentive_v2_config"
  ON driver_incentive_v2_config FOR SELECT
  USING (location_id IN (SELECT location_id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "service_role_all_incentive_v2_config"
  ON driver_incentive_v2_config FOR ALL
  USING (auth.role() = 'service_role');

-- Punkte: driver sieht eigene, service_role alles
CREATE POLICY "driver_read_own_points"
  ON driver_incentive_v2_points FOR SELECT
  USING (driver_id IN (SELECT id FROM mise_drivers WHERE auth_user_id = auth.uid()));
CREATE POLICY "service_role_all_points"
  ON driver_incentive_v2_points FOR ALL
  USING (auth.role() = 'service_role');

-- Streaks: driver sieht eigene, service_role alles
CREATE POLICY "driver_read_own_streaks"
  ON driver_loyalty_streaks FOR SELECT
  USING (driver_id IN (SELECT id FROM mise_drivers WHERE auth_user_id = auth.uid()));
CREATE POLICY "service_role_all_streaks"
  ON driver_loyalty_streaks FOR ALL
  USING (auth.role() = 'service_role');

-- Reorder push log: nur service_role
CREATE POLICY "service_role_all_reorder_push_log"
  ON reorder_push_log FOR ALL
  USING (auth.role() = 'service_role');

-- ── Prune RPC ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_driver_incentive_v2_points(days_old int DEFAULT 90)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM driver_incentive_v2_points
  WHERE earned_at < now() - (days_old || ' days')::interval
    AND status IN ('paid', 'cancelled');
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

CREATE OR REPLACE FUNCTION prune_reorder_push_log(days_old int DEFAULT 30)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM reorder_push_log WHERE pushed_at < now() - (days_old || ' days')::interval;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
