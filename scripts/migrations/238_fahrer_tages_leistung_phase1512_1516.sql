-- Migration 238: Fahrer-Tages-Leistung + Tour-Vorbereitung + Aktions-Ticker (Phasen 1512–1516)

-- fahrer_tages_leistungs_snapshots — Stündliche Leistungs-Snapshots je Fahrer
CREATE TABLE IF NOT EXISTS fahrer_tages_leistungs_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid NOT NULL,
  fahrer_id     text NOT NULL,
  fahrer_name   text NOT NULL,
  stopps_heute  int NOT NULL DEFAULT 0,
  verdienst_eur numeric(8,2) NOT NULL DEFAULT 0,
  km_heute      numeric(6,1) NOT NULL DEFAULT 0,
  puenktlichkeit_pct int NOT NULL DEFAULT 0,
  rang          int NOT NULL DEFAULT 1,
  trend         text NOT NULL DEFAULT 'gleich' CHECK (trend IN ('besser','gleich','schlechter')),
  snapshot_tag  date NOT NULL DEFAULT CURRENT_DATE,
  erstellt_am   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fahrer_tages_leistung_loc_tag
  ON fahrer_tages_leistungs_snapshots (location_id, snapshot_tag);

-- schicht_end_checklisten_log — Protokoll der abgeschlossenen Schicht-Checklisten (Kitchen)
CREATE TABLE IF NOT EXISTS schicht_end_checklisten_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid,
  erledigte_items jsonb NOT NULL DEFAULT '{}',
  alle_erledigt   boolean NOT NULL DEFAULT false,
  offene_bestellungen int NOT NULL DEFAULT 0,
  erstellt_am     timestamptz NOT NULL DEFAULT now()
);

-- tour_vorbereitungs_log — Optionales Tracking der Fahrer-Checklisten vor Tourstart
CREATE TABLE IF NOT EXISTS tour_vorbereitungs_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fahrer_id       text NOT NULL,
  tour_id         text,
  location_id     uuid,
  erledigte_items jsonb NOT NULL DEFAULT '{}',
  alle_erledigt   boolean NOT NULL DEFAULT false,
  erstellt_am     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tour_vorbereitungs_log_fahrer
  ON tour_vorbereitungs_log (fahrer_id, erstellt_am DESC);

-- aktions_banner_impressions — Tracking der gezeigten Aktions-Banner (Storefront)
CREATE TABLE IF NOT EXISTS aktions_banner_impressions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL,
  aktions_id      text NOT NULL,
  dismissed       boolean NOT NULL DEFAULT false,
  code_copied     boolean NOT NULL DEFAULT false,
  erstellt_am     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aktions_banner_impressions_loc
  ON aktions_banner_impressions (location_id, erstellt_am DESC);
