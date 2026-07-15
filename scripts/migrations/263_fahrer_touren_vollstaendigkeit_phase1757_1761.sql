-- Migration 263: Fahrer-Touren-Vollständigkeit + Bestellwert-Verteilung
-- Phasen 1757–1761
-- 2026-07-15

-- Audit-Log: Touren-Abschluss vs. Abbruch je Fahrer
CREATE TABLE IF NOT EXISTS fahrer_touren_vollstaendigkeit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL,
  fahrer_id     UUID NOT NULL,
  datum         DATE NOT NULL DEFAULT CURRENT_DATE,
  touren_gesamt INTEGER NOT NULL DEFAULT 0,
  abgeschlossen INTEGER NOT NULL DEFAULT 0,
  abgebrochen   INTEGER NOT NULL DEFAULT 0,
  quote_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,
  erfasst_am    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, fahrer_id, datum)
);

CREATE INDEX IF NOT EXISTS idx_fahrer_touren_vollst_loc_datum
  ON fahrer_touren_vollstaendigkeit_log (location_id, datum);

-- Tages-Snapshot Bestellwert-Verteilung je Location
CREATE TABLE IF NOT EXISTS bestellwert_verteilung_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL,
  datum         DATE NOT NULL DEFAULT CURRENT_DATE,
  avg_wert      NUMERIC(8,2) NOT NULL DEFAULT 0,
  bucket_u20    INTEGER NOT NULL DEFAULT 0,
  bucket_20_40  INTEGER NOT NULL DEFAULT 0,
  bucket_ue40   INTEGER NOT NULL DEFAULT 0,
  total         INTEGER NOT NULL DEFAULT 0,
  erfasst_am    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, datum)
);

CREATE INDEX IF NOT EXISTS idx_bestellwert_verteilung_loc_datum
  ON bestellwert_verteilung_snapshots (location_id, datum);

-- Log angezeigter Zufriedenheits-Garantie-Badges je Location
CREATE TABLE IF NOT EXISTS zufriedenheits_garantie_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID NOT NULL,
  puenktlichkeit    NUMERIC(5,2) NOT NULL,
  feedback_pct      NUMERIC(5,2) NOT NULL,
  aktiv             BOOLEAN NOT NULL DEFAULT TRUE,
  angezeigt_am      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zufriedenheits_garantie_loc
  ON zufriedenheits_garantie_log (location_id, angezeigt_am DESC);

-- delivery_config Keys für Phase 1757–1761
INSERT INTO delivery_config (key, value, beschreibung) VALUES
  ('touren_vollst_alert_schwelle', '80',  'Abschlussquote-Schwelle % für Alert im Touren-Monitor (Phase 1759)'),
  ('garantie_puenktlichkeit_min',  '90',  'Min. Pünktlichkeit % für Zufriedenheits-Garantie-Badge (Phase 1761)'),
  ('garantie_feedback_min',        '90',  'Min. Feedback % für Zufriedenheits-Garantie-Badge (Phase 1761)'),
  ('bestellwert_bucket1_max',      '20',  'Obere Grenze Bucket 1 "unter X €" für Bestellwert-Histogramm (Phase 1758)'),
  ('bestellwert_bucket2_max',      '40',  'Obere Grenze Bucket 2 "bis X €" für Bestellwert-Histogramm (Phase 1758)')
ON CONFLICT (key) DO NOTHING;
