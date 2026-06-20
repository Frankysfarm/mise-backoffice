-- Migration 157: Driver Weekly Ranking Engine
-- Wöchentliche Fahrer-Rankings mit persistenten Snapshots und automatischen Prämien-Triggern

-- ── Wöchentliche Ranking-Snapshots ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_weekly_rankings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  driver_id       uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  week_start      date NOT NULL,                    -- Montag der Woche (ISO)
  week_end        date NOT NULL,                    -- Sonntag der Woche
  rank            int  NOT NULL,
  composite_score numeric(5,2) NOT NULL DEFAULT 0,
  grade           text NOT NULL DEFAULT 'D',
  tours_completed int  NOT NULL DEFAULT 0,
  stops_completed int  NOT NULL DEFAULT 0,
  on_time_rate    numeric(4,3),                     -- 0.0–1.0
  avg_rating      numeric(3,2),
  total_earnings_eur numeric(10,2) NOT NULL DEFAULT 0,
  active_minutes  int  NOT NULL DEFAULT 0,
  km_total        numeric(10,2) NOT NULL DEFAULT 0,
  is_top3         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id, driver_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_driver_weekly_rankings_location_week
  ON driver_weekly_rankings(location_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_driver_weekly_rankings_driver
  ON driver_weekly_rankings(driver_id, week_start DESC);

-- ── Prämien-Konfiguration je Standort ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_ranking_reward_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  rank1_bonus_eur numeric(8,2) NOT NULL DEFAULT 20.00,
  rank2_bonus_eur numeric(8,2) NOT NULL DEFAULT 12.00,
  rank3_bonus_eur numeric(8,2) NOT NULL DEFAULT 7.00,
  min_tours_required int NOT NULL DEFAULT 5,        -- Mindest-Touren für Prämien-Berechtigung
  auto_approve    boolean NOT NULL DEFAULT false,    -- Automatisch ausbezahlen?
  notify_driver   boolean NOT NULL DEFAULT true,
  active          boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Prämien-Auslösungen ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_ranking_rewards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  driver_id       uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  ranking_id      uuid NOT NULL REFERENCES driver_weekly_rankings(id) ON DELETE CASCADE,
  week_start      date NOT NULL,
  rank            int  NOT NULL,
  bonus_eur       numeric(8,2) NOT NULL,
  status          text NOT NULL DEFAULT 'pending'   -- pending | approved | paid | rejected
                  CHECK (status IN ('pending','approved','paid','rejected')),
  auto_triggered  boolean NOT NULL DEFAULT false,
  admin_note      text,
  approved_by     uuid REFERENCES employees(id),
  approved_at     timestamptz,
  paid_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ranking_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_ranking_rewards_location_status
  ON driver_ranking_rewards(location_id, status, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_driver_ranking_rewards_driver
  ON driver_ranking_rewards(driver_id, week_start DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE driver_weekly_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_ranking_reward_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_ranking_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_driver_weekly_rankings"
  ON driver_weekly_rankings FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all_driver_ranking_reward_config"
  ON driver_ranking_reward_config FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all_driver_ranking_rewards"
  ON driver_ranking_rewards FOR ALL TO service_role USING (true);

-- ── Hilfsfunktion: Wochenbeginn (Montag) für ein Datum ─────────────────────
CREATE OR REPLACE FUNCTION week_start_for_date(d date)
RETURNS date AS $$
  SELECT d - EXTRACT(ISODOW FROM d)::int + 1;
$$ LANGUAGE SQL IMMUTABLE;

-- ── VIEW: Aktuelles Ranking (laufende Woche) ──────────────────────────────────
CREATE OR REPLACE VIEW v_current_week_rankings AS
SELECT
  r.*,
  e.name AS driver_name,
  UPPER(LEFT(REGEXP_REPLACE(e.name, '\s+', ' ', 'g'), 1)) ||
  COALESCE(UPPER(LEFT(SPLIT_PART(TRIM(e.name), ' ', 2), 1)), '') AS initials
FROM driver_weekly_rankings r
JOIN employees e ON e.id = r.driver_id
WHERE r.week_start = week_start_for_date(CURRENT_DATE);

-- ── VIEW: Offene Prämien ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_pending_ranking_rewards AS
SELECT
  rw.*,
  e.name AS driver_name,
  UPPER(LEFT(REGEXP_REPLACE(e.name, '\s+', ' ', 'g'), 1)) ||
  COALESCE(UPPER(LEFT(SPLIT_PART(TRIM(e.name), ' ', 2), 1)), '') AS initials
FROM driver_ranking_rewards rw
JOIN employees e ON e.id = rw.driver_id
WHERE rw.status = 'pending'
ORDER BY rw.week_start DESC, rw.rank ASC;

-- ── Cleanup-Funktion ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_rankings(retain_days int DEFAULT 90)
RETURNS int AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM driver_weekly_rankings
  WHERE week_start < CURRENT_DATE - retain_days;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;
