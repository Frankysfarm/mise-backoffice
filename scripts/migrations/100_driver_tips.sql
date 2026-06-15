-- Migration 100: Smart Driver Tip Engine (Phase 198)
-- Trinkgeld-System: Kundenkonfiguration, Tages-Snapshots, Leaderboard-Views

-- ─── 1. tip_config — Konfiguration pro Location ───────────────────────────────
CREATE TABLE IF NOT EXISTS tip_config (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id     uuid        NOT NULL UNIQUE REFERENCES locations(id) ON DELETE CASCADE,
  is_enabled      boolean     NOT NULL DEFAULT true,
  suggestions_pct integer[]   NOT NULL DEFAULT ARRAY[5, 10, 15],
  custom_allowed  boolean     NOT NULL DEFAULT true,
  min_tip_eur     numeric(6,2) NOT NULL DEFAULT 0.50,
  max_tip_eur     numeric(6,2) NOT NULL DEFAULT 20.00,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. tip_eur Spalte auf customer_orders ────────────────────────────────────
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS tip_eur numeric(6,2) NOT NULL DEFAULT 0;

-- ─── 3. driver_tip_snapshots — Tages-Aggregat pro Fahrer ─────────────────────
CREATE TABLE IF NOT EXISTS driver_tip_snapshots (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id       uuid        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id     uuid        NOT NULL,
  snapshot_date   date        NOT NULL,
  tip_count       integer     NOT NULL DEFAULT 0,
  total_tip_eur   numeric(8,2) NOT NULL DEFAULT 0,
  avg_tip_eur     numeric(6,2) NOT NULL DEFAULT 0,
  max_tip_eur     numeric(6,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(driver_id, snapshot_date)
);

-- ─── 4. Indizes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tip_snapshots_location_date
  ON driver_tip_snapshots(location_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_tip_snapshots_driver_date
  ON driver_tip_snapshots(driver_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_customer_orders_tip
  ON customer_orders(location_id, mise_driver_id, tip_eur)
  WHERE tip_eur > 0;

-- ─── 5. View: Heutige Trinkgelder pro Fahrer (Echtzeit) ──────────────────────
CREATE OR REPLACE VIEW v_driver_tip_today AS
SELECT
  co.mise_driver_id                                           AS driver_id,
  co.location_id,
  COUNT(*)  FILTER (WHERE co.tip_eur > 0)                    AS tip_count,
  COALESCE(SUM(co.tip_eur), 0)                               AS total_tip_eur,
  COALESCE(AVG(co.tip_eur) FILTER (WHERE co.tip_eur > 0), 0) AS avg_tip_eur,
  COALESCE(MAX(co.tip_eur), 0)                               AS max_tip_eur
FROM customer_orders co
WHERE co.mise_driver_id IS NOT NULL
  AND co.tip_eur > 0
  AND co.created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
GROUP BY co.mise_driver_id, co.location_id;

-- ─── 6. View: Leaderboard (letzte 30 Tage, via Snapshots) ────────────────────
CREATE OR REPLACE VIEW v_driver_tip_leaderboard AS
SELECT
  dts.driver_id,
  dts.location_id,
  SUM(dts.tip_count)                                          AS total_tips,
  COALESCE(SUM(dts.total_tip_eur), 0)                        AS total_tip_eur,
  COALESCE(ROUND(AVG(dts.avg_tip_eur)::numeric, 2), 0)       AS avg_tip_eur,
  COALESCE(MAX(dts.max_tip_eur), 0)                          AS best_single_tip,
  COUNT(DISTINCT dts.snapshot_date)                           AS days_with_tips,
  RANK() OVER (
    PARTITION BY dts.location_id
    ORDER BY SUM(dts.total_tip_eur) DESC
  )                                                           AS rank
FROM driver_tip_snapshots dts
WHERE dts.snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY dts.driver_id, dts.location_id;

-- ─── 7. View: Location-weite Zusammenfassung (letzte 30 Tage) ────────────────
CREATE OR REPLACE VIEW v_location_tip_summary AS
SELECT
  location_id,
  COALESCE(SUM(tip_count), 0)                                AS total_tips_30d,
  COALESCE(SUM(total_tip_eur), 0)                            AS total_tip_eur_30d,
  COALESCE(ROUND(AVG(avg_tip_eur)::numeric, 2), 0)           AS avg_tip_eur_30d,
  COALESCE(MAX(max_tip_eur), 0)                              AS max_single_tip_30d,
  COUNT(DISTINCT driver_id)                                   AS drivers_with_tips
FROM driver_tip_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY location_id;

-- ─── 8. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE tip_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_tip_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_tip_config"     ON tip_config;
DROP POLICY IF EXISTS "service_role_tip_snapshots"  ON driver_tip_snapshots;

CREATE POLICY "service_role_tip_config"
  ON tip_config FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_tip_snapshots"
  ON driver_tip_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 9. updated_at Trigger für tip_config ─────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_tip_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tip_config_updated_at ON tip_config;
CREATE TRIGGER tip_config_updated_at
  BEFORE UPDATE ON tip_config
  FOR EACH ROW EXECUTE FUNCTION touch_tip_config_updated_at();
