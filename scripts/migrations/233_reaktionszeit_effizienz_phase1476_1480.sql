-- Migration 233: Phase 1476-1480
-- Fahrer-Reaktionszeit + Lieferzeit-Garantie-Log

-- Reaktionszeit-Log für 7-Tage-Trend-Auswertung (Phase 1476)
CREATE TABLE IF NOT EXISTS fahrer_reaktionszeit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL,
  driver_id       UUID NOT NULL,
  batch_id        UUID,
  assigned_at     TIMESTAMPTZ NOT NULL,
  accepted_at     TIMESTAMPTZ NOT NULL,
  reaktionszeit_s  INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (accepted_at - assigned_at))::INTEGER
  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fahrer_reaktionszeit_log_location_driver
  ON fahrer_reaktionszeit_log (location_id, driver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fahrer_reaktionszeit_log_location_date
  ON fahrer_reaktionszeit_log (location_id, DATE(created_at));

-- Lieferzeit-Garantie-Log (Phase 1480)
CREATE TABLE IF NOT EXISTS lieferzeit_garantie_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL,
  customer_id     TEXT,
  order_id        UUID,
  eta_minuten     INTEGER NOT NULL,
  coupon_code     TEXT NOT NULL DEFAULT 'PÜNKTLICH5',
  eingeloest      BOOLEAN NOT NULL DEFAULT FALSE,
  eingeloest_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lieferzeit_garantie_log_location
  ON lieferzeit_garantie_log (location_id, created_at DESC);

-- delivery_config: Schwellwert für Lieferzeit-Garantie (Phase 1480)
INSERT INTO delivery_config (location_id, key, value)
SELECT l.id, 'liefergarantie_eta_schwelle_min', '45'
FROM mise_locations l
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_config dc
  WHERE dc.location_id = l.id AND dc.key = 'liefergarantie_eta_schwelle_min'
)
ON CONFLICT DO NOTHING;
