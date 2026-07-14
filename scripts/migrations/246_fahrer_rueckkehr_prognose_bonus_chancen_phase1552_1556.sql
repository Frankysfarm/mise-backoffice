-- Migration 246: Phase 1552-1556
-- Fahrer-Rückkehr-Prognose, Kochstart-Priorisierung, Bonus-Chancen, Liefergebiet-Info

-- Phase 1554/1552: Rückkehr-Prognose-Log (fallback da driver-return-prediction.ts eigene Tabelle nutzt)
CREATE TABLE IF NOT EXISTS fahrer_rueckkehr_prognose_widget_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  tour_id     uuid,
  driver_id   uuid,
  eta_min     int,
  konfidenz   numeric(4,2),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_frhpwl_location ON fahrer_rueckkehr_prognose_widget_log(location_id, created_at DESC);

-- Phase 1555: Bonus-Chancen-Widget-Log
CREATE TABLE IF NOT EXISTS bonus_chancen_widget_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL,
  driver_id       uuid NOT NULL,
  bonus_typ       text NOT NULL CHECK (bonus_typ IN ('puenktlichkeit','trinkgeld','streak')),
  fortschritt_pct int,
  erreichbar      boolean,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bcwl_driver ON bonus_chancen_widget_log(driver_id, created_at DESC);

-- Phase 1553: Kochstart-Priorisierungs-Log
CREATE TABLE IF NOT EXISTS kochstart_priorisierungs_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  order_id    uuid,
  empfehlung  text NOT NULL CHECK (empfehlung IN ('jetzt','bald','warten')),
  kochstart_in_min int,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kpl_location ON kochstart_priorisierungs_log(location_id, created_at DESC);

-- Phase 1556: Liefergebiet-Info-Badge-Impressionen
CREATE TABLE IF NOT EXISTS liefergebiet_info_badge_impressions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_libi_location ON liefergebiet_info_badge_impressions(location_id, created_at DESC);
