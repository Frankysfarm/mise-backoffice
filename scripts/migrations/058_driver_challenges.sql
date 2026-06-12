-- 058_driver_challenges.sql
-- Driver Incentive Challenge Engine — Phase 97
--
-- Admins erstellen zeitbegrenzte Challenges für Fahrer
-- (z.B. "Ersten 5 Lieferungen vor 14 Uhr = €10 Bonus").
-- Fortschritt wird alle 5 Min per Cron aktualisiert.

-- ─── Challenge-Definitionen ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_challenges (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  description     TEXT,
  challenge_type  TEXT        NOT NULL
                  CHECK (challenge_type IN
                    ('deliveries_count','on_time_rate','avg_rating','revenue_total')),
  target_value    NUMERIC(10,2) NOT NULL,
  reward_eur      NUMERIC(8,2)  NOT NULL DEFAULT 0,
  reward_note     TEXT,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','active','completed','cancelled')),
  max_winners     INT         DEFAULT NULL,
  winner_count    INT         NOT NULL DEFAULT 0,
  created_by      UUID        REFERENCES employees(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Teilnahmen & Fortschritt ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_challenge_participations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id    UUID        NOT NULL REFERENCES driver_challenges(id) ON DELETE CASCADE,
  location_id     UUID        NOT NULL,
  driver_id       UUID        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  current_value   NUMERIC(10,2) NOT NULL DEFAULT 0,
  completed       BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  reward_paid     BOOLEAN     NOT NULL DEFAULT FALSE,
  reward_paid_at  TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id, driver_id)
);

-- ─── Leaderboard-View ─────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_challenge_leaderboard AS
SELECT
  dcp.id,
  dcp.challenge_id,
  dcp.driver_id,
  dcp.location_id,
  dcp.current_value,
  dcp.completed,
  dcp.completed_at,
  dcp.reward_paid,
  dcp.joined_at,
  dc.target_value,
  dc.reward_eur,
  dc.challenge_type,
  dc.title,
  dc.ends_at,
  dc.status  AS challenge_status,
  ROUND(
    (dcp.current_value / NULLIF(dc.target_value, 0) * 100)::NUMERIC,
    1
  )           AS progress_pct,
  RANK() OVER (
    PARTITION BY dcp.challenge_id
    ORDER BY dcp.current_value DESC
  )           AS rank
FROM  driver_challenge_participations dcp
JOIN  driver_challenges               dc  ON dc.id = dcp.challenge_id;

-- ─── Indizes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_driver_challenges_location
  ON driver_challenges (location_id);
CREATE INDEX IF NOT EXISTS idx_driver_challenges_status
  ON driver_challenges (status);
CREATE INDEX IF NOT EXISTS idx_driver_challenges_ends_at
  ON driver_challenges (ends_at);
CREATE INDEX IF NOT EXISTS idx_dcp_challenge
  ON driver_challenge_participations (challenge_id);
CREATE INDEX IF NOT EXISTS idx_dcp_driver
  ON driver_challenge_participations (driver_id);
CREATE INDEX IF NOT EXISTS idx_dcp_location_completed
  ON driver_challenge_participations (location_id, completed);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE driver_challenges              ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_challenge_participations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_challenges' AND policyname = 'service_role_challenges'
  ) THEN
    CREATE POLICY "service_role_challenges" ON driver_challenges
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_challenge_participations' AND policyname = 'service_role_dcp'
  ) THEN
    CREATE POLICY "service_role_dcp" ON driver_challenge_participations
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
