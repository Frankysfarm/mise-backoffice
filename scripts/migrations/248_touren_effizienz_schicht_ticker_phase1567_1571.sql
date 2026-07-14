-- Migration 248: Phasen 1567–1571 — Touren-Effizienz, Schicht-Bestätigung, Ticker
-- 2026-07-14

-- Historische Ranglisten-Daten je Fahrer/Woche (Phase 1567)
CREATE TABLE IF NOT EXISTS touren_effizienz_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  woche_start DATE NOT NULL,
  stopps_pro_tour NUMERIC(5,2) NOT NULL DEFAULT 0,
  km_pro_stopp NUMERIC(5,2),
  puenktlichkeit_pct INTEGER NOT NULL DEFAULT 0,
  touren_total INTEGER NOT NULL DEFAULT 0,
  rang INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('top', 'normal', 'schwach')),
  berechnet_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, driver_id, woche_start)
);

CREATE INDEX IF NOT EXISTS idx_touren_effizienz_snapshots_loc_woche
  ON touren_effizienz_snapshots (location_id, woche_start DESC);

-- Bestätigungsstatus je Schicht (Phase 1570)
CREATE TABLE IF NOT EXISTS fahrer_schicht_bestaetigung (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schicht_id UUID NOT NULL,
  driver_id UUID NOT NULL,
  bestaetigt_am TIMESTAMPTZ,
  bestaetigt BOOLEAN NOT NULL DEFAULT false,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schicht_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_fahrer_schicht_bestaetigung_driver
  ON fahrer_schicht_bestaetigung (driver_id, bestaetigt_am DESC);

-- Ticker-Event-Log für Analytics (Phase 1571)
CREATE TABLE IF NOT EXISTS lieferzeit_ticker_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL,
  order_id UUID,
  status TEXT NOT NULL,
  eta_min INTEGER,
  angezeigt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_lieferzeit_ticker_events_loc
  ON lieferzeit_ticker_events (location_id, angezeigt_am DESC);

-- Zubereitungs-Rückstand-Log (Phase 1568)
CREATE TABLE IF NOT EXISTS zubereitungs_rueckstand_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL,
  order_id UUID NOT NULL,
  elapsed_min NUMERIC(5,2) NOT NULL,
  ziel_min INTEGER NOT NULL DEFAULT 12,
  erkannt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zubereitungs_rueckstand_log_loc
  ON zubereitungs_rueckstand_log (location_id, erkannt_am DESC);
