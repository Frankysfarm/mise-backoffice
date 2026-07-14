-- Migration 244: Phasen 1542–1546
-- Fahrer-Verfügbarkeits-Kalender + Bestellwellen-Prognose + Lieferfenster-Auswahl

-- Phase 1542: Schicht-Bestätigungsstatus (driver_shifts erweitern)
ALTER TABLE driver_shifts
  ADD COLUMN IF NOT EXISTS confirmation_status TEXT CHECK (confirmation_status IN ('offen','bestaetigt','abgelehnt')) DEFAULT 'offen',
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- Phase 1545: Schicht-Bestätigungs-Log
CREATE TABLE IF NOT EXISTS schicht_bestaetigungs_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id  TEXT NOT NULL,
  shift_id   TEXT NOT NULL,
  aktion     TEXT NOT NULL CHECK (aktion IN ('bestaetigt','abgelehnt')),
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sbl_driver ON schicht_bestaetigungs_log(driver_id);
CREATE INDEX IF NOT EXISTS idx_sbl_shift ON schicht_bestaetigungs_log(shift_id);

-- Phase 1543: Bestellwellen-Prognose-Log (Kitchen)
CREATE TABLE IF NOT EXISTS bestellwellen_prognose_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id TEXT NOT NULL,
  slot_uhrzeit TEXT NOT NULL,
  niveau      TEXT NOT NULL,
  prognose    INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bwpl_location ON bestellwellen_prognose_log(location_id);

-- Phase 1546: Lieferfenster-Impressions-Log (Storefront)
CREATE TABLE IF NOT EXISTS lieferfenster_auswahl_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  TEXT NOT NULL,
  offset_min   INT NOT NULL,
  session_id   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lal_location ON lieferfenster_auswahl_log(location_id);

-- Phase 1544: Verfügbarkeits-Lücken-Snapshot
CREATE TABLE IF NOT EXISTS verfuegbarkeits_luecken_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   TEXT NOT NULL,
  datum         DATE NOT NULL,
  uhrzeit       TEXT NOT NULL,
  fahrer_count  INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vls_location_datum ON verfuegbarkeits_luecken_snapshots(location_id, datum);
