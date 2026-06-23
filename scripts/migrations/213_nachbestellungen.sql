-- Migration 213: Automatische Nachbestellungs-Engine (Phase 436)
-- Verfolgt ausstehende Materialnachbestellungen unter Mindestbestand

CREATE TABLE IF NOT EXISTS nachbestellungen (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  artikel_id     UUID NOT NULL REFERENCES delivery_materials(id) ON DELETE CASCADE,
  menge          NUMERIC(10,2) NOT NULL CHECK (menge > 0),
  status         TEXT NOT NULL DEFAULT 'ausstehend'
                   CHECK (status IN ('ausstehend', 'bestellt', 'geliefert')),
  ausgeloest_am  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bestellt_am    TIMESTAMPTZ,
  geliefert_am   TIMESTAMPTZ,
  notizen        TEXT
);

CREATE INDEX IF NOT EXISTS idx_nachbestellungen_location
  ON nachbestellungen (location_id, status, ausgeloest_am DESC);

CREATE INDEX IF NOT EXISTS idx_nachbestellungen_artikel
  ON nachbestellungen (artikel_id, ausgeloest_am DESC);

-- RLS
ALTER TABLE nachbestellungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY nachbestellungen_service ON nachbestellungen
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY nachbestellungen_admin_read ON nachbestellungen
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE id = auth.uid()
    )
  );

CREATE POLICY nachbestellungen_admin_write ON nachbestellungen
  FOR ALL TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    location_id IN (
      SELECT location_id FROM employees WHERE id = auth.uid()
    )
  );

-- Cleanup-RPC
CREATE OR REPLACE FUNCTION prune_nachbestellungen(days_old INTEGER DEFAULT 180)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM nachbestellungen
  WHERE status = 'geliefert'
    AND geliefert_am < (NOW() - (days_old || ' days')::INTERVAL);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
