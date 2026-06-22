-- Migration 212: Liefer-Qualitäts-Index (Phase 433)
-- Automatische Qualitätsbewertung jeder Lieferung (Pünktlichkeit + Zufriedenheit + Vollständigkeit)

CREATE TABLE IF NOT EXISTS liefer_qualitaet (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id       UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  driver_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  score          NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  komponenten    JSONB NOT NULL DEFAULT '{}',
  berechnet_am   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_liefer_qualitaet_location
  ON liefer_qualitaet (location_id, berechnet_am DESC);

CREATE INDEX IF NOT EXISTS idx_liefer_qualitaet_driver
  ON liefer_qualitaet (driver_id, berechnet_am DESC);

CREATE INDEX IF NOT EXISTS idx_liefer_qualitaet_order
  ON liefer_qualitaet (order_id);

-- RLS
ALTER TABLE liefer_qualitaet ENABLE ROW LEVEL SECURITY;

CREATE POLICY liefer_qualitaet_service ON liefer_qualitaet
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY liefer_qualitaet_admin_read ON liefer_qualitaet
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE id = auth.uid()
    )
  );

CREATE POLICY liefer_qualitaet_driver_read ON liefer_qualitaet
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

-- Cleanup-RPC
CREATE OR REPLACE FUNCTION prune_liefer_qualitaet(days_old INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM liefer_qualitaet
  WHERE berechnet_am < (NOW() - (days_old || ' days')::INTERVAL);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
