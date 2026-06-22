-- Migration 191: Schicht-Ziel-Vorschläge (Phase 400)
-- Speichert statistisch berechnete Ziel-Vorschläge je Wochentag + Standort.
-- Der Ziel-Optimierer analysiert schicht_roi_daily und schlägt erreichbare
-- aber ambitionierte Tages-Ziele vor (P75 der letzten N Wochen).

CREATE TABLE IF NOT EXISTS schicht_ziel_vorschlaege (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week           SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- 0=Sonntag, 1=Montag, ..., 6=Samstag

  suggested_umsatz      NUMERIC(10,2) NOT NULL,
  suggested_lieferungen INT           NOT NULL,

  confidence_score      NUMERIC(4,3)  NOT NULL DEFAULT 0,  -- 0.0–1.0
  based_on_weeks        INT           NOT NULL DEFAULT 0,   -- Datenpunkte
  reasoning             TEXT          NOT NULL DEFAULT '',  -- Erklärungstext

  median_umsatz         NUMERIC(10,2),
  p75_umsatz            NUMERIC(10,2),
  median_lieferungen    NUMERIC(6,2),
  p75_lieferungen       NUMERIC(6,2),

  trend_direction       TEXT          NOT NULL DEFAULT 'stabil'
    CHECK (trend_direction IN ('steigend', 'stabil', 'sinkend')),

  status                TEXT          NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined')),
  reviewed_by           TEXT,
  reviewed_at           TIMESTAMPTZ,
  generated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT schicht_ziel_vorschlaege_loc_dow_uq UNIQUE (location_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_szv_location ON schicht_ziel_vorschlaege (location_id);
CREATE INDEX IF NOT EXISTS idx_szv_status   ON schicht_ziel_vorschlaege (location_id, status);

-- RLS
ALTER TABLE schicht_ziel_vorschlaege ENABLE ROW LEVEL SECURITY;

CREATE POLICY szv_service_all ON schicht_ziel_vorschlaege
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY szv_authenticated_read ON schicht_ziel_vorschlaege
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY szv_authenticated_write ON schicht_ziel_vorschlaege
  FOR ALL TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees
      WHERE auth_user_id = auth.uid()
        AND rolle IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    location_id IN (
      SELECT location_id FROM employees
      WHERE auth_user_id = auth.uid()
        AND rolle IN ('admin', 'manager')
    )
  );
