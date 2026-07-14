-- Migration 229 — Fahrer-Qualitäts-Score + Wochen-Rückblick (Phasen 1454–1458)
-- Erstellt: 2026-07-14

-- Fahrer-Qualitäts-Score-Log (Phase 1454)
CREATE TABLE IF NOT EXISTS fahrer_qualitaets_score (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id             UUID NOT NULL,
  fahrer_id               UUID NOT NULL,
  berechnungs_datum       DATE NOT NULL DEFAULT CURRENT_DATE,
  gesamt_score            SMALLINT NOT NULL CHECK (gesamt_score BETWEEN 0 AND 100),
  puenktlichkeits_score   SMALLINT NOT NULL CHECK (puenktlichkeits_score BETWEEN 0 AND 100),
  bewertungs_score        SMALLINT NOT NULL CHECK (bewertungs_score BETWEEN 0 AND 100),
  streak_bonus_score      SMALLINT NOT NULL CHECK (streak_bonus_score BETWEEN 0 AND 100),
  puenktlichkeits_quote   NUMERIC(4,3),
  bewertungs_avg          NUMERIC(3,2),
  streak_tage             INTEGER NOT NULL DEFAULT 0,
  rang                    SMALLINT,
  trend                   VARCHAR(10) DEFAULT 'stable' CHECK (trend IN ('up', 'down', 'stable')),
  erstellt_am             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, fahrer_id, berechnungs_datum)
);

CREATE INDEX IF NOT EXISTS idx_fqs_location_datum
  ON fahrer_qualitaets_score (location_id, berechnungs_datum DESC);

CREATE INDEX IF NOT EXISTS idx_fqs_fahrer
  ON fahrer_qualitaets_score (fahrer_id, berechnungs_datum DESC);

-- Wochen-Rückblick-Cache je Fahrer (Phase 1457)
CREATE TABLE IF NOT EXISTS fahrer_wochen_rueckblick (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID NOT NULL,
  fahrer_id           UUID NOT NULL,
  woche_start         DATE NOT NULL,  -- Montag der Woche
  gesamt_stopps       INTEGER NOT NULL DEFAULT 0,
  gesamt_km           NUMERIC(8,2)  NOT NULL DEFAULT 0,
  bester_tag_datum    DATE,
  bester_tag_stopps   INTEGER NOT NULL DEFAULT 0,
  avg_stopps_pro_tag  NUMERIC(5,2),
  trend               VARCHAR(10) DEFAULT 'stable' CHECK (trend IN ('up', 'down', 'stable')),
  tag_daten           JSONB,          -- Array TagDaten[]
  erstellt_am         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, fahrer_id, woche_start)
);

CREATE INDEX IF NOT EXISTS idx_fwr_fahrer_woche
  ON fahrer_wochen_rueckblick (fahrer_id, woche_start DESC);

-- Treue-Programm-Teilnahme (Phase 1458)
CREATE TABLE IF NOT EXISTS customer_treue_programm (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL,
  customer_id     UUID,
  email           TEXT,
  eingeladen_am   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  beigetreten_am  TIMESTAMPTZ,
  rabatt_aktiv    BOOLEAN NOT NULL DEFAULT false,
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctp_location
  ON customer_treue_programm (location_id, eingeladen_am DESC);

COMMENT ON TABLE fahrer_qualitaets_score   IS 'Täglicher Qualitäts-Score je Fahrer (Phase 1454)';
COMMENT ON TABLE fahrer_wochen_rueckblick  IS 'Wöchentliche Fahrer-Leistungs-Zusammenfassung (Phase 1457)';
COMMENT ON TABLE customer_treue_programm   IS 'Treue-Programm-Teilnahme nach 3. Bestellung (Phase 1458)';
