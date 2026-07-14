-- Migration 245: Fahrer-Bewertungs-Aggregat, Sofort-Reaktions-Timer, Fahrer-Bewertungs-Ranking,
--               Kundenbewertungs-Feedback, Fahrer-Profil-Vorschau (Phasen 1547–1551)

-- Phase 1547: Fahrer-Bewertungen-Aggregat-Snapshots
CREATE TABLE IF NOT EXISTS fahrer_bewertungen_aggregat_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  driver_id   uuid NOT NULL,
  driver_name text NOT NULL,
  avg_heute   numeric(3,1) NOT NULL DEFAULT 0,
  avg_7tage   numeric(3,1) NOT NULL DEFAULT 0,
  trend       text NOT NULL DEFAULT 'stabil' CHECK (trend IN ('steigend', 'stabil', 'fallend')),
  anzahl_heute int NOT NULL DEFAULT 0,
  anzahl_7tage int NOT NULL DEFAULT 0,
  erfasst_am  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fbas_location_date ON fahrer_bewertungen_aggregat_snapshots (location_id, erfasst_am DESC);

-- Phase 1548: Sofort-Reaktions-Timer-Log
CREATE TABLE IF NOT EXISTS sofort_reaktions_timer_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid,
  order_id      uuid,
  reaktionszeit_seconds int NOT NULL,
  schwelle_seconds int NOT NULL DEFAULT 30,
  quittiert_um  timestamptz,
  erfasst_am    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_srtl_location ON sofort_reaktions_timer_log (location_id, erfasst_am DESC);

-- Phase 1549: Fahrer-Bewertungs-Ranking-Log (Dispatch-Views)
CREATE TABLE IF NOT EXISTS fahrer_bewertungs_ranking_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  driver_id   uuid NOT NULL,
  rang        int NOT NULL,
  avg_heute   numeric(3,1),
  trend       text,
  erfasst_am  timestamptz NOT NULL DEFAULT now()
);

-- Phase 1550: Kundenbewertungs-Feedback-Karte-Log (Fahrer-App-Views)
CREATE TABLE IF NOT EXISTS kundenbewertungs_feedback_karte_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid NOT NULL,
  avg_angezeigt numeric(3,1),
  erfasst_am  timestamptz NOT NULL DEFAULT now()
);

-- Phase 1551: Fahrer-Profil-Vorschau-Impressions (Storefront)
CREATE TABLE IF NOT EXISTS fahrer_profil_vorschau_impressions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  uuid NOT NULL,
  driver_id    uuid,
  avg_rating   numeric(3,1),
  order_placed boolean NOT NULL DEFAULT false,
  erfasst_am   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fpvi_location ON fahrer_profil_vorschau_impressions (location_id, erfasst_am DESC);
