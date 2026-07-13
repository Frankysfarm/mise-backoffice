-- Migration 226: ETA Refinement + Schicht-Abschluss-Report (Phase 1415–1419)
-- 2026-07-13

-- Zubereitungs-Zeiten-Log für Histogramm-Aggregation (Phase 1416)
CREATE TABLE IF NOT EXISTS zubereitungs_zeiten_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  uuid NOT NULL,
  order_id     uuid NOT NULL,
  dauer_min    numeric(6,2) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ztl_location_created ON zubereitungs_zeiten_log (location_id, created_at DESC);

-- ETA-Verfeinerungs-Snapshots für Verlauf (Phase 1417)
CREATE TABLE IF NOT EXISTS eta_verfeinerungs_snapshots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         uuid NOT NULL,
  basis_eta_min       integer NOT NULL,
  verfeinerte_eta_min integer NOT NULL,
  wetter_zusatz       integer NOT NULL DEFAULT 0,
  queue_zusatz        integer NOT NULL DEFAULT 0,
  fahrer_abzug        integer NOT NULL DEFAULT 0,
  status              text NOT NULL DEFAULT 'normal',
  snapshot_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evs_location_at ON eta_verfeinerungs_snapshots (location_id, snapshot_at DESC);

-- Wetter-Log für Fahrer-App (Phase 1418)
CREATE TABLE IF NOT EXISTS fahrer_wetter_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid NOT NULL,
  location_id uuid,
  wetter_typ  text NOT NULL,
  extra_min   integer NOT NULL DEFAULT 0,
  logged_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fwl_driver_logged ON fahrer_wetter_log (driver_id, logged_at DESC);
