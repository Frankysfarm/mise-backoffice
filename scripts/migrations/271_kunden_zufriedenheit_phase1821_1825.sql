-- Phase 1821–1825: Kunden-Zufriedenheit, Einnahmen-Tracker, Touren-Auslastung
-- ============================================================

-- Kunden-Zufriedenheits-Snapshots (Phase 1821)
CREATE TABLE IF NOT EXISTS kunden_zufriedenheit_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  UUID NOT NULL,
  score        SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  ampel        TEXT NOT NULL CHECK (ampel IN ('gruen', 'gelb', 'rot')),
  trend        TEXT NOT NULL CHECK (trend IN ('steigend', 'fallend', 'stabil')),
  puenktlichkeit_pct  SMALLINT,
  storno_rate_pct     SMALLINT,
  eta_genauigkeit_pct SMALLINT,
  generiert_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kunden_zufriedenheit_location
  ON kunden_zufriedenheit_snapshots (location_id, generiert_am DESC);

-- Fahrer Einnahmen Log (Phase 1824 — für Live-Einnahmen-Tracker)
CREATE TABLE IF NOT EXISTS fahrer_einnahmen_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID NOT NULL,
  location_id UUID NOT NULL,
  tour_id     UUID,
  betrag      NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fahrer_einnahmen_driver
  ON fahrer_einnahmen_log (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fahrer_einnahmen_location
  ON fahrer_einnahmen_log (location_id, created_at DESC);

-- delivery_config: Zufriedenheits-Schwellwerte und Einnahmen-Ziele
INSERT INTO delivery_config (key, value, beschreibung) VALUES
  ('zufriedenheit_gruen_schwelle', '80', 'Score-Schwelle für grüne Ampel Kunden-Zufriedenheit'),
  ('zufriedenheit_gelb_schwelle',  '60', 'Score-Schwelle für gelbe Ampel Kunden-Zufriedenheit'),
  ('fahrer_einnahmen_tagesziel',   '80', 'Standard-Tagesziel Fahrer-Einnahmen in €'),
  ('kapazitaet_alarm_schwelle',    '90', 'Touren-Kapazitäts-Auslastung Alarm-Schwelle in %')
ON CONFLICT (key) DO NOTHING;
