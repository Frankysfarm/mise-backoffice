-- Migration 260: Lieferzeit-Abweichung + Schicht-Pausen Phase 1737–1741
-- Phase 1737: Lieferzeit-Abweichungs-API (Backend)
-- Phase 1738: Schicht-Pausen-Tracker (Kitchen)
-- Phase 1739: Lieferzeit-Abweichungs-Widget (Dispatch)
-- Phase 1740: Ziel-Erreicht-Animation (Fahrer-App)
-- Phase 1741: Live-Fahrer-Näherungs-Indikator (Storefront)

-- Lieferzeit-Abweichungs-Log (Phase 1737/1739)
CREATE TABLE IF NOT EXISTS lieferzeit_abweichungs_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL,
  tour_id       UUID,
  driver_id     UUID,
  eta_min       INTEGER,
  tatsaechlich_min INTEGER,
  delta_min     INTEGER,
  ausreisser    BOOLEAN NOT NULL DEFAULT false,
  datum         DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lieferzeit_abweichungs_log_location_datum
  ON lieferzeit_abweichungs_log (location_id, datum);

CREATE INDEX IF NOT EXISTS lieferzeit_abweichungs_log_driver
  ON lieferzeit_abweichungs_log (driver_id, datum);

-- Schicht-Pausen-Log (Phase 1738)
CREATE TABLE IF NOT EXISTS schicht_pausen_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL,
  datum       DATE NOT NULL,
  pause_von   TIMESTAMPTZ NOT NULL,
  pause_bis   TIMESTAMPTZ NOT NULL,
  dauer_min   INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schicht_pausen_log_location_datum
  ON schicht_pausen_log (location_id, datum);

-- Fahrer-Näherungs-Log (Phase 1741)
CREATE TABLE IF NOT EXISTS fahrer_naeherungs_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL,
  location_id UUID NOT NULL,
  driver_id   UUID,
  entfernung_m INTEGER,
  geloggt_am  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fahrer_naeherungs_log_order
  ON fahrer_naeherungs_log (order_id, geloggt_am DESC);

-- delivery_config Keys für Phase 1737–1741
INSERT INTO delivery_config (location_id, key, value) VALUES
  ('00000000-0000-0000-0000-000000000000', 'lieferzeit_abweichung_ausreisser_min', '10'),
  ('00000000-0000-0000-0000-000000000000', 'schicht_pause_warnung_schwelle_min',   '60'),
  ('00000000-0000-0000-0000-000000000000', 'fahrer_naeherungs_grenze_m',           '500'),
  ('00000000-0000-0000-0000-000000000000', 'lieferzeit_abweichung_alert_schwelle_min', '8')
ON CONFLICT (location_id, key) DO NOTHING;
