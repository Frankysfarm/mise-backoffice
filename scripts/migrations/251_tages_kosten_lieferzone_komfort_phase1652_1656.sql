-- Migration 251: Tages-Kosten, Lieferzone-Info, Fahrer-Komfort-Snapshots (Phase 1652–1656)
-- 2026-07-15

-- Tages-Budget-Konfiguration (erweitert delivery_config)
-- config_key = 'tages_budget_eur' → config_value = 500.00 (Float)
-- Bereits über delivery_config abgebildet — kein Schema-Change notwendig.

-- Lieferzone-Konfiguration (öffentlich lesbar, kein Auth)
CREATE TABLE IF NOT EXISTS delivery_zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  zone_label    TEXT NOT NULL CHECK (zone_label IN ('A','B','C','D')),
  radius_km     NUMERIC(5,2) NOT NULL DEFAULT 5,
  eta_min       INTEGER NOT NULL DEFAULT 30,
  aktiv         BOOLEAN NOT NULL DEFAULT TRUE,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, zone_label)
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_location ON delivery_zones(location_id);

-- Tages-Kosten-Snapshots für Trend-Analyse
CREATE TABLE IF NOT EXISTS tages_kosten_snapshots (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id              UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  datum                    DATE NOT NULL,
  materialkosten_summe_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  budget_limit_eur         NUMERIC(10,2) NOT NULL DEFAULT 500,
  auslastungsgrad_pct      NUMERIC(5,1) NOT NULL DEFAULT 0,
  ampel                    TEXT NOT NULL DEFAULT 'normal',
  erfasst_am               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, datum)
);

CREATE INDEX IF NOT EXISTS idx_tages_kosten_snapshots_location_datum ON tages_kosten_snapshots(location_id, datum);

-- Fahrer-Komfort-Snapshots (Phase 1651/1653/1654)
CREATE TABLE IF NOT EXISTS fahrer_komfort_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id         UUID NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  location_id       UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  datum             DATE NOT NULL,
  pausen_minuten    INTEGER NOT NULL DEFAULT 0,
  km_gesamt         NUMERIC(8,1) NOT NULL DEFAULT 0,
  tour_anzahl       INTEGER NOT NULL DEFAULT 0,
  komfort_score     INTEGER NOT NULL DEFAULT 0,
  empfehlung        TEXT NOT NULL DEFAULT 'weiter',
  erfasst_am        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fahrer_komfort_snapshots_driver_datum ON fahrer_komfort_snapshots(driver_id, datum);
CREATE INDEX IF NOT EXISTS idx_fahrer_komfort_snapshots_location ON fahrer_komfort_snapshots(location_id);
