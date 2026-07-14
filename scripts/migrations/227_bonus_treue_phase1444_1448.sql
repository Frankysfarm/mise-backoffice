-- Migration 227: Bonus-Abrechnung + Treue-Punkte (Phasen 1444–1448)
-- Phase 1444: fahrer_bonus_abrechnung_log
-- Phase 1448: customer_loyalty_points

-- Fahrer-Bonus-Abrechnungs-Log
CREATE TABLE IF NOT EXISTS fahrer_bonus_abrechnung_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL,
  fahrer_id     UUID NOT NULL,
  monat         DATE NOT NULL,  -- erster Tag des Monats
  stopps_bonus_eur          NUMERIC(8,2) NOT NULL DEFAULT 0,
  puenktlichkeits_bonus_eur NUMERIC(8,2) NOT NULL DEFAULT 0,
  trinkgeld_summe_eur       NUMERIC(8,2) NOT NULL DEFAULT 0,
  gesamt_bonus_eur          NUMERIC(8,2) NOT NULL DEFAULT 0,
  stopps_monat              INTEGER NOT NULL DEFAULT 0,
  puenktlichkeits_quote     NUMERIC(5,2) NOT NULL DEFAULT 0,
  auszahlungs_status        TEXT NOT NULL DEFAULT 'ausstehend'
                              CHECK (auszahlungs_status IN ('ausstehend','genehmigt','ausgezahlt')),
  genehmigt_am  TIMESTAMPTZ,
  ausgezahlt_am TIMESTAMPTZ,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, fahrer_id, monat)
);

CREATE INDEX IF NOT EXISTS idx_bonus_log_location_monat
  ON fahrer_bonus_abrechnung_log (location_id, monat DESC);
CREATE INDEX IF NOT EXISTS idx_bonus_log_fahrer
  ON fahrer_bonus_abrechnung_log (fahrer_id, monat DESC);

ALTER TABLE fahrer_bonus_abrechnung_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY fahrer_bonus_log_rls ON fahrer_bonus_abrechnung_log
  USING (true) WITH CHECK (true);

-- Treue-Punkte (Phase 1448)
CREATE TABLE IF NOT EXISTS customer_loyalty_points (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL,
  customer_id   TEXT NOT NULL,
  punkte        INTEGER NOT NULL DEFAULT 0 CHECK (punkte >= 0),
  punkte_gesamt INTEGER NOT NULL DEFAULT 0,  -- Lifetime-Punkte
  eingeloest    INTEGER NOT NULL DEFAULT 0,
  letzter_kauf  TIMESTAMPTZ,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now(),
  aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_location
  ON customer_loyalty_points (location_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_customer
  ON customer_loyalty_points (customer_id);

ALTER TABLE customer_loyalty_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY loyalty_points_rls ON customer_loyalty_points
  USING (true) WITH CHECK (true);

-- Punkte-Transaktions-Log
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL,
  customer_id   TEXT NOT NULL,
  order_id      UUID,
  punkte_delta  INTEGER NOT NULL,
  typ           TEXT NOT NULL CHECK (typ IN ('kauf','einloesung','ablauf','korrektur')),
  beschreibung  TEXT,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_location_customer
  ON loyalty_transactions (location_id, customer_id, erstellt_am DESC);

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY loyalty_tx_rls ON loyalty_transactions
  USING (true) WITH CHECK (true);
