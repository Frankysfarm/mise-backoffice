-- Migration 243: Zonen-Belastungs-Monitor, Zubereitungs-Effizienz, Zonen-Tipp, Mindestbestellwert
-- Phasen 1537–1541

-- Phase 1537: Zonen-Belastungs-Snapshots
CREATE TABLE IF NOT EXISTS zonen_belastungs_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  zone TEXT NOT NULL,
  aktive_fahrer INT NOT NULL DEFAULT 0,
  wartende_bestellungen INT NOT NULL DEFAULT 0,
  avg_wartezeit_min INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('überlastet', 'normal', 'frei')),
  erfasst_um TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zonen_belastungs_snapshots_zone ON zonen_belastungs_snapshots(zone);
CREATE INDEX IF NOT EXISTS idx_zonen_belastungs_snapshots_erfasst_um ON zonen_belastungs_snapshots(erfasst_um DESC);

-- Phase 1538: Zubereitungs-Effizienz-Log
CREATE TABLE IF NOT EXISTS zubereitungs_effizienz_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kategorie TEXT NOT NULL,
  avg_min NUMERIC(5,2) NOT NULL,
  ziel_min NUMERIC(5,2) NOT NULL,
  erfasst_am DATE NOT NULL DEFAULT CURRENT_DATE,
  erfasst_um TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zubereitungs_effizienz_log_datum ON zubereitungs_effizienz_log(erfasst_am DESC);

-- Phase 1540: Zonen-Tipp-Log (Fahrer-App-Clicks)
CREATE TABLE IF NOT EXISTS fahrer_zonen_tipp_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT,
  zone TEXT NOT NULL,
  erfasst_um TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase 1541: Mindestbestellwert-Fortschritt-Impressions
CREATE TABLE IF NOT EXISTS mindestbestellwert_fortschritt_impressions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id TEXT,
  cart_total_cents INT NOT NULL,
  min_order_cents INT NOT NULL,
  erfasst_um TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mindestbestellwert_impressions_location ON mindestbestellwert_fortschritt_impressions(location_id);
