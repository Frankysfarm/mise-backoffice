-- Migration 235 — Lieferzonen-Auslastung + Tour-Abschluss (Phase 1497–1501)
-- Phase 1497: lieferzonen_auslastungs_snapshots — Historische Auslastungswerte je Zone
-- Phase 1500: tour_abschluss_log — Tour-Abschluss-Kennzahlen je Fahrer/Tour
-- Phase 1497: delivery_zones.postal_codes-Erweiterung

-- Historische Auslastungs-Snapshots je Zone
CREATE TABLE IF NOT EXISTS lieferzonen_auslastungs_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL,
  zone_id UUID,
  plz TEXT,
  zone_name TEXT,
  aktive_bestellungen INT NOT NULL DEFAULT 0,
  fahrer_anzahl INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('frei', 'normal', 'ausgelastet')),
  gemessen_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_lzas_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lzas_location_zeit
  ON lieferzonen_auslastungs_snapshots(location_id, gemessen_am DESC);

-- Tour-Abschluss-Log je Fahrer
CREATE TABLE IF NOT EXISTS tour_abschluss_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL,
  fahrer_id UUID NOT NULL,
  batch_id UUID,
  stopps_gesamt INT NOT NULL DEFAULT 0,
  verdienst_eur NUMERIC(8,2) NOT NULL DEFAULT 0,
  strecke_km NUMERIC(8,2) NOT NULL DEFAULT 0,
  avg_lieferzeit_min INT NOT NULL DEFAULT 0,
  bewertungs_trend TEXT CHECK (bewertungs_trend IN ('besser', 'gleich', 'schlechter')),
  letzte_bewertung NUMERIC(3,1),
  abgeschlossen_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_tal_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tal_fahrer_am
  ON tour_abschluss_log(fahrer_id, abgeschlossen_am DESC);

-- Sicherstellung: delivery_zones.postal_codes-Array falls noch nicht vorhanden
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_zones' AND column_name = 'postal_codes'
  ) THEN
    ALTER TABLE delivery_zones ADD COLUMN postal_codes TEXT[] DEFAULT '{}';
  END IF;
END $$;
