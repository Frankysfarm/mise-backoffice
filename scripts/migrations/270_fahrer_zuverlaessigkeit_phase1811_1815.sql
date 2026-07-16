-- Phase 1811–1815 Migration
-- Fahrer-Zuverlässigkeits-Index + Parallele-Gericht-Übersicht + Stopp-Abbruch-Monitor

-- Phase 1811: Fahrer-Zuverlässigkeits-Snapshots
CREATE TABLE IF NOT EXISTS fahrer_zuverlaessigkeit_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL,
  fahrer_id       uuid NOT NULL,
  score           smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  ampel           text NOT NULL CHECK (ampel IN ('gruen', 'gelb', 'rot')),
  trend           text NOT NULL CHECK (trend IN ('steigend', 'fallend', 'stabil')),
  trend_delta     smallint NOT NULL DEFAULT 0,
  abbruchquote_pct smallint NOT NULL DEFAULT 0,
  puenktlichkeit_pct smallint NOT NULL DEFAULT 0,
  schichtantritt_pct smallint NOT NULL DEFAULT 0,
  verlauf_7_tage  smallint[] NOT NULL DEFAULT '{}',
  erstellt_am     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fahrer_zuverlaessigkeit_location
  ON fahrer_zuverlaessigkeit_snapshots(location_id, erstellt_am DESC);

CREATE INDEX IF NOT EXISTS idx_fahrer_zuverlaessigkeit_fahrer
  ON fahrer_zuverlaessigkeit_snapshots(fahrer_id, erstellt_am DESC);

-- Phase 1812: Parallele-Gericht-Übersicht Log
CREATE TABLE IF NOT EXISTS parallele_gericht_uebersicht_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL,
  gericht_name    text NOT NULL,
  anzahl_parallel smallint NOT NULL,
  ampel           text NOT NULL CHECK (ampel IN ('gruen', 'gelb', 'rot')),
  erfasst_am      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parallele_gericht_location
  ON parallele_gericht_uebersicht_log(location_id, erfasst_am DESC);

-- Phase 1811 delivery_config Keys
INSERT INTO delivery_config (location_id, key, value)
SELECT id, 'zuverlaessigkeit_gruen_schwelle', '80'
FROM locations
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_config dc
  WHERE dc.location_id = locations.id AND dc.key = 'zuverlaessigkeit_gruen_schwelle'
)
ON CONFLICT DO NOTHING;

INSERT INTO delivery_config (location_id, key, value)
SELECT id, 'zuverlaessigkeit_gelb_schwelle', '60'
FROM locations
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_config dc
  WHERE dc.location_id = locations.id AND dc.key = 'zuverlaessigkeit_gelb_schwelle'
)
ON CONFLICT DO NOTHING;

-- Phase 1812 delivery_config Keys
INSERT INTO delivery_config (location_id, key, value)
SELECT id, 'parallele_gericht_max', '5'
FROM locations
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_config dc
  WHERE dc.location_id = locations.id AND dc.key = 'parallele_gericht_max'
)
ON CONFLICT DO NOTHING;

INSERT INTO delivery_config (location_id, key, value)
SELECT id, 'parallele_gericht_warn_schwelle', '3'
FROM locations
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_config dc
  WHERE dc.location_id = locations.id AND dc.key = 'parallele_gericht_warn_schwelle'
)
ON CONFLICT DO NOTHING;
