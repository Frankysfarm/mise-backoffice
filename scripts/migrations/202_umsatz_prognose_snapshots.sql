-- Migration 202: Umsatz-Prognose-Snapshots (Phase 420)
--
-- Speichert ML-ähnliche Umsatzprognosen je Standort und Zieldatum.
-- Basiert auf schicht_roi_daily-Historien (gleitende gewichtete Regression
-- nach Wochentag + Exponential-Decay je Alter der Beobachtung).

-- ── Haupt-Tabelle ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS umsatz_prognose_snapshots (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  prognose_datum        DATE        NOT NULL,   -- Datum, für das die Prognose gilt
  prognose_typ          TEXT        NOT NULL DEFAULT 'tag',  -- 'tag' | 'woche'

  -- Kernergebnis
  erwarteter_umsatz_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  konfidenz             NUMERIC(4,3) NOT NULL DEFAULT 0,     -- 0.0 – 1.0
  range_low_eur         NUMERIC(10,2),                       -- unteres 80%-Konfidenzband
  range_high_eur        NUMERIC(10,2),                       -- oberes  80%-Konfidenzband

  -- Metadaten Berechnungsbasis
  basis_snapshots       INTEGER     NOT NULL DEFAULT 0,      -- Anzahl historischer Datenpunkte
  trend_richtung        TEXT        NOT NULL DEFAULT 'stable', -- 'up' | 'stable' | 'down'
  wochentag             SMALLINT,                            -- 0=So … 6=Sa (für Typ 'tag')
  avg_umsatz_letzter_monat NUMERIC(10,2),

  berechnet_am          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (location_id, prognose_datum, prognose_typ)
);

-- ── Indizes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_umsatz_prognose_loc_datum
  ON umsatz_prognose_snapshots (location_id, prognose_datum DESC);

CREATE INDEX IF NOT EXISTS idx_umsatz_prognose_loc_typ
  ON umsatz_prognose_snapshots (location_id, prognose_typ, prognose_datum DESC);

-- ── updated_at Trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_umsatz_prognose_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_umsatz_prognose_updated_at ON umsatz_prognose_snapshots;
CREATE TRIGGER trg_umsatz_prognose_updated_at
  BEFORE UPDATE ON umsatz_prognose_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_umsatz_prognose_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE umsatz_prognose_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'umsatz_prognose_snapshots' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON umsatz_prognose_snapshots
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'umsatz_prognose_snapshots' AND policyname = 'authenticated read own location'
  ) THEN
    CREATE POLICY "authenticated read own location" ON umsatz_prognose_snapshots
      FOR SELECT TO authenticated
      USING (
        location_id IN (
          SELECT location_id FROM user_location_access WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── Cleanup-Funktion ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_umsatz_prognose_snapshots(days_old INT DEFAULT 60)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted INT;
BEGIN
  DELETE FROM umsatz_prognose_snapshots
  WHERE prognose_datum < CURRENT_DATE - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
