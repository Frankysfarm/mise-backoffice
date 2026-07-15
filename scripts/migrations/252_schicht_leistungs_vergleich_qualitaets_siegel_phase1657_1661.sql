-- Migration 252 — Phase 1657–1661
-- Schicht-Leistungs-Vergleich, Rezept-Auslastung, Lern-Tipps, Liefer-Qualitäts-Siegel

-- ────────────────────────────────────────────────────────────────────────────
-- 1. schicht_leistungs_snapshots
--    Historische Fahrer-Leistung je Schicht für Trend-Vergleiche (Phase 1657)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schicht_leistungs_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id      uuid NOT NULL,
  schicht_datum  date NOT NULL,
  stopps_gesamt  integer NOT NULL DEFAULT 0,
  schicht_stunden numeric(5,2) NOT NULL DEFAULT 0,
  stopps_h       numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN schicht_stunden > 0 THEN stopps_gesamt / schicht_stunden ELSE 0 END
  ) STORED,
  lieferzeit_avg_min numeric(6,2),
  sla_quote_pct  smallint,          -- 0–100
  bewertung_avg  numeric(3,2),
  erstellt_am    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schicht_leistung_driver_datum
  ON schicht_leistungs_snapshots (driver_id, schicht_datum DESC);

CREATE INDEX IF NOT EXISTS idx_schicht_leistung_location_datum
  ON schicht_leistungs_snapshots (location_id, schicht_datum DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. rezept_auslastungs_log
--    Überlast-Events wenn >N gleiche Gerichte gleichzeitig (Phase 1658)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rezept_auslastungs_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  product_name   text NOT NULL,
  gleichzeitig   smallint NOT NULL,
  schwelle       smallint NOT NULL DEFAULT 4,
  erfasst_am     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rezept_auslastung_location_zeit
  ON rezept_auslastungs_log (location_id, erfasst_am DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. fahrer_lern_tipps
--    Gespeicherte Tipps je Fahrer (Cache, Phase 1660)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fahrer_lern_tipps (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      uuid NOT NULL,
  tipp_id        text NOT NULL,
  titel          text NOT NULL,
  beschreibung   text,
  kategorie      text NOT NULL,  -- zeit / zone / rating / route / pause
  prioritaet     text NOT NULL,  -- hoch / mittel / niedrig
  gelesen        boolean NOT NULL DEFAULT false,
  erstellt_am    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (driver_id, tipp_id)
);

CREATE INDEX IF NOT EXISTS idx_lern_tipps_driver
  ON fahrer_lern_tipps (driver_id, erstellt_am DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. liefer_qualitaets_siegel_cache
--    Cache für öffentlich sichtbare Qualitätsdaten je Location (Phase 1661)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS liefer_qualitaets_siegel_cache (
  location_id       uuid PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  puenktlich_pct    smallint NOT NULL DEFAULT 0,
  bewertung_avg     numeric(3,2),
  bewertung_count   integer NOT NULL DEFAULT 0,
  lieferzeit_avg_min smallint,
  zeitraum_tage     smallint NOT NULL DEFAULT 30,
  berechnet_am      timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. delivery_config: Rezept-Auslastungs-Schwelle je Location
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE delivery_config
  ADD COLUMN IF NOT EXISTS rezept_ueberlast_schwelle smallint NOT NULL DEFAULT 4;
