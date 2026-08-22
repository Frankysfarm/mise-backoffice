-- Migration 001: delivery_zones
-- Konfigurierbare Lieferzonen (A/B/C/D) pro Location.
-- Zone A = nächste/schnellste, Zone D = weiteste/teuerste.

CREATE TABLE IF NOT EXISTS delivery_zones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name          text NOT NULL,                  -- 'A', 'B', 'C', 'D'
  label         text NOT NULL,                  -- 'Express', 'Standard', 'Weit', 'Außerhalb'
  min_km        numeric(6,2) NOT NULL DEFAULT 0,
  max_km        numeric(6,2) NOT NULL,
  surcharge_eur numeric(6,2) NOT NULL DEFAULT 0,
  min_order_eur numeric(6,2) NOT NULL DEFAULT 0,
  eta_base_min  int NOT NULL DEFAULT 20,        -- Basis-ETA für diese Zone in Minuten
  active        boolean NOT NULL DEFAULT true,
  color         text NOT NULL DEFAULT '#22c55e', -- CSS-Farbe für Dashboard
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, name)
);

-- Index für schnelle Zone-Lookups
CREATE INDEX IF NOT EXISTS idx_delivery_zones_location
  ON delivery_zones (location_id) WHERE active = true;

-- Default-Zonen für jeden neuen Location-Eintrag (wird manuell oder via API befüllt)
-- Zone A: 0–3 km, Zone B: 3–6 km, Zone C: 6–10 km, Zone D: 10–20 km

COMMENT ON TABLE delivery_zones IS
  'Konfigurierbare Lieferzonen A–D pro Location. '
  'Zone bestimmt ETA-Basis, Aufschlag und Mindestbestellwert.';
