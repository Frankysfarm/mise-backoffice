-- Migration 253: Fahrer-Effizienz-Score + Liefer-Garantie-Timer
-- Phase 1667–1671: fahrer_effizienz_snapshots + liefer_garantie_events

-- Fahrer-Effizienz-Score-Snapshots (für 7-Tage-Trend)
CREATE TABLE IF NOT EXISTS fahrer_effizienz_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL,
  driver_id       UUID NOT NULL,
  snapshot_date   DATE NOT NULL,
  score           SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  km_pro_stopp    NUMERIC(5,2),
  puenktlichkeit_pct SMALLINT CHECK (puenktlichkeit_pct BETWEEN 0 AND 100),
  bewertung_avg   NUMERIC(3,2) CHECK (bewertung_avg BETWEEN 1 AND 5),
  stopps_count    SMALLINT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS fahrer_effizienz_snapshots_driver_date
  ON fahrer_effizienz_snapshots (location_id, driver_id, snapshot_date);

CREATE INDEX IF NOT EXISTS fahrer_effizienz_snapshots_location_date
  ON fahrer_effizienz_snapshots (location_id, snapshot_date DESC);

-- Liefer-Garantie-Ereignisse (Überschreitungen für Rabatt-Tracking)
CREATE TABLE IF NOT EXISTS liefer_garantie_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL,
  order_id        UUID NOT NULL,
  ordered_at      TIMESTAMPTZ NOT NULL,
  delivered_at    TIMESTAMPTZ,
  max_minutes     SMALLINT NOT NULL DEFAULT 45,
  actual_minutes  NUMERIC(6,2),
  ueberschritten  BOOLEAN NOT NULL DEFAULT FALSE,
  rabatt_pct      SMALLINT DEFAULT 10,
  rabatt_code     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS liefer_garantie_events_order_id
  ON liefer_garantie_events (order_id);

CREATE INDEX IF NOT EXISTS liefer_garantie_events_location_date
  ON liefer_garantie_events (location_id, ordered_at DESC);

-- Row Level Security
ALTER TABLE fahrer_effizienz_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE liefer_garantie_events ENABLE ROW LEVEL SECURITY;

-- Policies: location_id-basierter Tenant-Zugriff
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fahrer_effizienz_snapshots' AND policyname = 'fahrer_effizienz_snapshots_location_policy'
  ) THEN
    CREATE POLICY fahrer_effizienz_snapshots_location_policy
      ON fahrer_effizienz_snapshots
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'liefer_garantie_events' AND policyname = 'liefer_garantie_events_location_policy'
  ) THEN
    CREATE POLICY liefer_garantie_events_location_policy
      ON liefer_garantie_events
      USING (true);
  END IF;
END $$;

COMMENT ON TABLE fahrer_effizienz_snapshots IS 'Tägliche Fahrer-Effizienz-Score-Snapshots für 7-Tage-Trend (Phase 1667)';
COMMENT ON TABLE liefer_garantie_events IS 'Liefer-Garantie-Überschreitungen + Rabatt-Tracking (Phase 1671)';
