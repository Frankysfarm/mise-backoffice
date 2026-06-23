-- Migration 216: Einnahmen-Trichter-Snapshots (Phase 439)
-- Tägliche Konversionsanalyse: Eingegangen → Küche → Transit → Geliefert

CREATE TABLE IF NOT EXISTS einnahmen_trichter_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  datum                 DATE NOT NULL,
  eingegangen           INTEGER NOT NULL DEFAULT 0,
  in_kueche             INTEGER NOT NULL DEFAULT 0,
  unterwegs             INTEGER NOT NULL DEFAULT 0,
  geliefert             INTEGER NOT NULL DEFAULT 0,
  storniert             INTEGER NOT NULL DEFAULT 0,
  umsatz_eingegangen    NUMERIC(12,2) NOT NULL DEFAULT 0,
  umsatz_geliefert      NUMERIC(12,2) NOT NULL DEFAULT 0,
  rate_kueche           NUMERIC(5,4),   -- in_kueche / eingegangen
  rate_transit          NUMERIC(5,4),   -- unterwegs / in_kueche
  rate_abschluss        NUMERIC(5,4),   -- geliefert / unterwegs
  rate_gesamt           NUMERIC(5,4),   -- geliefert / eingegangen
  avg_liefer_min        NUMERIC(8,2),   -- Ø Lieferzeit dispatched→geliefert
  avg_gesamt_min        NUMERIC(8,2),   -- Ø Gesamtzeit created→geliefert
  berechnet_am          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, datum)
);

CREATE INDEX IF NOT EXISTS idx_einnahmen_trichter_location_datum
  ON einnahmen_trichter_snapshots (location_id, datum DESC);

ALTER TABLE einnahmen_trichter_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY einnahmen_trichter_service ON einnahmen_trichter_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY einnahmen_trichter_admin_read ON einnahmen_trichter_snapshots
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION prune_einnahmen_trichter(days_old INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM einnahmen_trichter_snapshots
  WHERE datum < (CURRENT_DATE - days_old);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
