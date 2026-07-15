-- Migration 269: Stopp-Abbruch-Tracker Phase 1806
-- Tabellen für Tracking abgebrochener Liefer-Stopps je Fahrer

-- Stopp-Abbruch-Log (falls delivery_batch_stops noch keine abort_reason-Spalte hat)
ALTER TABLE IF EXISTS delivery_batch_stops
  ADD COLUMN IF NOT EXISTS abort_reason varchar(30)
    CHECK (abort_reason IN ('nicht_zuhause', 'falsches_paket', 'kunde_abwesend', 'unbekannt')),
  ADD COLUMN IF NOT EXISTS aborted_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_id uuid;

CREATE INDEX IF NOT EXISTS idx_delivery_batch_stops_abort
  ON delivery_batch_stops (location_id, driver_id, aborted_at DESC)
  WHERE status = 'aborted';

-- Dedizierte Abbruch-Statistik-Tabelle (Tages-Aggregat je Fahrer)
CREATE TABLE IF NOT EXISTS stopp_abbruch_statistik (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    uuid NOT NULL,
  fahrer_id      uuid NOT NULL,
  datum          date NOT NULL,
  abbrueche      integer NOT NULL DEFAULT 0,
  gesamt_stopps  integer NOT NULL DEFAULT 0,
  nicht_zuhause  integer NOT NULL DEFAULT 0,
  falsches_paket integer NOT NULL DEFAULT 0,
  kunde_abwesend integer NOT NULL DEFAULT 0,
  unbekannt      integer NOT NULL DEFAULT 0,
  erstellt_am    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, fahrer_id, datum)
);

CREATE INDEX IF NOT EXISTS idx_stopp_abbruch_statistik_fahrer_datum
  ON stopp_abbruch_statistik (location_id, fahrer_id, datum DESC);

-- Delivery-Config: Abbruchquoten-Schwelle für Alert (default 10%)
INSERT INTO delivery_config (location_id, key, value)
  SELECT gen_random_uuid(), 'stopp_abbruch_alert_schwelle_pct', '10'
  WHERE NOT EXISTS (
    SELECT 1 FROM delivery_config WHERE key = 'stopp_abbruch_alert_schwelle_pct'
  );
