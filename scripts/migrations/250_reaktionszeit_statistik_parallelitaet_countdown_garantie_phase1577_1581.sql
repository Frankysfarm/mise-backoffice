-- Migration 250: Phasen 1577–1581
-- fahrer_reaktionszeit_statistik_log + zubereitungs_parallelitaets_log
-- + tour_effizienz_vergleichs_tabelle_log + schicht_countdown_log
-- + lieferzeit_garantie_versprechen_log

-- Phase 1577: Fahrer-Reaktionszeit-Statistik-API
CREATE TABLE IF NOT EXISTS fahrer_reaktionszeit_statistik_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL,
  fahrer_id      UUID NOT NULL,
  avg_min        NUMERIC(5,2) NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('schnell', 'normal', 'langsam')),
  trend          TEXT NOT NULL CHECK (trend IN ('besser', 'gleich', 'schlechter')),
  rang           INT NOT NULL,
  anzahl         INT NOT NULL,
  snapshot_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fahrer_reaktionszeit_statistik_loc
  ON fahrer_reaktionszeit_statistik_snapshots (location_id, snapshot_at DESC);

-- Phase 1578: Zubereitungs-Parallelitäts-Anzeige
CREATE TABLE IF NOT EXISTS zubereitungs_parallelitaets_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL,
  parallel_count INT NOT NULL,
  ampel          TEXT NOT NULL CHECK (ampel IN ('gruen', 'gelb', 'rot')),
  auslastung_pct INT NOT NULL,
  logged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_zubereitungs_parallelitaet_loc
  ON zubereitungs_parallelitaets_log (location_id, logged_at DESC);

-- Phase 1579: Tour-Effizienz-Vergleichs-Tabelle
CREATE TABLE IF NOT EXISTS tour_effizienz_vergleichs_tabelle_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL,
  fahrer_id      UUID NOT NULL,
  stopps_pro_tour NUMERIC(4,2),
  puenktlichkeit_pct INT,
  rang           INT,
  logged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tour_effizienz_vergleich_loc
  ON tour_effizienz_vergleichs_tabelle_log (location_id, logged_at DESC);

-- Phase 1580: Schicht-Countdown-Timer
CREATE TABLE IF NOT EXISTS schicht_countdown_timer_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID,
  fahrer_id      UUID NOT NULL,
  rest_minuten   INT NOT NULL,
  letzte_tour_eta_min INT,
  weitere_tour_sinnvoll BOOLEAN NOT NULL DEFAULT TRUE,
  logged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schicht_countdown_fahrer
  ON schicht_countdown_timer_log (fahrer_id, logged_at DESC);

-- Phase 1581: Lieferzeit-Garantie-Versprechen
CREATE TABLE IF NOT EXISTS lieferzeit_garantie_versprechen_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL,
  order_id       UUID,
  eta_minuten    INT NOT NULL,
  gutschein_code TEXT NOT NULL DEFAULT 'PUENKTLICH5',
  dismissed      BOOLEAN NOT NULL DEFAULT FALSE,
  logged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lieferzeit_garantie_loc
  ON lieferzeit_garantie_versprechen_log (location_id, logged_at DESC);
