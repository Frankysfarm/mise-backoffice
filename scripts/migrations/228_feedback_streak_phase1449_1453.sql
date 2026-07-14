-- Migration 228: Kunden-Feedback + Liefer-Streak (Phasen 1449–1453)
-- Phase 1449: customer_reviews
-- Phase 1452: fahrer_liefer_streak

-- Kundenbewertungen
CREATE TABLE IF NOT EXISTS customer_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id   UUID NOT NULL,
  order_id      UUID,
  customer_id   TEXT,
  sterne        SMALLINT NOT NULL CHECK (sterne BETWEEN 1 AND 5),
  kommentar     TEXT,
  fahrer_id     UUID,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_location
  ON customer_reviews (location_id, erstellt_am DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_customer
  ON customer_reviews (customer_id, erstellt_am DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_fahrer
  ON customer_reviews (fahrer_id, erstellt_am DESC);

ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_reviews_rls ON customer_reviews
  USING (true) WITH CHECK (true);

-- Fahrer-Liefer-Streak
CREATE TABLE IF NOT EXISTS fahrer_liefer_streak (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID NOT NULL,
  fahrer_id             UUID NOT NULL,
  streak_tage           INTEGER NOT NULL DEFAULT 0,
  highscore_tage        INTEGER NOT NULL DEFAULT 0,
  letzte_lieferung_datum DATE,
  gesamt_liefertage     INTEGER NOT NULL DEFAULT 0,
  aktualisiert_am       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, fahrer_id)
);

CREATE INDEX IF NOT EXISTS idx_streak_location
  ON fahrer_liefer_streak (location_id);
CREATE INDEX IF NOT EXISTS idx_streak_fahrer
  ON fahrer_liefer_streak (fahrer_id);

ALTER TABLE fahrer_liefer_streak ENABLE ROW LEVEL SECURITY;
CREATE POLICY streak_rls ON fahrer_liefer_streak
  USING (true) WITH CHECK (true);
