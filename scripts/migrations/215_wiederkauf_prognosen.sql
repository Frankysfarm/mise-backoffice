-- Migration 215: Wiederkauf-Prognosen (Phase 438)
-- Kundenbezogene Wiederkaufwahrscheinlichkeit p30/p60/p90
-- Exponential-Modell basierend auf Kauffrequenz und Recency

CREATE TABLE IF NOT EXISTS wiederkauf_prognosen (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  kunde_telefon     TEXT NOT NULL,
  kunde_name        TEXT,
  p30               NUMERIC(5,4) NOT NULL CHECK (p30 >= 0 AND p30 <= 1),
  p60               NUMERIC(5,4) NOT NULL CHECK (p60 >= 0 AND p60 <= 1),
  p90               NUMERIC(5,4) NOT NULL CHECK (p90 >= 0 AND p90 <= 1),
  letzter_kauf      TIMESTAMPTZ NOT NULL,
  bestellungen_90d  INTEGER NOT NULL DEFAULT 0,
  avg_bestellwert   NUMERIC(10,2),
  prognose_datum    DATE NOT NULL DEFAULT CURRENT_DATE,
  berechnet_am      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, kunde_telefon)
);

CREATE INDEX IF NOT EXISTS idx_wiederkauf_location_p30
  ON wiederkauf_prognosen (location_id, p30 DESC);

CREATE INDEX IF NOT EXISTS idx_wiederkauf_location_datum
  ON wiederkauf_prognosen (location_id, prognose_datum DESC);

ALTER TABLE wiederkauf_prognosen ENABLE ROW LEVEL SECURITY;

CREATE POLICY wiederkauf_service ON wiederkauf_prognosen
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY wiederkauf_admin_read ON wiederkauf_prognosen
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION prune_wiederkauf_prognosen(days_old INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM wiederkauf_prognosen
  WHERE prognose_datum < (CURRENT_DATE - days_old);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
