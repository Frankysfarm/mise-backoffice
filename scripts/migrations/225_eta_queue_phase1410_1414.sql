-- Phase 1410-1414: ETA-Verfeinerung + Warteschlange + Allergen-Schnell-Ampel

-- Warteschlangen-Snapshot (optional für Trend)
CREATE TABLE IF NOT EXISTS delivery_queue_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  bestellungen_in_queue integer NOT NULL DEFAULT 0,
  wartezeit_zusatz_min integer NOT NULL DEFAULT 0,
  stufe text NOT NULL DEFAULT 'niedrig' CHECK (stufe IN ('niedrig', 'mittel', 'hoch')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_snapshots_location_created
  ON delivery_queue_snapshots (location_id, created_at DESC);

-- Fahrer-Bewertungs-Verlauf-Schnappschuss (für Trend-Berechnung)
CREATE TABLE IF NOT EXISTS driver_rating_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  location_id uuid NOT NULL,
  schnitt_7_tage numeric(3,1),
  anzahl_bewertungen integer DEFAULT 0,
  trend text CHECK (trend IN ('besser', 'gleich', 'schlechter')),
  erfasst_am date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_rating_snapshots_driver_date
  ON driver_rating_snapshots (driver_id, erfasst_am);

-- Schicht-Produktivitäts-Log
CREATE TABLE IF NOT EXISTS schicht_produktivitaet_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  location_id uuid NOT NULL,
  bestellungen_pro_stunde numeric(5,2) NOT NULL,
  bestellungen_heute integer NOT NULL DEFAULT 0,
  stunden_aktiv numeric(4,1) NOT NULL DEFAULT 0,
  ranking text NOT NULL CHECK (ranking IN ('top', 'mitte', 'low')),
  erfasst_am date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schicht_produktivitaet_location_date
  ON schicht_produktivitaet_log (location_id, erfasst_am DESC);
