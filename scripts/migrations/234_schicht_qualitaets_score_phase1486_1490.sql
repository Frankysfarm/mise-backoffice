-- Phase 1486–1490: Schicht-Qualitäts-Score, Bestelleingang-Takt, Qualitäts-Widget, Routen-Effizienz, MOV-Badge
-- Migration 234

-- Schicht-Qualitäts-Score-Snapshots (Phase 1486)
CREATE TABLE IF NOT EXISTS schicht_qualitaets_score_snapshots (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id   uuid NOT NULL,
  datum         date NOT NULL,
  gesamt_score  numeric(5,2) NOT NULL,
  vorwoche_score numeric(5,2),
  delta         numeric(5,2),
  trend         text CHECK (trend IN ('besser','gleich','schlechter')),
  puenktlichkeit_pct numeric(5,2),
  bewertung_pct      numeric(5,2),
  storno_inv_pct     numeric(5,2),
  verfuegbarkeit_pct numeric(5,2),
  generiert_am  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS schicht_qualitaets_score_snapshots_loc_datum_idx
  ON schicht_qualitaets_score_snapshots (location_id, datum DESC);

-- Bestelleingang-Takt-Log (Phase 1487 — kitchen panel data)
CREATE TABLE IF NOT EXISTS bestelleingang_takt_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id uuid NOT NULL,
  slot_start  timestamptz NOT NULL,
  anzahl      int NOT NULL DEFAULT 0,
  ist_peak    boolean NOT NULL DEFAULT false,
  erfasst_am  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS bestelleingang_takt_log_loc_slot_idx
  ON bestelleingang_takt_log (location_id, slot_start DESC);

-- Routen-Effizienz-Log (Phase 1489 — driver route efficiency)
CREATE TABLE IF NOT EXISTS routen_effizienz_log (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id           uuid NOT NULL,
  fahrer_id             uuid NOT NULL,
  datum                 date NOT NULL,
  stopps_pro_stunde     numeric(5,2),
  avg_km_pro_stopp      numeric(6,3),
  team_stopps_pro_stunde numeric(5,2),
  team_avg_km_pro_stopp  numeric(6,3),
  rang                  int,
  total_fahrer          int,
  erfasst_am            timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS routen_effizienz_log_loc_fahrer_datum_idx
  ON routen_effizienz_log (location_id, fahrer_id, datum DESC);
