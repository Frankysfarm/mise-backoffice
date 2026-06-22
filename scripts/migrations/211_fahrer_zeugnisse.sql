-- Migration 211: Fahrer-Leistungs-Zeugnisse (Phase 432)
-- Monatliches Leistungszeugnis je Fahrer basierend auf schicht_abschluss_berichte

CREATE TABLE IF NOT EXISTS fahrer_zeugnisse (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  monat        DATE NOT NULL,  -- always 1st of month: 2026-06-01
  grade        TEXT NOT NULL CHECK (grade IN ('A+', 'A', 'B', 'C', 'D')),
  daten        JSONB NOT NULL DEFAULT '{}',
  erstellt_am  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, driver_id, monat)
);

CREATE INDEX IF NOT EXISTS idx_fahrer_zeugnisse_location
  ON fahrer_zeugnisse (location_id, monat DESC);

CREATE INDEX IF NOT EXISTS idx_fahrer_zeugnisse_driver
  ON fahrer_zeugnisse (driver_id, monat DESC);

-- RLS
ALTER TABLE fahrer_zeugnisse ENABLE ROW LEVEL SECURITY;

CREATE POLICY fahrer_zeugnisse_service ON fahrer_zeugnisse
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY fahrer_zeugnisse_admin_read ON fahrer_zeugnisse
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE id = auth.uid()
    )
  );

CREATE POLICY fahrer_zeugnisse_driver_read ON fahrer_zeugnisse
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

-- Cleanup-RPC
CREATE OR REPLACE FUNCTION prune_fahrer_zeugnisse(months_old INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM fahrer_zeugnisse
  WHERE monat < (DATE_TRUNC('month', CURRENT_DATE) - (months_old || ' months')::INTERVAL)::DATE;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
