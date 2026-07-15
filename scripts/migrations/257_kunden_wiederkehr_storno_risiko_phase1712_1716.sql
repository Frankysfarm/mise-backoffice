-- Migration 257: Kunden-Wiederkehr-Rate + Storno-Risiko-Ampel (Phasen 1712–1716)
-- Phase 1712: Kunden-Wiederkehr-Rate-API
-- Phase 1713: Storno-Risiko-Ampel (Kitchen)
-- Phase 1714: Kunden-Wiederkehr-Rate-Widget (Dispatch)
-- Phase 1715: Tages-Ziel-Kurzübersicht (Fahrer-App)
-- Phase 1716: Beliebteste-Gerichte-Strip (Storefront)

-- Kunden-Wiederkehrkunden-Snapshots für Trend-Analyse
CREATE TABLE IF NOT EXISTS kunden_wiederkehr_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL,
  datum           date NOT NULL,
  kunden_gesamt   integer NOT NULL DEFAULT 0,
  kunden_wiederkehrend integer NOT NULL DEFAULT 0,
  wiederkehr_pct  numeric(5,2) NOT NULL DEFAULT 0,
  zone            text,
  erstellt_am     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, datum, zone)
);
CREATE INDEX IF NOT EXISTS idx_kunden_wiederkehr_location_datum ON kunden_wiederkehr_snapshots (location_id, datum DESC);

-- Storno-Risiko-Log: überfällige Bestellungen in Zubereitung
CREATE TABLE IF NOT EXISTS storno_risiko_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    uuid NOT NULL,
  order_id       uuid NOT NULL,
  warte_min      integer NOT NULL,
  stufe          text NOT NULL CHECK (stufe IN ('warn', 'kritisch')),
  erfasst_am     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_storno_risiko_location ON storno_risiko_log (location_id, erfasst_am DESC);

-- Beliebteste Gerichte Cache je Location (täglich)
CREATE TABLE IF NOT EXISTS beliebteste_gerichte_cache (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    uuid NOT NULL,
  datum          date NOT NULL,
  rang           smallint NOT NULL,
  name           text NOT NULL,
  bestellungen   integer NOT NULL DEFAULT 0,
  kategorie      text,
  erstellt_am    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, datum, rang)
);
CREATE INDEX IF NOT EXISTS idx_beliebteste_gerichte_location_datum ON beliebteste_gerichte_cache (location_id, datum DESC);

-- delivery_config Schlüssel für neue Phasen
INSERT INTO delivery_config (key, value, beschreibung)
VALUES
  ('storno_risiko_warn_min',   '15',  'Minuten in Zubereitung ab denen Storno-Risiko-Warnung ausgelöst wird'),
  ('storno_risiko_kritisch_multiplier', '2', 'Faktor auf warn_min für kritische Stufe (Standard: 2x)'),
  ('kunden_wiederkehr_ziel_pct', '40', 'Ziel-Wiederkehrrate in % je Location'),
  ('beliebteste_gerichte_top_n',  '3',  'Anzahl Top-Gerichte im Storefront-Strip')
ON CONFLICT (key) DO NOTHING;
