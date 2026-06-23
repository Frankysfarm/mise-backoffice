-- Migration 214: Kundenbindungs-Score (Phase 437)
-- Automatische Kundenbewertung nach Frequenz, Wert, Recency und Stornoquote

CREATE TABLE IF NOT EXISTS kunden_scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  kunde_telefon       TEXT NOT NULL,
  kunde_name          TEXT,
  score               NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  segmentierung       TEXT NOT NULL
                        CHECK (segmentierung IN ('champion', 'loyal', 'at_risk', 'lost')),
  bestellfrequenz     NUMERIC(8,2),     -- Bestellungen pro Monat (30 Tage)
  avg_bestellwert     NUMERIC(10,2),    -- Ø Bestellwert in EUR
  letzte_bestellung   TIMESTAMPTZ,
  stornorate          NUMERIC(5,4),     -- 0.0–1.0 (Anteil stornierter Bestellungen)
  bestellungen_total  INTEGER NOT NULL DEFAULT 0,
  berechnet_am        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, kunde_telefon)
);

CREATE INDEX IF NOT EXISTS idx_kunden_scores_location
  ON kunden_scores (location_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_kunden_scores_segment
  ON kunden_scores (location_id, segmentierung);

CREATE INDEX IF NOT EXISTS idx_kunden_scores_berechnet
  ON kunden_scores (location_id, berechnet_am DESC);

-- RLS
ALTER TABLE kunden_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY kunden_scores_service ON kunden_scores
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY kunden_scores_admin_read ON kunden_scores
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE id = auth.uid()
    )
  );

-- Cleanup-RPC
CREATE OR REPLACE FUNCTION prune_kunden_scores(days_old INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM kunden_scores
  WHERE berechnet_am < (NOW() - (days_old || ' days')::INTERVAL);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
