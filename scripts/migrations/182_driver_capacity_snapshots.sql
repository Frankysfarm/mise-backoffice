-- Migration 182: Driver Capacity Snapshots + mise_locations.slug + delivery_performance RLS
--
-- 1. mise_locations.slug — idempotent ADD COLUMN (wird von public/avg-eta gebraucht)
-- 2. delivery_performance RLS — service_role + authenticated Policies
-- 3. driver_capacity_snapshots — Echtzeit-Kapazitäts-State je Standort (Supabase Realtime)
-- 4. driver_capacity_events — stündliche Trendhistorie
-- 5. Public anon-SELECT Policy auf driver_capacity_snapshots (für Frontend-Realtime-Subscription)

-- ============================================================
-- 1. mise_locations.slug
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mise_locations' AND column_name = 'slug'
  ) THEN
    ALTER TABLE mise_locations ADD COLUMN slug TEXT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mise_locations_slug
  ON mise_locations (slug)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN mise_locations.slug IS
  'URL-freundlicher Bezeichner (z.B. "ristorante-rossi-berlin"). Wird für public/avg-eta-Endpoint und Storefront-Routing genutzt.';

-- ============================================================
-- 2. delivery_performance — RLS aktivieren + Policies
-- ============================================================
ALTER TABLE delivery_performance ENABLE ROW LEVEL SECURITY;

-- service_role hat vollen Zugriff (schreibt via Trigger + Backend)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'delivery_performance' AND policyname = 'service_role full'
  ) THEN
    CREATE POLICY "service_role full" ON delivery_performance
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- authenticated: kann nur eigene Location lesen
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'delivery_performance' AND policyname = 'authenticated read own location'
  ) THEN
    CREATE POLICY "authenticated read own location" ON delivery_performance
      FOR SELECT TO authenticated
      USING (
        location_id IN (
          SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================
-- 3. driver_capacity_snapshots
--    Enthält den aktuellen Kapazitäts-State je Standort.
--    UNIQUE auf location_id → Upsert-Muster.
--    Supabase-Realtime-Subscription möglich (postgres_changes).
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_capacity_snapshots (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Fahrer
  online_drivers    SMALLINT    NOT NULL DEFAULT 0,   -- Fahrer aktuell online/aktiv
  total_drivers     SMALLINT    NOT NULL DEFAULT 0,   -- registrierte Fahrer an diesem Standort
  busy_drivers      SMALLINT    NOT NULL DEFAULT 0,   -- Fahrer mit aktivem Batch

  -- Bestellungen
  pending_orders    SMALLINT    NOT NULL DEFAULT 0,   -- unzugewiesene Bestellungen
  active_batches    SMALLINT    NOT NULL DEFAULT 0,   -- Batches im Status on_route/en_route

  -- Berechnete KPIs
  load_pct          NUMERIC(5,2),                     -- busy_drivers / max(online_drivers,1) × 100
  orders_per_driver NUMERIC(5,2),                     -- pending_orders / max(online_drivers,1)

  -- Kapazitäts-Status
  capacity_status   TEXT        NOT NULL DEFAULT 'unknown'
    CHECK (capacity_status IN ('free', 'normal', 'busy', 'overloaded', 'unknown')),

  snapshot_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (location_id)
);

CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_location
  ON driver_capacity_snapshots (location_id);

CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_status
  ON driver_capacity_snapshots (capacity_status, snapshot_at DESC);

COMMENT ON TABLE driver_capacity_snapshots IS
  'Echtzeit-Kapazitäts-Snapshot je Standort. Wird alle 2 Minuten vom Cron aktualisiert. Frontend kann via Supabase postgres_changes subscriben (Realtime-Alternative zu 60s-Polling).';

-- RLS
ALTER TABLE driver_capacity_snapshots ENABLE ROW LEVEL SECURITY;

-- service_role: voller Zugriff (Cron schreibt)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_capacity_snapshots' AND policyname = 'service_role full'
  ) THEN
    CREATE POLICY "service_role full" ON driver_capacity_snapshots
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- anon: darf lesen (für Storefront-Realtime-Kapazitätsanzeige)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_capacity_snapshots' AND policyname = 'anon read'
  ) THEN
    CREATE POLICY "anon read" ON driver_capacity_snapshots
      FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- authenticated: kann alle Locations lesen (für Admin-Dashboards)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_capacity_snapshots' AND policyname = 'authenticated read'
  ) THEN
    CREATE POLICY "authenticated read" ON driver_capacity_snapshots
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ============================================================
-- 4. driver_capacity_events — stündliche Trendhistorie
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_capacity_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Snapshot-Werte zum Ereigniszeitpunkt
  online_drivers    SMALLINT    NOT NULL DEFAULT 0,
  pending_orders    SMALLINT    NOT NULL DEFAULT 0,
  active_batches    SMALLINT    NOT NULL DEFAULT 0,
  load_pct          NUMERIC(5,2),
  capacity_status   TEXT        NOT NULL DEFAULT 'unknown',

  -- Metadaten
  event_hour        SMALLINT    NOT NULL, -- 0–23 (Berliner Lokalzeit)
  event_date        DATE        NOT NULL,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capacity_events_location_date
  ON driver_capacity_events (location_id, event_date DESC, event_hour);

CREATE INDEX IF NOT EXISTS idx_capacity_events_recorded
  ON driver_capacity_events (recorded_at DESC);

COMMENT ON TABLE driver_capacity_events IS
  'Stündliche Kapazitäts-Historik für Trendanalysen. Wird vom Cron nach jeder Snapshot-Berechnung appended.';

ALTER TABLE driver_capacity_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_capacity_events' AND policyname = 'service_role full'
  ) THEN
    CREATE POLICY "service_role full" ON driver_capacity_events
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_capacity_events' AND policyname = 'authenticated read own location'
  ) THEN
    CREATE POLICY "authenticated read own location" ON driver_capacity_events
      FOR SELECT TO authenticated
      USING (
        location_id IN (
          SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================
-- 5. Prune-RPC für driver_capacity_events
-- ============================================================
CREATE OR REPLACE FUNCTION prune_driver_capacity_events(days_to_keep INTEGER DEFAULT 14)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pruned INTEGER;
BEGIN
  DELETE FROM driver_capacity_events
  WHERE event_date < CURRENT_DATE - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS pruned = ROW_COUNT;
  RETURN pruned;
END; $$;

-- ============================================================
-- 6. View: Kapazitäts-Trend letzte 48h (alle Standorte)
-- ============================================================
CREATE OR REPLACE VIEW v_capacity_trend_48h AS
SELECT
  location_id,
  event_date,
  event_hour,
  AVG(online_drivers)::NUMERIC(5,1)  AS avg_online_drivers,
  AVG(pending_orders)::NUMERIC(5,1)  AS avg_pending_orders,
  AVG(load_pct)::NUMERIC(5,2)        AS avg_load_pct,
  MODE() WITHIN GROUP (ORDER BY capacity_status) AS dominant_status,
  COUNT(*)                            AS sample_count
FROM driver_capacity_events
WHERE recorded_at >= NOW() - INTERVAL '48 hours'
GROUP BY location_id, event_date, event_hour
ORDER BY location_id, event_date DESC, event_hour;
