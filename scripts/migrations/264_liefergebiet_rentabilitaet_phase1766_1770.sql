-- Migration 264: Liefergebiet-Rentabilität + Zubereitungszeit-Ausreißer + Nachhaltigkeits-Badge
-- Phasen 1766–1770
-- 2026-07-15

-- Tages-Snapshot Liefergebiet-Rentabilität je Zone
CREATE TABLE IF NOT EXISTS liefergebiet_rentabilitaet_snapshots (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id            UUID NOT NULL,
  datum                  DATE NOT NULL DEFAULT CURRENT_DATE,
  zone                   CHAR(1) NOT NULL CHECK (zone IN ('A', 'B', 'C', 'D')),
  umsatz_eur             NUMERIC(10,2) NOT NULL DEFAULT 0,
  lieferkosten_eur       NUMERIC(10,2) NOT NULL DEFAULT 0,
  roi_pct                INTEGER NOT NULL DEFAULT 0,
  bestellungen           INTEGER NOT NULL DEFAULT 0,
  avg_umsatz_pro_best    NUMERIC(8,2) NOT NULL DEFAULT 0,
  avg_kosten_pro_best    NUMERIC(8,2) NOT NULL DEFAULT 0,
  erfasst_am             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, datum, zone)
);

CREATE INDEX IF NOT EXISTS idx_liefergebiet_rentab_loc_datum
  ON liefergebiet_rentabilitaet_snapshots (location_id, datum DESC);

-- Zubereitungszeit-Ausreißer-Log je Gericht
CREATE TABLE IF NOT EXISTS zubereitungszeit_ausreisser_log (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id            UUID NOT NULL,
  datum                  DATE NOT NULL DEFAULT CURRENT_DATE,
  gericht_name           TEXT NOT NULL,
  avg_soll_min           NUMERIC(6,1) NOT NULL DEFAULT 0,
  avg_ist_min            NUMERIC(6,1) NOT NULL DEFAULT 0,
  abweichung_pct         INTEGER NOT NULL DEFAULT 0,
  messungen              INTEGER NOT NULL DEFAULT 0,
  erfasst_am             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, datum, gericht_name)
);

CREATE INDEX IF NOT EXISTS idx_zubereitungszeit_ausreisser_loc_datum
  ON zubereitungszeit_ausreisser_log (location_id, datum DESC);

-- Zonen-Verdienst-Vergleich je Fahrer (7-Tage-Cache)
CREATE TABLE IF NOT EXISTS fahrer_zonen_verdienst_cache (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fahrer_id              UUID NOT NULL,
  zone                   CHAR(1) NOT NULL CHECK (zone IN ('A', 'B', 'C', 'D')),
  touren                 INTEGER NOT NULL DEFAULT 0,
  gesamt_verdienst_eur   NUMERIC(10,2) NOT NULL DEFAULT 0,
  avg_verdienst_eur      NUMERIC(8,2) NOT NULL DEFAULT 0,
  avg_dauer_min          INTEGER NOT NULL DEFAULT 0,
  verdienst_pro_stunde   NUMERIC(8,2) NOT NULL DEFAULT 0,
  berechnet_am           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (fahrer_id, zone)
);

CREATE INDEX IF NOT EXISTS idx_fahrer_zonen_verdienst_fahrer
  ON fahrer_zonen_verdienst_cache (fahrer_id, berechnet_am DESC);

-- Tour-Auslastungs-Status-Log (für Nachhaltigkeits-Badge)
CREATE TABLE IF NOT EXISTS tour_auslastungs_status_log (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id            UUID NOT NULL,
  klimaoptimiert         BOOLEAN NOT NULL DEFAULT FALSE,
  avg_stopps_pro_tour    NUMERIC(4,1) NOT NULL DEFAULT 0,
  auslastung_pct         INTEGER NOT NULL DEFAULT 0,
  aktive_touren          INTEGER NOT NULL DEFAULT 0,
  erfasst_am             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tour_auslastungs_status_loc
  ON tour_auslastungs_status_log (location_id, erfasst_am DESC);

-- delivery_config Keys für Phase 1766–1770
INSERT INTO delivery_config (key, value, beschreibung) VALUES
  ('rentabilitaet_cost_per_km',        '0.35', 'Lieferkosten €/km Schätzwert für Zonen-ROI-Berechnung (Phase 1766)'),
  ('rentabilitaet_kapazitaet_tour',    '5',    'Angenommene Kapazität (max. Stopps) je Tour für Auslastungs-% (Phase 1770)'),
  ('ausreisser_schwelle_pct',          '50',   'Ab welcher %-Abweichung gilt ein Gericht als Ausreißer (Phase 1767)'),
  ('tour_auslastung_min_pct',          '80',   'Mindest-Auslastung % für Klimaoptimiert-Badge (Phase 1770)'),
  ('tour_auslastung_min_stopps',       '3',    'Mindest-Ø-Stopps je Tour für Klimaoptimiert-Badge (Phase 1770)'),
  ('zone_a_radius_km',                 '2',    'Außenradius Zone A in km (Phase 1766/1768)'),
  ('zone_b_radius_km',                 '4',    'Außenradius Zone B in km (Phase 1766/1768)'),
  ('zone_c_radius_km',                 '7',    'Außenradius Zone C in km (Phase 1766/1768)')
ON CONFLICT (key) DO NOTHING;
