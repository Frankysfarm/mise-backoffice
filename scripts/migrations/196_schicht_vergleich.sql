-- Migration 196: Schicht-Vergleich-Baselines — Phase 411
-- Rollende 6-Wochen-Durchschnittswerte je Standort und Wochentag
-- für die Schicht-Vergleichs-Engine.

-- ── Baselines ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schicht_vergleich_baselines (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id               UUID        NOT NULL REFERENCES mise_locations(id) ON DELETE CASCADE,
  day_of_week               SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),

  -- Umsatz (EUR)
  avg_umsatz_eur            NUMERIC(10,2),
  p25_umsatz_eur            NUMERIC(10,2),
  p75_umsatz_eur            NUMERIC(10,2),

  -- Lieferungen
  avg_lieferungen           NUMERIC(8,2),
  p25_lieferungen           NUMERIC(8,2),
  p75_lieferungen           NUMERIC(8,2),

  -- Ø Lieferzeit (Minuten)
  avg_delivery_min          NUMERIC(6,2),
  p25_delivery_min          NUMERIC(6,2),
  p75_delivery_min          NUMERIC(6,2),

  -- Pünktlichkeit (0–100 %)
  avg_on_time_pct           NUMERIC(6,2),

  -- Fahrerstunden
  avg_driver_hours          NUMERIC(8,2),

  -- Wirtschaftlichkeit
  avg_cost_per_delivery_eur NUMERIC(8,2),
  avg_net_margin_pct        NUMERIC(6,2),

  -- Meta
  weeks_used                SMALLINT    NOT NULL DEFAULT 0,
  last_computed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (location_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_svb_location_dow
  ON schicht_vergleich_baselines (location_id, day_of_week);

-- RLS
ALTER TABLE schicht_vergleich_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "svb_service_role_full" ON schicht_vergleich_baselines;
CREATE POLICY "svb_service_role_full" ON schicht_vergleich_baselines
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "svb_authenticated_read" ON schicht_vergleich_baselines;
CREATE POLICY "svb_authenticated_read" ON schicht_vergleich_baselines
  FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM user_location_access WHERE user_id = auth.uid()
  ));

-- updated_at trigger
CREATE OR REPLACE FUNCTION touch_svb_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS svb_updated_at ON schicht_vergleich_baselines;
CREATE TRIGGER svb_updated_at
  BEFORE UPDATE ON schicht_vergleich_baselines
  FOR EACH ROW EXECUTE FUNCTION touch_svb_updated_at();
