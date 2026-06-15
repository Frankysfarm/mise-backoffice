-- Migration 099: Fahrer-Incentive Streak-Tracking V2
-- Phase 194

-- Aktuelle Streak-Status pro Fahrer
CREATE TABLE IF NOT EXISTS driver_streaks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id             UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  current_streak        INT NOT NULL DEFAULT 0,     -- aktuelle Pünktlichkeits-Serie
  longest_streak        INT NOT NULL DEFAULT 0,     -- Allzeit-Rekord
  total_on_time         INT NOT NULL DEFAULT 0,     -- gesamt pünktliche Lieferungen
  total_deliveries      INT NOT NULL DEFAULT 0,     -- gesamt Lieferungen
  last_delivery_at      TIMESTAMPTZ,
  last_streak_reset_at  TIMESTAMPTZ,               -- wann letzter Break
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(driver_id)
);

-- Einzel-Events (jede Lieferung)
CREATE TABLE IF NOT EXISTS driver_streak_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL,
  driver_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  order_id        UUID NOT NULL,
  was_on_time     BOOLEAN NOT NULL,
  streak_before   INT NOT NULL DEFAULT 0,
  streak_after    INT NOT NULL DEFAULT 0,
  bonus_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00,  -- aktiver Multiplikator nach Lieferung
  milestone_hit   INT DEFAULT NULL,                     -- z.B. 5, 10, 20, 50 wenn Meilenstein erreicht
  delivered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Konfiguration: Multiplikatoren-Stufen und Meilenstein-Boni
CREATE TABLE IF NOT EXISTS driver_streak_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  -- Multiplikator-Schwellen (JSON: [{threshold: 5, multiplier: 1.10}, ...])
  multiplier_tiers    JSONB NOT NULL DEFAULT '[
    {"threshold": 5,  "multiplier": 1.10},
    {"threshold": 10, "multiplier": 1.25},
    {"threshold": 20, "multiplier": 1.40},
    {"threshold": 50, "multiplier": 1.60}
  ]'::jsonb,
  -- Meilenstein-Bonus (einmalig, EUR)
  milestone_bonus_eur JSONB NOT NULL DEFAULT '[
    {"milestone": 5,  "bonus_eur": 2.00},
    {"milestone": 10, "bonus_eur": 5.00},
    {"milestone": 20, "bonus_eur": 10.00},
    {"milestone": 50, "bonus_eur": 25.00}
  ]'::jsonb,
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id)
);

-- View: Fahrer-Leaderboard
CREATE OR REPLACE VIEW v_driver_streak_leaderboard AS
SELECT
  ds.location_id,
  ds.driver_id,
  e.name                                                   AS driver_name,
  ds.current_streak,
  ds.longest_streak,
  ds.total_on_time,
  ds.total_deliveries,
  CASE WHEN ds.total_deliveries > 0
    THEN ROUND(100.0 * ds.total_on_time / ds.total_deliveries, 1)
    ELSE 0
  END                                                      AS on_time_rate_pct,
  ds.last_delivery_at,
  ds.updated_at,
  RANK() OVER (PARTITION BY ds.location_id ORDER BY ds.current_streak DESC)  AS streak_rank,
  RANK() OVER (PARTITION BY ds.location_id ORDER BY ds.longest_streak DESC)  AS alltime_rank
FROM driver_streaks ds
JOIN employees e ON e.id = ds.driver_id;

-- View: Meilenstein-Übersicht (wann wurden Boni fällig)
CREATE OR REPLACE VIEW v_driver_streak_milestones AS
SELECT
  dse.location_id,
  dse.driver_id,
  e.name     AS driver_name,
  dse.milestone_hit,
  dse.streak_after,
  dse.delivered_at,
  dse.order_id
FROM driver_streak_events dse
JOIN employees e ON e.id = dse.driver_id
WHERE dse.milestone_hit IS NOT NULL
ORDER BY dse.delivered_at DESC;

-- Indizes
CREATE INDEX IF NOT EXISTS idx_driver_streaks_location ON driver_streaks(location_id, current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_driver_streak_events_driver ON driver_streak_events(driver_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_streak_events_location ON driver_streak_events(location_id, delivered_at DESC);

-- updated_at-Trigger
CREATE OR REPLACE FUNCTION update_driver_streaks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_driver_streaks_updated_at ON driver_streaks;
CREATE TRIGGER trg_driver_streaks_updated_at
  BEFORE UPDATE ON driver_streaks
  FOR EACH ROW EXECUTE FUNCTION update_driver_streaks_updated_at();

-- RLS
ALTER TABLE driver_streaks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_streak_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_streak_config  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full" ON driver_streaks       FOR ALL USING (true);
CREATE POLICY "service role full" ON driver_streak_events FOR ALL USING (true);
CREATE POLICY "service role full" ON driver_streak_config FOR ALL USING (true);
