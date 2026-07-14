-- Migration 237: Zonen-Effizienz-Vergleich + Kilometerstand-Tracker + Bestellstatus-Verlauf
-- Phase 1507–1511

-- Zonen-Effizienz-Snapshots für Vergleichs-API
CREATE TABLE IF NOT EXISTS zonen_effizienz_snapshots (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id                 UUID NOT NULL,
  zone_name                   TEXT NOT NULL CHECK (zone_name IN ('A', 'B', 'C', 'D')),
  datum                       DATE NOT NULL DEFAULT CURRENT_DATE,
  bestellungen_heute          INTEGER NOT NULL DEFAULT 0,
  puenktlichkeit_pct          INTEGER NOT NULL DEFAULT 0 CHECK (puenktlichkeit_pct BETWEEN 0 AND 100),
  lieferzeit_mittel_min       INTEGER NOT NULL DEFAULT 0,
  status                      TEXT CHECK (status IN ('gut', 'normal', 'kritisch')),
  erfasst_am                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zonen_effizienz_snap_location
  ON zonen_effizienz_snapshots (location_id, datum DESC);

CREATE INDEX IF NOT EXISTS idx_zonen_effizienz_snap_zone
  ON zonen_effizienz_snapshots (location_id, zone_name, datum DESC);

-- Kapazitäts-Indikator-Log (für Phase 1508 Analytics)
CREATE TABLE IF NOT EXISTS kapazitaets_indikator_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL,
  aktiv           INTEGER NOT NULL DEFAULT 0,
  max_kapazitaet  INTEGER NOT NULL DEFAULT 5,
  auslastung_pct  INTEGER NOT NULL DEFAULT 0,
  ampel_status    TEXT CHECK (ampel_status IN ('gruen', 'gelb', 'rot')),
  erfasst_am      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kapazitaets_indikator_location
  ON kapazitaets_indikator_log (location_id, erfasst_am DESC);

-- Kilometerstand-Log je Fahrer (Phase 1510)
CREATE TABLE IF NOT EXISTS fahrer_kilometerstand_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fahrer_id       UUID NOT NULL,
  datum           DATE NOT NULL DEFAULT CURRENT_DATE,
  km_gesamt       NUMERIC(8,2) NOT NULL DEFAULT 0,
  km_je_tour      NUMERIC(6,2) NOT NULL DEFAULT 0,
  touren_anzahl   INTEGER NOT NULL DEFAULT 0,
  erfasst_am      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fahrer_kmstand_fahrer
  ON fahrer_kilometerstand_log (fahrer_id, datum DESC);

-- Bestellstatus-Verlaufs-Log (für Phase 1511 Analytics)
CREATE TABLE IF NOT EXISTS bestellstatus_verlaufs_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL,
  order_id      UUID NOT NULL,
  status        TEXT NOT NULL,
  erfasst_am    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bestellstatus_verlauf_location
  ON bestellstatus_verlaufs_log (location_id, erfasst_am DESC);

CREATE INDEX IF NOT EXISTS idx_bestellstatus_verlauf_order
  ON bestellstatus_verlaufs_log (order_id, erfasst_am DESC);
