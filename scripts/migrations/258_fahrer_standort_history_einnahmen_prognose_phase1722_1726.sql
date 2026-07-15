-- Migration 258 — Phase 1722–1726: Fahrer-Standort-History + Einnahmen-Prognose
-- Erstellt: 2026-07-15

-- Fahrer-GPS-Verlauf der letzten 2h (Phase 1722)
CREATE TABLE IF NOT EXISTS fahrer_standort_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL,
  driver_id       TEXT NOT NULL,
  tour_id         UUID,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  aufgezeichnet_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fsh_location_fk FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fsh_location_driver ON fahrer_standort_history (location_id, driver_id, aufgezeichnet_am DESC);
CREATE INDEX IF NOT EXISTS idx_fsh_tour ON fahrer_standort_history (tour_id) WHERE tour_id IS NOT NULL;

-- Einnahmen-Prognose-Cache je Fahrer/Schicht (Phase 1725)
CREATE TABLE IF NOT EXISTS fahrer_einnahmen_prognose_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL,
  driver_id       TEXT NOT NULL,
  bisher_eur      NUMERIC(8,2) NOT NULL DEFAULT 0,
  stunden_online  NUMERIC(4,1) NOT NULL DEFAULT 0,
  euro_pro_stunde NUMERIC(6,2) NOT NULL DEFAULT 0,
  prognose_eur    NUMERIC(8,2) NOT NULL DEFAULT 0,
  konfidenz       SMALLINT NOT NULL DEFAULT 50,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fepc_location_fk FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fepc_driver ON fahrer_einnahmen_prognose_cache (driver_id, erstellt_am DESC);

-- Gericht-Forecast-Log für Audit-Trail (Phase 1723)
CREATE TABLE IF NOT EXISTS gericht_forecast_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL,
  gericht_name    TEXT NOT NULL,
  prognose_portionen SMALLINT NOT NULL DEFAULT 0,
  stufe           TEXT NOT NULL CHECK (stufe IN ('niedrig', 'normal', 'hoch', 'kritisch')),
  erfasst_am      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gfl_location_fk FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gfl_location_ts ON gericht_forecast_log (location_id, erfasst_am DESC);

-- delivery_config: Einnahmen-Prognose-Schichtdauer (Phase 1725)
INSERT INTO delivery_config (location_id, key, value, beschreibung)
SELECT id, 'einnahmen_prognose_schicht_h', '8', 'Erwartete Schichtdauer in Stunden für Einnahmen-Hochrechnung'
FROM locations
ON CONFLICT (location_id, key) DO NOTHING;
