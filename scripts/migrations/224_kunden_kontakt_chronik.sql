-- Migration 224: Kunden-Kontakt-Chronik + Trinkgeld-Tracker-Snapshots
-- Phase 1188: driver_contact_log für Kunden-Kontakt-Chronik
-- Phase 1191: schicht_trinkgeld_snapshots für Trinkgeld-Tracker

CREATE TABLE IF NOT EXISTS driver_contact_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID NOT NULL,
  location_id     UUID NOT NULL,
  order_id        TEXT,
  contact_type    TEXT NOT NULL CHECK (contact_type IN ('Anruf', 'Nachricht', 'Klingelton', 'Nicht-Erreicht')),
  customer_name   TEXT,
  address         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_contact_log_driver_date
  ON driver_contact_log (driver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_driver_contact_log_location
  ON driver_contact_log (location_id, created_at DESC);

ALTER TABLE driver_contact_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_contact_log' AND policyname = 'driver_contact_log_select'
  ) THEN
    CREATE POLICY driver_contact_log_select ON driver_contact_log
      FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_contact_log' AND policyname = 'driver_contact_log_insert'
  ) THEN
    CREATE POLICY driver_contact_log_insert ON driver_contact_log
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Trinkgeld-Snapshots (für historische Auswertung)
CREATE TABLE IF NOT EXISTS schicht_trinkgeld_snapshots (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id                 UUID NOT NULL,
  location_id               UUID NOT NULL,
  datum                     DATE NOT NULL,
  trinkgeld_kumuliert_eur   NUMERIC(8,2) NOT NULL DEFAULT 0,
  stopps_gesamt             INTEGER NOT NULL DEFAULT 0,
  durchschnitt_pro_stopp    NUMERIC(6,2),
  erfasst_um                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schicht_trinkgeld_driver_datum
  ON schicht_trinkgeld_snapshots (driver_id, datum DESC);

ALTER TABLE schicht_trinkgeld_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'schicht_trinkgeld_snapshots' AND policyname = 'sts_select'
  ) THEN
    CREATE POLICY sts_select ON schicht_trinkgeld_snapshots FOR SELECT USING (true);
  END IF;
END $$;
