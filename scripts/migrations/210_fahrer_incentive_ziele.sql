-- Migration 210: Fahrer-Incentive-Ziele (Phase 431)
-- Zielbasiertes Bonus-System verknüpft mit schicht_abschluss_berichte

-- Incentive-Ziele je Fahrer und Zeitraum
CREATE TABLE IF NOT EXISTS fahrer_incentives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  ziel_typ        TEXT NOT NULL CHECK (ziel_typ IN ('score', 'puenktlichkeit', 'lieferungen')),
  zielwert        NUMERIC(8,2) NOT NULL CHECK (zielwert > 0),
  ist_wert        NUMERIC(8,2),
  bonus_eur       NUMERIC(8,2) NOT NULL CHECK (bonus_eur >= 0),
  erreicht_am     TIMESTAMPTZ,
  zeitraum_start  DATE NOT NULL,
  zeitraum_end    DATE NOT NULL,
  generiert_am    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (zeitraum_end >= zeitraum_start),
  UNIQUE (location_id, driver_id, ziel_typ, zeitraum_start)
);

CREATE INDEX IF NOT EXISTS idx_fahrer_incentives_location
  ON fahrer_incentives (location_id, zeitraum_end DESC);

CREATE INDEX IF NOT EXISTS idx_fahrer_incentives_driver
  ON fahrer_incentives (driver_id, zeitraum_end DESC);

-- RLS
ALTER TABLE fahrer_incentives ENABLE ROW LEVEL SECURITY;

CREATE POLICY fahrer_incentives_service ON fahrer_incentives
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY fahrer_incentives_admin_read ON fahrer_incentives
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE id = auth.uid()
    )
  );

CREATE POLICY fahrer_incentives_driver_read ON fahrer_incentives
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

-- Cleanup-RPC
CREATE OR REPLACE FUNCTION prune_fahrer_incentives(days_old INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM fahrer_incentives
  WHERE zeitraum_end < CURRENT_DATE - days_old
    AND erreicht_am IS NOT NULL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
