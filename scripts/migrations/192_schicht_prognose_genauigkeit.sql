-- Migration 192: Schicht-Prognose-Genauigkeits-Tracking (Phase 401)
--
-- Protokolliert je Standort, Wochentag und Kalenderwoche wie genau die
-- genehmigten Schicht-Ziel-Vorschläge (schicht_ziel_vorschlaege) mit den
-- tatsächlichen Ergebnissen (schicht_roi_daily) übereinstimmen.
-- Ermöglicht langfristige Kalibrierung des Prognose-Optimierers.

CREATE TABLE IF NOT EXISTS schicht_prognose_genauigkeit (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id              UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week              SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- 0=Sonntag, 1=Montag, ..., 6=Samstag
  week_start               DATE        NOT NULL,   -- ISO-Montag der analysierten Woche

  -- Umsatz-Prognose vs. Ist
  vorgeschlagener_umsatz   NUMERIC(10,2) NOT NULL DEFAULT 0,
  tatsaechlicher_umsatz    NUMERIC(10,2) NOT NULL DEFAULT 0,
  umsatz_abweichung_eur    NUMERIC(10,2) NOT NULL DEFAULT 0,  -- Ist - Prognose
  umsatz_mape_pct          NUMERIC(6,2)  NOT NULL DEFAULT 0,  -- |Abw| / max(|Ist|,1) * 100

  -- Lieferungen-Prognose vs. Ist
  vorgeschlagene_lieferungen INTEGER NOT NULL DEFAULT 0,
  tatsaechliche_lieferungen  INTEGER NOT NULL DEFAULT 0,
  liefer_abweichung          INTEGER NOT NULL DEFAULT 0,      -- Ist - Prognose
  liefer_mape_pct            NUMERIC(6,2) NOT NULL DEFAULT 0,

  -- Gesamt-MAPE (Mittel aus Umsatz- und Liefer-MAPE)
  combined_mape_pct          NUMERIC(6,2) NOT NULL DEFAULT 0,

  -- Meta
  confidence_score         NUMERIC(4,3) NOT NULL DEFAULT 0,   -- Konfidenz des Vorschlags
  was_approved             BOOLEAN      NOT NULL DEFAULT false,
  over_under               TEXT         CHECK (over_under IN ('over', 'under', 'on_target')),
  -- 'over' = Prognose zu hoch (Ist < Prognose)
  -- 'under' = Prognose zu niedrig (Ist > Prognose)
  -- 'on_target' = Abweichung < 5%

  snapshot_date            DATE         NOT NULL,  -- konkretes Datum (Wochentag in dieser Woche)
  analysis_date            DATE         NOT NULL DEFAULT CURRENT_DATE,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),

  UNIQUE (location_id, day_of_week, week_start)
);

CREATE INDEX IF NOT EXISTS idx_spg_location_week
  ON schicht_prognose_genauigkeit (location_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_spg_location_dow
  ON schicht_prognose_genauigkeit (location_id, day_of_week);

-- RLS
ALTER TABLE schicht_prognose_genauigkeit ENABLE ROW LEVEL SECURITY;

CREATE POLICY spg_service_all ON schicht_prognose_genauigkeit
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY spg_authenticated_read ON schicht_prognose_genauigkeit
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

-- updated_at Trigger
CREATE OR REPLACE FUNCTION trg_schicht_prognose_genauigkeit_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_spg_updated_at ON schicht_prognose_genauigkeit;
CREATE TRIGGER trg_spg_updated_at
  BEFORE UPDATE ON schicht_prognose_genauigkeit
  FOR EACH ROW EXECUTE PROCEDURE trg_schicht_prognose_genauigkeit_updated_at();

-- Prune-RPC
CREATE OR REPLACE FUNCTION prune_schicht_prognose_genauigkeit(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pruned INTEGER;
BEGIN
  DELETE FROM schicht_prognose_genauigkeit
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS pruned = ROW_COUNT;
  RETURN pruned;
END; $$;

-- View: Genauigkeitstrend der letzten 12 Wochen je Standort
CREATE OR REPLACE VIEW v_prognose_genauigkeit_trend AS
SELECT
  location_id,
  week_start,
  AVG(combined_mape_pct)          AS avg_mape_pct,
  AVG(umsatz_mape_pct)            AS avg_umsatz_mape_pct,
  AVG(liefer_mape_pct)            AS avg_liefer_mape_pct,
  COUNT(*)                        AS days_analyzed,
  SUM(CASE WHEN over_under = 'over'      THEN 1 ELSE 0 END) AS days_over,
  SUM(CASE WHEN over_under = 'under'     THEN 1 ELSE 0 END) AS days_under,
  SUM(CASE WHEN over_under = 'on_target' THEN 1 ELSE 0 END) AS days_on_target
FROM schicht_prognose_genauigkeit
WHERE week_start >= CURRENT_DATE - INTERVAL '12 weeks'
GROUP BY location_id, week_start
ORDER BY location_id, week_start DESC;
