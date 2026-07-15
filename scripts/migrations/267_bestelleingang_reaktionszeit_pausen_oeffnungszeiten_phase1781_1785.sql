-- Migration 267 — Phase 1781–1785
-- bestelleingang_reaktionszeit_log + pausen_erinnerung_log + oeffnungszeiten_config

-- Phase 1781: Bestelleingang-Reaktionszeit Log
CREATE TABLE IF NOT EXISTS bestelleingang_reaktionszeit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL,
  order_id        UUID,
  stunde          SMALLINT NOT NULL,  -- 0–23
  reaktionszeit_sek INTEGER NOT NULL,
  aufgezeichnet_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bestelleingang_reaktionszeit_log_location_stunde
  ON bestelleingang_reaktionszeit_log (location_id, aufgezeichnet_am DESC);

-- Phase 1784: Pausen-Erinnerung Log (optionaler Audit-Trail)
CREATE TABLE IF NOT EXISTS pausen_erinnerung_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID NOT NULL,
  location_id     UUID,
  schicht_dauer_h NUMERIC(5,2) NOT NULL,
  pausen_dauer_min INTEGER NOT NULL,
  hinweis_gezeigt BOOLEAN NOT NULL DEFAULT FALSE,
  aufgezeichnet_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pausen_erinnerung_log_driver
  ON pausen_erinnerung_log (driver_id, aufgezeichnet_am DESC);

-- Phase 1785: Öffnungszeiten in delivery_config
-- Fügt Default-Öffnungszeiten ein wenn noch kein Eintrag vorhanden
INSERT INTO delivery_config (key, value, beschreibung)
VALUES (
  'oeffnungszeiten',
  '{"oeffnung": 11, "schliessung": 22}',
  'Lieferdienst-Öffnungszeiten: oeffnung + schliessung als Stunden (0–23)'
)
ON CONFLICT (key) DO NOTHING;

-- delivery_config Schwellwerte Phase 1781
INSERT INTO delivery_config (key, value, beschreibung)
VALUES
  ('reaktionszeit_schwelle_gelb_sek', '180', 'Reaktionszeit Schwelle gelb (Sekunden)'),
  ('reaktionszeit_schwelle_rot_sek',  '300', 'Reaktionszeit Schwelle rot (Sekunden)')
ON CONFLICT (key) DO NOTHING;
