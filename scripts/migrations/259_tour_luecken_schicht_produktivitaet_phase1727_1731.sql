-- Migration 259 — Tour-Lücken + Schicht-Produktivität (Phasen 1727–1731)
-- Phase 1727: Tour-Lücken-Erkennung-API
-- Phase 1728: Schicht-Produktivitäts-Ampel (Kitchen)
-- Phase 1729: Tour-Lücken-Monitor (Dispatch)
-- Phase 1730: Zonen-Tipp-Karte (Fahrer-App)
-- Phase 1731: Lieferzeit-Garantie-Uhr (Storefront)

-- Audit-Log für erkannte Tour-Lücken je Fahrer
CREATE TABLE IF NOT EXISTS tour_luecken_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id      UUID NOT NULL,
  datum          DATE NOT NULL DEFAULT CURRENT_DATE,
  luecke_von     TIMESTAMPTZ NOT NULL,
  luecke_bis     TIMESTAMPTZ NOT NULL,
  dauer_min      INTEGER NOT NULL,
  alert          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_luecken_log_location_datum
  ON tour_luecken_log (location_id, datum DESC);

CREATE INDEX IF NOT EXISTS idx_tour_luecken_log_driver_datum
  ON tour_luecken_log (driver_id, datum DESC);

-- Täglicher Snapshot Schicht-Produktivität je Location
CREATE TABLE IF NOT EXISTS schicht_produktivitaet_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  datum                 DATE NOT NULL DEFAULT CURRENT_DATE,
  bestellungen_gesamt   INTEGER NOT NULL DEFAULT 0,
  schicht_stunden       NUMERIC(5,2) NOT NULL DEFAULT 0,
  ist_pro_h             NUMERIC(6,2) NOT NULL DEFAULT 0,
  ziel_pro_h            NUMERIC(6,2) NOT NULL DEFAULT 8,
  ampel                 TEXT NOT NULL DEFAULT 'gelb' CHECK (ampel IN ('gruen','gelb','rot')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, datum)
);

CREATE INDEX IF NOT EXISTS idx_schicht_produktivitaet_location_datum
  ON schicht_produktivitaet_snapshots (location_id, datum DESC);

-- Zonen-Tipp-Protokoll je Fahrer (welcher Tipp wurde wann angezeigt)
CREATE TABLE IF NOT EXISTS zonen_tipp_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id    UUID NOT NULL,
  zone_name    TEXT NOT NULL,
  auslastung   INTEGER NOT NULL,
  aktive_fahrer INTEGER NOT NULL DEFAULT 0,
  angezeigt_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zonen_tipp_log_driver
  ON zonen_tipp_log (driver_id, angezeigt_am DESC);

-- delivery_config Keys für neue Phasen
INSERT INTO delivery_config (location_id, key, value)
SELECT l.id, k.key, k.value
FROM locations l
CROSS JOIN (VALUES
  ('schicht_produktivitaet_ziel_pro_h', '8'),
  ('tour_luecken_alert_min', '15'),
  ('garantie_eta_min', '45')
) AS k(key, value)
ON CONFLICT (location_id, key) DO NOTHING;
