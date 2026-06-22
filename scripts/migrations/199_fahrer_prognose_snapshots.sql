-- Migration 199: Fahrer-Prognose-Snapshots
-- Phase 417 — ML-ähnlicher Prognose-Score je Fahrer (0–100)
-- Basiert auf historischen Touren: Pünktlichkeit, Ø Lieferzeit, Bewertung, Stopp-Effizienz

-- ── Haupt-Snapshot-Tabelle ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fahrer_prognose_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id             UUID NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id           UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Gesamt-Score 0–100
  prognose_score        NUMERIC(5,1) NOT NULL DEFAULT 0,
  -- elite(≥80) | gut(≥60) | durchschnitt(≥40) | auffällig(<40)
  kategorie             TEXT NOT NULL DEFAULT 'durchschnitt',

  -- Sub-Scores 0–100
  punctuality_score     NUMERIC(5,1),   -- On-Time-Rate
  delivery_time_score   NUMERIC(5,1),   -- Ø Lieferzeit (niedriger = besser)
  storno_score          NUMERIC(5,1),   -- Stornierungsrate-Proxy (Kundenbewertung)
  efficiency_score      NUMERIC(5,1),   -- Stops/Tour-Effizienz

  -- Datenbasis
  tours_analyzed        INTEGER NOT NULL DEFAULT 0,
  days_analyzed         INTEGER NOT NULL DEFAULT 0,

  -- Trend: up/stable/down (Vergleich letzte 7d vs vorherige 7d)
  trend_direction       TEXT NOT NULL DEFAULT 'stable',

  computed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (driver_id, location_id)
);

-- ── Indizes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fahrer_prognose_location
  ON fahrer_prognose_snapshots (location_id, prognose_score DESC);

CREATE INDEX IF NOT EXISTS idx_fahrer_prognose_driver
  ON fahrer_prognose_snapshots (driver_id, location_id);

CREATE INDEX IF NOT EXISTS idx_fahrer_prognose_kategorie
  ON fahrer_prognose_snapshots (location_id, kategorie);

-- ── updated_at Trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_fahrer_prognose_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fahrer_prognose_updated_at ON fahrer_prognose_snapshots;
CREATE TRIGGER trg_fahrer_prognose_updated_at
  BEFORE UPDATE ON fahrer_prognose_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_fahrer_prognose_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE fahrer_prognose_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_fahrer_prognose" ON fahrer_prognose_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_own_location_fahrer_prognose" ON fahrer_prognose_snapshots
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM user_location_access WHERE user_id = auth.uid()
    )
  );

-- ── View: Rangliste je Standort ────────────────────────────────────────────

CREATE OR REPLACE VIEW v_fahrer_prognose_rangliste AS
SELECT
  fps.*,
  ROW_NUMBER() OVER (
    PARTITION BY fps.location_id
    ORDER BY fps.prognose_score DESC
  ) AS rang
FROM fahrer_prognose_snapshots fps;

-- ── Cleanup-Funktion ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_fahrer_prognose_snapshots(days_old INT DEFAULT 90)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted INT;
BEGIN
  -- Nur Snapshots löschen, die seit >days_old Tagen nicht mehr aktualisiert wurden
  DELETE FROM fahrer_prognose_snapshots
  WHERE updated_at < now() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
