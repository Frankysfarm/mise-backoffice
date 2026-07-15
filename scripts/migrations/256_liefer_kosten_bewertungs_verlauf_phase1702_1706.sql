-- Migration 256: Liefer-Kosten + Bewertungs-Verlauf — Phase 1702–1706
-- Created: 2026-07-15

-- Historische Lieferkosten-Snapshots für Trend-Analyse
CREATE TABLE IF NOT EXISTS liefer_kosten_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  kosten_avg_eur  NUMERIC(6,2) NOT NULL DEFAULT 0,
  anzahl          INTEGER NOT NULL DEFAULT 0,
  kosten_gesamt   NUMERIC(10,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL CHECK (status IN ('guenstig','mittel','teuer')),
  snapshot_datum  DATE NOT NULL DEFAULT CURRENT_DATE,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(location_id, snapshot_datum)
);
CREATE INDEX IF NOT EXISTS idx_liefer_kosten_location_datum
  ON liefer_kosten_snapshots(location_id, snapshot_datum DESC);

-- Tour-Bewertungen je Fahrer (für Phase 1705)
-- Ergänzt falls noch nicht vorhanden
CREATE TABLE IF NOT EXISTS tour_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  tour_id     UUID REFERENCES tours(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  sterne      SMALLINT NOT NULL CHECK (sterne BETWEEN 1 AND 5),
  kommentar   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tour_ratings_driver_created
  ON tour_ratings(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tour_ratings_location
  ON tour_ratings(location_id, created_at DESC);

-- delivery_config: Konfigurierbarer Wert für Max-Lieferzeit-Garantie (Phase 1706)
INSERT INTO delivery_config (key, value, beschreibung)
VALUES ('max_lieferzeit_garantie_min', '45', 'Max. Lieferzeit-Garantie in Minuten (Countdown im Storefront)')
ON CONFLICT (key) DO NOTHING;

-- delivery_config: Schwellenwert für "teuer" Lieferkosten-Ampel
INSERT INTO delivery_config (key, value, beschreibung)
VALUES ('liefer_kosten_teuer_schwelle_eur', '4.50', 'Ab diesem Betrag gilt Lieferung als teuer (EUR je Lieferung)')
ON CONFLICT (key) DO NOTHING;
