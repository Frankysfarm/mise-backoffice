-- Migration 037: Kitchen-Queue-Signal & Storefront-Wartezeit
--
-- Schließt die Feedback-Schleife zwischen Küchenauslastung und Storefront:
-- Wenn die Küche überlastet ist, können Kunden eine ehrliche Wartezeit sehen.
-- Operatoren können den Status manuell überschreiben oder pausieren.
--
-- Tabellen:
--   location_queue_signals  — aktueller Zustand pro Location (1 Zeile pro Location)
--   queue_signal_history    — Append-only History-Log aller Zustandsänderungen
-- Views:
--   v_queue_signal_status   — aktuelle Signale mit Location-Name

-- ============================================================
-- location_queue_signals
-- ============================================================

CREATE TABLE IF NOT EXISTS location_queue_signals (
  location_id         UUID PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  signal_type         TEXT NOT NULL DEFAULT 'normal'
    CHECK (signal_type IN ('normal', 'extended', 'paused')),
  eta_extension_min   INTEGER NOT NULL DEFAULT 0
    CHECK (eta_extension_min >= 0 AND eta_extension_min <= 120),
  message_de          TEXT CHECK (char_length(message_de) <= 200),
  auto_triggered      BOOLEAN NOT NULL DEFAULT false,
  trigger_source      TEXT,             -- 'kitchen_queue' | 'manual' | 'cron'
  queue_depth         INTEGER,          -- Snapshot zum Auslösezeitpunkt
  created_by          UUID,             -- auth.users.id des Admin-Users (wenn manuell)
  expires_at          TIMESTAMPTZ,      -- optionales Auto-Ablaufen
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- queue_signal_history
-- ============================================================

CREATE TABLE IF NOT EXISTS queue_signal_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID NOT NULL,
  signal_type         TEXT NOT NULL,
  eta_extension_min   INTEGER NOT NULL DEFAULT 0,
  message_de          TEXT,
  auto_triggered      BOOLEAN NOT NULL DEFAULT false,
  queue_depth         INTEGER,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- View: aktuelle Signale mit Location-Name
-- ============================================================

CREATE OR REPLACE VIEW v_queue_signal_status AS
SELECT
  s.location_id,
  s.signal_type,
  s.eta_extension_min,
  s.message_de,
  s.auto_triggered,
  s.trigger_source,
  s.queue_depth,
  s.expires_at,
  s.updated_at,
  l.name AS location_name
FROM location_queue_signals s
JOIN locations l ON l.id = s.location_id;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE location_queue_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_signal_history   ENABLE ROW LEVEL SECURITY;

-- service_role: alle Operationen
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'location_queue_signals'
      AND policyname = 'service_role_all_queue_signals'
  ) THEN
    CREATE POLICY service_role_all_queue_signals
      ON location_queue_signals FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'queue_signal_history'
      AND policyname = 'service_role_all_queue_signal_history'
  ) THEN
    CREATE POLICY service_role_all_queue_signal_history
      ON queue_signal_history FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- anon: lesen (für Storefront, kein Auth erforderlich)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'location_queue_signals'
      AND policyname = 'anon_read_queue_signals'
  ) THEN
    CREATE POLICY anon_read_queue_signals
      ON location_queue_signals FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- authenticated: lesen (tenant-gefiltert via employees.location_id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'location_queue_signals'
      AND policyname = 'authenticated_read_queue_signals'
  ) THEN
    CREATE POLICY authenticated_read_queue_signals
      ON location_queue_signals FOR SELECT TO authenticated
      USING (
        location_id IN (
          SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'queue_signal_history'
      AND policyname = 'authenticated_read_queue_signal_history'
  ) THEN
    CREATE POLICY authenticated_read_queue_signal_history
      ON queue_signal_history FOR SELECT TO authenticated
      USING (
        location_id IN (
          SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================
-- Indizes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_queue_signal_history_location_time
  ON queue_signal_history (location_id, recorded_at DESC);
