-- Migration 078: SLA Auto-Kompensation Engine
-- Wenn eine Lieferung die zugesagte ETA um mehr als den Schwellenwert überschreitet,
-- wird automatisch ein Guthaben an den Kunden ausgegeben.

CREATE TABLE IF NOT EXISTS sla_compensation_events (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id       uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id          uuid NOT NULL,
  customer_email    text,
  customer_name     text,
  eta_promised_at   timestamptz,     -- ETA die dem Kunden angezeigt wurde
  delivered_at      timestamptz,     -- tatsächliche Lieferzeit
  delay_min         smallint NOT NULL,
  threshold_min     smallint NOT NULL DEFAULT 15,  -- konfigurierter Grenzwert
  compensation_eur  numeric(8, 2) NOT NULL,        -- ausgegebenes Guthaben in EUR
  credit_id         uuid,            -- Verweis auf delivery_credits.id (wenn ausgestellt)
  status            text NOT NULL DEFAULT 'issued'
                      CHECK (status IN ('issued', 'failed', 'skipped')),
  skip_reason       text,
  error_detail      text,
  processed_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)    -- jede Bestellung max. 1 Kompensation
);

CREATE INDEX IF NOT EXISTS idx_sla_comp_location ON sla_compensation_events(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sla_comp_status   ON sla_compensation_events(status) WHERE status = 'issued';

ALTER TABLE sla_compensation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "sla_comp_authenticated"
  ON sla_compensation_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Konfiguration: pro Location, welcher Delay-Schwellenwert und welcher Betrag
CREATE TABLE IF NOT EXISTS sla_compensation_config (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id     uuid NOT NULL UNIQUE REFERENCES locations(id) ON DELETE CASCADE,
  enabled         boolean NOT NULL DEFAULT true,
  threshold_min   smallint NOT NULL DEFAULT 15,  -- Verzögerung in Minuten ab der kompensiert wird
  amount_eur      numeric(8, 2) NOT NULL DEFAULT 2.00,  -- Guthaben pro Verspätung
  max_per_customer_month int NOT NULL DEFAULT 3,   -- max. Kompensationen pro Kunde pro Monat
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sla_compensation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "sla_comp_config_authenticated"
  ON sla_compensation_config
  FOR ALL
  USING (auth.role() = 'authenticated');
