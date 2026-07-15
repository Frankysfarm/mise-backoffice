-- Migration 265: Fahrer-Einnahmen-Prognose + Gericht-Warteschlange + Fahrer-Profil-Badge
-- Phasen 1771–1775

-- Phase 1771/1773: Fahrer-Einnahmen-Prognose-Cache
-- Caches predicted shift earnings per driver per location per day
CREATE TABLE IF NOT EXISTS fahrer_einnahmen_prognose_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL,
  driver_id     UUID NOT NULL,
  datum         DATE NOT NULL DEFAULT CURRENT_DATE,
  einnahmen_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  prognose_eur  NUMERIC(10,2) NOT NULL DEFAULT 0,
  trend         TEXT CHECK (trend IN ('up','down','gleich')) DEFAULT 'gleich',
  trend_pct     INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, driver_id, datum)
);

-- Phase 1772: Gericht-Warteschlangen-Log
-- Records when a dish exceeded the wait-time alert threshold
CREATE TABLE IF NOT EXISTS gericht_warteschlange_alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID NOT NULL,
  gericht_name        TEXT NOT NULL,
  anzahl_in_queue     INT NOT NULL DEFAULT 0,
  aelteste_min        INT NOT NULL DEFAULT 0,
  avg_wartezeit_min   INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase 1774: Driver Shift Goals (referenced by schicht-einnahmen-zaehler API)
CREATE TABLE IF NOT EXISTS driver_shift_goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      UUID NOT NULL,
  location_id    UUID,
  ziel_eur       NUMERIC(10,2) NOT NULL DEFAULT 150.00,
  schicht_dauer_h NUMERIC(4,1) NOT NULL DEFAULT 8,
  gueltig_ab     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase 1775: Fahrer-Profil-Badge-Cache (public, per location)
-- Caches the most recently assigned active driver for a location
CREATE TABLE IF NOT EXISTS fahrer_profil_badge_cache (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id        UUID NOT NULL,
  driver_id          UUID NOT NULL,
  vorname            TEXT NOT NULL,
  nachname_initial   CHAR(1),
  bewertung          NUMERIC(3,2) NOT NULL DEFAULT 4.5,
  touren_heute       INT NOT NULL DEFAULT 0,
  aktualisiert_am    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id)
);

-- delivery_config keys for Phase 1771–1775
INSERT INTO delivery_config (key, value, beschreibung, updated_at)
VALUES
  ('einnahmen_prognose_ziel_eur',        '150.00',  'Standard-Schichtziel in Euro je Fahrer', NOW()),
  ('gericht_warteschlange_alert_min',    '15',      'Wartezeit-Schwelle in Minuten für Gericht-Warteschlangen-Alert (Kitchen)', NOW()),
  ('schicht_prognose_stunden',           '8',       'Standard-Schichtdauer in Stunden für Einnahmen-Prognose', NOW())
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  beschreibung = EXCLUDED.beschreibung,
  updated_at = EXCLUDED.updated_at;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fahrer_einnahmen_prognose_location_datum
  ON fahrer_einnahmen_prognose_cache (location_id, datum);

CREATE INDEX IF NOT EXISTS idx_gericht_warteschlange_location_created
  ON gericht_warteschlange_alerts (location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_driver_shift_goals_driver
  ON driver_shift_goals (driver_id, gueltig_ab DESC);

CREATE INDEX IF NOT EXISTS idx_fahrer_profil_badge_location
  ON fahrer_profil_badge_cache (location_id);
