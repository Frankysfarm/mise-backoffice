-- Migration 131: SLA Breach Detector
-- Echtzeit-Tracking von SLA-Verstößen (Lieferung überschreitet ETA+10min)
-- Wird von lib/delivery/sla-breach-detector.ts beschrieben.
-- benchmarking.ts referenziert diese Tabelle bereits (Phase 111).

CREATE TABLE IF NOT EXISTS sla_breaches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid        NOT NULL,
  order_id        uuid        NOT NULL UNIQUE,   -- 1 Breach-Record pro Bestellung
  driver_id       uuid,
  batch_id        uuid,
  bestellnummer   text,
  severity        text        NOT NULL DEFAULT 'warning'
                              CHECK (severity IN ('warning', 'critical')),
  delay_min       smallint    NOT NULL DEFAULT 0,
  eta_latest_at   timestamptz,                   -- ETA die überschritten wurde
  escalated_at    timestamptz,                   -- wann Dispatch-Eskalation ausgelöst
  resolved_at     timestamptz,                   -- wann Breach aufgelöst (Lieferung fertig)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Effizienter Scan aller aktiven Breaches pro Location
CREATE INDEX IF NOT EXISTS idx_sla_breaches_location_active
  ON sla_breaches (location_id, created_at DESC)
  WHERE resolved_at IS NULL;

-- Cleanup alter, aufgelöster Breaches
CREATE INDEX IF NOT EXISTS idx_sla_breaches_resolved
  ON sla_breaches (resolved_at)
  WHERE resolved_at IS NOT NULL;

ALTER TABLE sla_breaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "sla_breaches_authenticated"
  ON sla_breaches
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Auto-Update updated_at
CREATE OR REPLACE FUNCTION update_sla_breaches_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sla_breaches_updated_at ON sla_breaches;
CREATE TRIGGER trg_sla_breaches_updated_at
  BEFORE UPDATE ON sla_breaches
  FOR EACH ROW EXECUTE FUNCTION update_sla_breaches_updated_at();

COMMENT ON TABLE sla_breaches IS
  'Echtzeit-SLA-Verstöße: Bestellungen die eta_latest + 10min überschritten haben ohne geliefert zu sein.';
