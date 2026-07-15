-- Migration 262 — Phase 1747–1751
-- Tour-Effizienz-History + Liefer-Vertrauens-Score-Badge

-- Tour-Effizienz-Score-History: Tages-Snapshots je Fahrer
CREATE TABLE IF NOT EXISTS tour_effizienz_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid NOT NULL,
  driver_id     uuid NOT NULL,
  datum         date NOT NULL,
  avg_score     numeric(5,2) NOT NULL DEFAULT 0,
  touren_anzahl int  NOT NULL DEFAULT 0,
  trend         text CHECK (trend IN ('steigend','fallend','stabil')) DEFAULT 'stabil',
  trend_delta   numeric(5,2) DEFAULT 0,
  erfasst_am    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, driver_id, datum)
);

CREATE INDEX IF NOT EXISTS idx_tour_effizienz_history_loc_driver
  ON tour_effizienz_history (location_id, driver_id, datum DESC);

-- Liefer-Feedback für Vertrauens-Score
CREATE TABLE IF NOT EXISTS delivery_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  order_id    uuid,
  driver_id   uuid,
  bewertung   int NOT NULL CHECK (bewertung BETWEEN 1 AND 5),
  kommentar   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_feedback_loc_created
  ON delivery_feedback (location_id, created_at DESC);

-- Bestellfrequenz-Cache für Prognose-Grundlage
CREATE TABLE IF NOT EXISTS bestellfrequenz_stunden_cache (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   uuid NOT NULL,
  stunde        int NOT NULL CHECK (stunde BETWEEN 0 AND 23),
  wochentag     int NOT NULL CHECK (wochentag BETWEEN 0 AND 6),
  avg_bestellungen numeric(6,2) DEFAULT 0,
  aktualisiert_am  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, stunde, wochentag)
);

-- delivery_config Keys
INSERT INTO delivery_config (location_id, key, value, beschreibung)
SELECT gen_random_uuid(), 'vertrauens_score_min_bewertungen', '5',
  'Mindestanzahl Bewertungen für Vertrauens-Score-Badge'
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_config WHERE key = 'vertrauens_score_min_bewertungen'
);

INSERT INTO delivery_config (location_id, key, value, beschreibung)
SELECT gen_random_uuid(), 'effizienz_history_tage', '7',
  'Anzahl Tage für Tour-Effizienz-History-Anzeige'
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_config WHERE key = 'effizienz_history_tage'
);

INSERT INTO delivery_config (location_id, key, value, beschreibung)
SELECT gen_random_uuid(), 'bestellfrequenz_prognose_ziel_pro_h', '20',
  'Ziel-Bestellungen pro Stunde für Prognose-Widget'
WHERE NOT EXISTS (
  SELECT 1 FROM delivery_config WHERE key = 'bestellfrequenz_prognose_ziel_pro_h'
);
