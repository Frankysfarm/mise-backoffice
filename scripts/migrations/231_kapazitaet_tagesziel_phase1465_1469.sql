-- Migration 231: Kapazität + Tagesziel (Phasen 1465-1469)
-- Phase 1465: Kapazitäts-Auslastungs-API (Fahrer vs. Queue vs. Durchsatz)
-- Phase 1466: Bestelltyp-Analyse-Panel (Kitchen) — Props-basiert, kein SQL
-- Phase 1467: Kapazitäts-Auslastungs-Widget (Dispatch)
-- Phase 1468: Tagesziel-Fortschritts-Ring (Fahrer-App)
-- Phase 1469: Liefer-Transparenz-Status-Karte (Storefront) — localStorage-basiert, kein SQL

-- Kapazitäts-Snapshot-Log: Historische Auslastungswerte für Trend-Analyse
CREATE TABLE IF NOT EXISTS kapazitaets_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  aktive_fahrer INT NOT NULL DEFAULT 0,
  max_fahrer INT NOT NULL DEFAULT 0,
  bestellungen_in_queue INT NOT NULL DEFAULT 0,
  durchsatz_pro_stunde INT NOT NULL DEFAULT 0,
  auslastungs_prozent INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('ausreichend', 'warnung', 'kritisch')),
  erfasst_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kapazitaets_snapshots_location_time
  ON kapazitaets_snapshots (location_id, erfasst_am DESC);

-- Tagesziel-Konfiguration je Fahrer (Stopps-Ziel + Verdienst-Ziel)
CREATE TABLE IF NOT EXISTS fahrer_tagesziele (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  fahrer_id UUID NOT NULL,
  ziel_datum DATE NOT NULL DEFAULT CURRENT_DATE,
  ziel_stopps INT NOT NULL DEFAULT 12,
  ziel_verdienst_eur NUMERIC(8,2) NOT NULL DEFAULT 50.00,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, fahrer_id, ziel_datum)
);

CREATE INDEX IF NOT EXISTS idx_fahrer_tagesziele_fahrer_datum
  ON fahrer_tagesziele (fahrer_id, ziel_datum DESC);

-- Erweitere delivery_config um kapazitaets_warnung_schwelle falls noch nicht vorhanden
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_config' AND column_name = 'kapazitaets_warnung_schwelle'
  ) THEN
    ALTER TABLE delivery_config
      ADD COLUMN IF NOT EXISTS kapazitaets_warnung_schwelle INT DEFAULT 70;
  END IF;
END;
$$;
