-- Migration 242: Fahrer-Einnahmen, Trinkgeld-Tracking, Lieferzeit-Banner (Phasen 1532–1536)

-- Phase 1532: Fahrer-Einnahmen-Snapshots (tägliche Verdienst-Übersicht je Fahrer)
CREATE TABLE IF NOT EXISTS fahrer_einnahmen_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     text NOT NULL,
  fahrer_id       text NOT NULL,
  snapshot_date   date NOT NULL DEFAULT CURRENT_DATE,
  verdienst_cents integer NOT NULL DEFAULT 0,
  trinkgeld_cents integer NOT NULL DEFAULT 0,
  stopps_count    integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fahrer_einnahmen_location_date ON fahrer_einnahmen_snapshots (location_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_fahrer_einnahmen_fahrer_date ON fahrer_einnahmen_snapshots (fahrer_id, snapshot_date);

-- Phase 1533: Allergene-Alarm-Log (Welche Bestellungen hatten Allergen-Alarme)
CREATE TABLE IF NOT EXISTS allergene_alarm_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  text NOT NULL,
  order_id     text NOT NULL,
  allergen     text NOT NULL,
  alarmiert_um timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_allergene_alarm_location_time ON allergene_alarm_log (location_id, alarmiert_um DESC);

-- Phase 1534: Einnahmen-Ranglisten-Log (Ranglisten-Snapshots je Schicht)
CREATE TABLE IF NOT EXISTS einnahmen_ranglisten_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     text NOT NULL,
  fahrer_id       text NOT NULL,
  rang            integer NOT NULL,
  verdienst_cents integer NOT NULL DEFAULT 0,
  trinkgeld_cents integer NOT NULL DEFAULT 0,
  trend           text NOT NULL DEFAULT 'stabil',
  erfasst_am      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_einnahmen_rangliste_location ON einnahmen_ranglisten_log (location_id, erfasst_am DESC);

-- Phase 1535: Trinkgeld-Tracker-Log (Fahrer-eigenes Trinkgeld-Journal)
CREATE TABLE IF NOT EXISTS trinkgeld_tracker_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     text NOT NULL,
  fahrer_id       text NOT NULL,
  trinkgeld_cents integer NOT NULL DEFAULT 0,
  stopp_id        text,
  erfasst_am      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trinkgeld_tracker_fahrer_date ON trinkgeld_tracker_log (fahrer_id, erfasst_am DESC);

-- Phase 1536: Lieferzeit-Countdown-Banner-Impressions (Wie oft + wann Banner gezeigt)
CREATE TABLE IF NOT EXISTS lieferzeit_countdown_impressions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  text NOT NULL,
  session_id   text,
  eta_minutes  integer,
  gezeigt_um   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lieferzeit_impressions_location ON lieferzeit_countdown_impressions (location_id, gezeigt_um DESC);

-- RLS: Alle Tabellen sichern (location_id-Filter per Policy)
ALTER TABLE fahrer_einnahmen_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergene_alarm_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE einnahmen_ranglisten_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trinkgeld_tracker_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lieferzeit_countdown_impressions ENABLE ROW LEVEL SECURITY;
