-- Migration 266: Smart Delivery System Phasen 1776–1780
-- Schicht-Auslastungs-Prognose + Live-Kochplan + Schicht-Bilanz + Küchen-Status
-- 2026-07-15

-- Phase 1776 Backend: Schicht-Auslastungs-Prognose
-- Caches historische Bestellvolumen-Profile für Prognoseberechnungen
CREATE TABLE IF NOT EXISTS schicht_auslastungs_prognose_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  stunde          SMALLINT NOT NULL CHECK (stunde BETWEEN 0 AND 23),
  wochentag       SMALLINT NOT NULL CHECK (wochentag BETWEEN 0 AND 6),
  avg_bestellungen NUMERIC(6,2) NOT NULL DEFAULT 0,
  p75_bestellungen NUMERIC(6,2) NOT NULL DEFAULT 0,
  samples          INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, stunde, wochentag)
);

CREATE INDEX IF NOT EXISTS idx_auslastungs_prognose_location_stunde
  ON schicht_auslastungs_prognose_cache (location_id, stunde, wochentag);

-- Phase 1777 Kitchen: Live-Kochplan-Optimierer
-- Log für überfällige Bestellungen (Monitoring)
CREATE TABLE IF NOT EXISTS kochplan_ueberfaellig_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id       UUID NOT NULL,
  minuten_ueberfaellig INTEGER NOT NULL,
  dringlichkeit  TEXT NOT NULL CHECK (dringlichkeit IN ('kritisch', 'hoch', 'normal')),
  logged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kochplan_ueberfaellig_location_at
  ON kochplan_ueberfaellig_log (location_id, logged_at DESC);

-- Phase 1779 Fahrer-App: Schicht-Bilanz (erweiterte Felder)
-- Ergänzt schicht_bilanz_snapshots um km-Tracking
ALTER TABLE schicht_bilanz_snapshots
  ADD COLUMN IF NOT EXISTS km_gesamt NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS durchschnittsbewertung NUMERIC(3,2);

-- Phase 1780 Storefront: Echtzeit-Küchen-Status (erweiterte Config)
-- kuechen-status API nutzt bestehende orders-Tabelle; nur Config-Schwellen
INSERT INTO delivery_config (location_id, key, value, beschreibung)
SELECT
  l.id,
  'kuechen_status_schwelle_beschaeftigt',
  '10',
  'Ab dieser Anzahl aktiver Bestellungen gilt Küche als ''beschäftigt'''
FROM locations l
ON CONFLICT (location_id, key) DO NOTHING;

INSERT INTO delivery_config (location_id, key, value, beschreibung)
SELECT
  l.id,
  'kuechen_status_schwelle_ueberlastet',
  '18',
  'Ab dieser Anzahl aktiver Bestellungen gilt Küche als ''überlastet'''
FROM locations l
ON CONFLICT (location_id, key) DO NOTHING;
