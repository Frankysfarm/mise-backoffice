-- Migration 268: Schicht-Qualitäts-Score Phasen 1796–1800
-- Erstellt Tabellen für Qualitäts-Score-Tracking je Fahrer-Schicht

-- Schicht-Qualitäts-Score-Snapshots (täglich je Fahrer)
CREATE TABLE IF NOT EXISTS schicht_qualitaet_snapshots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  uuid NOT NULL,
  fahrer_id    uuid NOT NULL,
  datum        date NOT NULL,
  score        integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  grade        char(1) NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D')),
  puenktlichkeit_pct  integer NOT NULL CHECK (puenktlichkeit_pct BETWEEN 0 AND 100),
  bewertung_avg       numeric(3, 1) NOT NULL CHECK (bewertung_avg BETWEEN 1.0 AND 5.0),
  vollstaendigkeit_pct integer NOT NULL CHECK (vollstaendigkeit_pct BETWEEN 0 AND 100),
  erstellt_am  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, fahrer_id, datum)
);

CREATE INDEX IF NOT EXISTS idx_schicht_qualitaet_fahrer_datum
  ON schicht_qualitaet_snapshots (location_id, fahrer_id, datum DESC);

-- Rezept-Kompatibilitäts-Log (Allergen-Konflikte)
CREATE TABLE IF NOT EXISTS rezept_kompatibilitaet_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  uuid NOT NULL,
  konflikt_art varchar(20) NOT NULL CHECK (konflikt_art IN ('allergen', 'timing')),
  schwere      varchar(10) NOT NULL CHECK (schwere IN ('kritisch', 'hinweis')),
  beschreibung text NOT NULL,
  bestellungen uuid[] NOT NULL DEFAULT '{}',
  erstellt_am  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rezept_kompatibilitaet_location_datum
  ON rezept_kompatibilitaet_log (location_id, erstellt_am DESC);

-- Qualitäts-Versprechen-Badge-Log (wann wurde welcher Fahrer angezeigt)
CREATE TABLE IF NOT EXISTS qualitaets_versprechen_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL,
  fahrer_id       uuid NOT NULL,
  bewertung_avg   numeric(3, 1) NOT NULL,
  score           integer NOT NULL,
  angezeigt_am    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qualitaets_versprechen_location
  ON qualitaets_versprechen_log (location_id, angezeigt_am DESC);

-- delivery_config Schwellwerte für Phase 1796–1800
INSERT INTO delivery_config (location_id, key, value, beschreibung)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'qualitaet_score_schwelle_a', '85', 'Mindest-Score für Grade A'),
  ('00000000-0000-0000-0000-000000000000', 'qualitaet_score_schwelle_b', '70', 'Mindest-Score für Grade B'),
  ('00000000-0000-0000-0000-000000000000', 'qualitaet_score_schwelle_c', '55', 'Mindest-Score für Grade C'),
  ('00000000-0000-0000-0000-000000000000', 'qualitaet_top_fahrer_bewertung_min', '4.8', 'Mindest-Bewertung für Top-Fahrer-Badge'),
  ('00000000-0000-0000-0000-000000000000', 'rezept_max_parallele_zubereitungen', '4', 'Max. parallele Zubereitungen vor Timing-Warnung')
ON CONFLICT (location_id, key) DO NOTHING;
