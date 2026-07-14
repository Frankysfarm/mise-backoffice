-- Migration 230: Schicht-Bilanz + Heatmap (Phasen 1460-1464)
-- Phase 1460: Schicht-Bilanz-API (je Fahrer) — Stopps/km/Verdienst/Trinkgeld
-- Phase 1461: Bestellvolumen-Heatmap — 7×24 Grid Props-basiert
-- Phase 1462: Dispatch Schicht-Bilanz-Widget
-- Phase 1463: Fahrer Persönliche Schicht-Zusammenfassung
-- Phase 1464: Storefront Liefer-Versprechen-Banner (ETA > 40 Min → 5% Rabatt)

-- Liefer-Versprechen-Log: Welche Kunden haben den 5%-Rabatt-Code erhalten?
CREATE TABLE IF NOT EXISTS liefer_versprechen_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  rabatt_code TEXT NOT NULL DEFAULT 'SCHNELL5',
  eta_minuten INT NOT NULL,
  angezeigt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kopiert BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (location_id, session_id, angezeigt_am::DATE)
);

CREATE INDEX IF NOT EXISTS idx_liefer_versprechen_location_date
  ON liefer_versprechen_log (location_id, angezeigt_am);

-- Erweitere mise_delivery_stops um trinkgeld falls noch nicht vorhanden
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mise_delivery_stops' AND column_name = 'trinkgeld'
  ) THEN
    ALTER TABLE mise_delivery_stops ADD COLUMN trinkgeld NUMERIC(8,2) DEFAULT 0;
  END IF;
END;
$$;

-- Erweitere mise_delivery_batches um gesamt_km und stopps_anzahl falls noch nicht vorhanden
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mise_delivery_batches' AND column_name = 'gesamt_km'
  ) THEN
    ALTER TABLE mise_delivery_batches ADD COLUMN gesamt_km NUMERIC(8,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mise_delivery_batches' AND column_name = 'stopps_anzahl'
  ) THEN
    ALTER TABLE mise_delivery_batches ADD COLUMN stopps_anzahl INT DEFAULT 0;
  END IF;
END;
$$;
