-- Migration 254 — Phasen 1672–1676
-- Zonen-Kapazitäts-Auslastung, Bestellungs-Volumen-Heatmap

-- Kapazitäts-Snapshots je Zone für historische Auslastungsanalyse
CREATE TABLE IF NOT EXISTS zonen_kapazitaets_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL,
  zone          TEXT NOT NULL CHECK (zone IN ('A','B','C','D')),
  fahrer_aktiv  INT  NOT NULL DEFAULT 0,
  fahrer_kap    INT  NOT NULL DEFAULT 3,
  auslastung_pct INT NOT NULL DEFAULT 0,
  ampel         TEXT NOT NULL DEFAULT 'normal',
  snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zonen_kap_snapshots_loc_at
  ON zonen_kapazitaets_snapshots (location_id, snapshot_at DESC);

-- Bestellungs-Volumen-Aggregat je Stunde/Wochentag für Heatmap-Persistenz
CREATE TABLE IF NOT EXISTS bestell_volumen_heatmap (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL,
  wochentag     SMALLINT NOT NULL CHECK (wochentag BETWEEN 0 AND 6), -- 0=Mo, 6=So
  stunde        SMALLINT NOT NULL CHECK (stunde BETWEEN 0 AND 23),
  bestellungen  INT NOT NULL DEFAULT 0,
  datum         DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bestell_volumen_heatmap_unique
  ON bestell_volumen_heatmap (location_id, datum, wochentag, stunde);

CREATE INDEX IF NOT EXISTS idx_bestell_volumen_heatmap_loc_datum
  ON bestell_volumen_heatmap (location_id, datum DESC);

-- Kapazitäts-Alert-Log für Überlastungs-Ereignisse
CREATE TABLE IF NOT EXISTS kapazitaets_alert_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL,
  zone          TEXT,
  ampel_vorher  TEXT NOT NULL,
  ampel_nachher TEXT NOT NULL,
  ausloest_am   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kapazitaets_alert_loc_at
  ON kapazitaets_alert_log (location_id, ausloest_am DESC);
