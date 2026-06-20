-- ============================================================
-- Phase 350 — Fahrer-Engagement-Engine (Gamification)
-- Punkte, Abzeichen, Rangliste, Wochen-Reset
-- ============================================================

-- Config je Standort
CREATE TABLE IF NOT EXISTS driver_engagement_config (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id            UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  is_enabled             BOOLEAN NOT NULL DEFAULT true,
  points_per_delivery    INT NOT NULL DEFAULT 10,
  points_per_on_time     INT NOT NULL DEFAULT 5,
  points_per_top_rating  INT NOT NULL DEFAULT 15,
  weekly_reset_day       INT NOT NULL DEFAULT 1,  -- 1=Montag (ISO)
  weekly_reset_hour_utc  INT NOT NULL DEFAULT 4,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT driver_engagement_config_location_uniq UNIQUE (location_id)
);

ALTER TABLE driver_engagement_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON driver_engagement_config USING (auth.role() = 'service_role');

CREATE TRIGGER driver_engagement_config_updated_at
  BEFORE UPDATE ON driver_engagement_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Punkte-Ledger
CREATE TABLE IF NOT EXISTS driver_engagement_points (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id   UUID NOT NULL,
  points      INT NOT NULL,
  reason      TEXT NOT NULL,  -- 'delivery'|'on_time'|'top_rating'|'badge_bonus'|'manual'|'weekly_reset'
  order_id    UUID REFERENCES customer_orders(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE driver_engagement_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON driver_engagement_points USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_dep_location_driver ON driver_engagement_points (location_id, driver_id);
CREATE INDEX IF NOT EXISTS idx_dep_location_created ON driver_engagement_points (location_id, created_at DESC);

-- Badge-Definitionen (pro Standort)
CREATE TABLE IF NOT EXISTS driver_engagement_badges (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT NOT NULL,
  icon                 TEXT NOT NULL DEFAULT 'medal',
  min_deliveries       INT,
  min_weekly_points    INT,
  min_streak           INT,
  min_on_time_rate_pct NUMERIC(5,2),
  bonus_points         INT NOT NULL DEFAULT 0,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE driver_engagement_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON driver_engagement_badges USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_deb_location ON driver_engagement_badges (location_id);

-- Verdiente Abzeichen pro Fahrer
CREATE TABLE IF NOT EXISTS driver_engagement_earned_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id   UUID NOT NULL,
  badge_id    UUID NOT NULL REFERENCES driver_engagement_badges(id) ON DELETE CASCADE,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT driver_earned_badge_uniq UNIQUE (driver_id, badge_id)
);

ALTER TABLE driver_engagement_earned_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON driver_engagement_earned_badges USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_deeb_location_driver ON driver_engagement_earned_badges (location_id, driver_id);

-- Wöchentliches Leaderboard-Snapshot
CREATE TABLE IF NOT EXISTS driver_engagement_leaderboard (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,
  driver_id       UUID NOT NULL,
  driver_name     TEXT,
  rank            INT NOT NULL,
  total_points    INT NOT NULL DEFAULT 0,
  deliveries      INT NOT NULL DEFAULT 0,
  on_time_rate    NUMERIC(5,2),
  badges_count    INT NOT NULL DEFAULT 0,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT driver_eng_leaderboard_uniq UNIQUE (location_id, week_start, driver_id)
);

ALTER TABLE driver_engagement_leaderboard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role only" ON driver_engagement_leaderboard USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_deel_location_week ON driver_engagement_leaderboard (location_id, week_start DESC);

-- Prune-Funktion
CREATE OR REPLACE FUNCTION prune_driver_engagement_points(days_old INT DEFAULT 90)
RETURNS TABLE(pruned BIGINT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pruned BIGINT;
BEGIN
  DELETE FROM driver_engagement_points
  WHERE created_at < (now() - (days_old || ' days')::INTERVAL)
    AND reason = 'weekly_reset';
  GET DIAGNOSTICS v_pruned = ROW_COUNT;
  RETURN QUERY SELECT v_pruned;
END;
$$;

CREATE OR REPLACE FUNCTION prune_driver_engagement_leaderboard(weeks_old INT DEFAULT 12)
RETURNS TABLE(pruned BIGINT) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pruned BIGINT;
BEGIN
  DELETE FROM driver_engagement_leaderboard
  WHERE week_start < (CURRENT_DATE - ((weeks_old * 7) || ' days')::INTERVAL)::DATE;
  GET DIAGNOSTICS v_pruned = ROW_COUNT;
  RETURN QUERY SELECT v_pruned;
END;
$$;

-- Seed: Standard-Abzeichen für alle Standorte (idempotent)
DO $$
DECLARE loc_id UUID;
BEGIN
  FOR loc_id IN SELECT id FROM locations LOOP
    INSERT INTO driver_engagement_badges
      (location_id, name, description, icon, min_deliveries, bonus_points)
    VALUES
      (loc_id, 'Starter', '10 Lieferungen abschließen', 'package', 10, 20),
      (loc_id, 'Routinier', '50 Lieferungen abschließen', 'truck', 50, 50),
      (loc_id, 'Profi', '200 Lieferungen abschließen', 'award', 200, 100),
      (loc_id, 'Legende', '500 Lieferungen abschließen', 'star', 500, 250)
    ON CONFLICT DO NOTHING;

    INSERT INTO driver_engagement_badges
      (location_id, name, description, icon, min_weekly_points, bonus_points)
    VALUES
      (loc_id, 'Punktesammler', '100 Punkte in einer Woche', 'zap', 100, 25),
      (loc_id, 'Highscorer', '300 Punkte in einer Woche', 'trophy', 300, 75)
    ON CONFLICT DO NOTHING;

    INSERT INTO driver_engagement_badges
      (location_id, name, description, icon, min_on_time_rate_pct, min_deliveries, bonus_points)
    VALUES
      (loc_id, 'Pünktlichkeits-Ass', '≥90% Pünktlichkeit bei ≥20 Lieferungen', 'clock', 90.0, 20, 50),
      (loc_id, 'Zuverlässigkeits-König', '≥95% Pünktlichkeit bei ≥50 Lieferungen', 'shield-check', 95.0, 50, 150)
    ON CONFLICT DO NOTHING;

    INSERT INTO driver_engagement_config (location_id)
    VALUES (loc_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;
