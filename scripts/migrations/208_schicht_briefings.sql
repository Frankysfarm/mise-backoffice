-- Phase 429: Schicht-Briefing-Engine
-- Personalisierte Schicht-Briefings je Fahrer basierend auf
-- tages_muster_snapshots + fahrer_prognose_snapshots + zonen_prognose_snapshots.

CREATE TABLE IF NOT EXISTS schicht_briefings (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id           uuid        NOT NULL,
  driver_id             uuid        NOT NULL,
  schicht_datum         date        NOT NULL,
  schicht_start         timestamptz NOT NULL,
  erwartete_bestellungen int        NOT NULL DEFAULT 0,
  spitzenstunde         int,          -- UTC-Stunde mit höchstem Demand (0-23)
  top_zone              text          CHECK (top_zone IN ('A','B','C','D')),
  peak_klasse_schicht   text          CHECK (peak_klasse_schicht IN ('low','normal','peak','high')),
  tipps                 jsonb       NOT NULL DEFAULT '[]',
  driver_score          int,          -- 0-100 aus fahrer_prognose_snapshots
  driver_kategorie      text          CHECK (driver_kategorie IN ('elite','gut','durchschnitt','auffällig')),
  generiert_am          timestamptz NOT NULL DEFAULT now(),
  gesehen_am            timestamptz,
  UNIQUE (driver_id, schicht_datum)
);

CREATE INDEX IF NOT EXISTS idx_schicht_briefings_location_datum
  ON schicht_briefings (location_id, schicht_datum);

CREATE INDEX IF NOT EXISTS idx_schicht_briefings_driver
  ON schicht_briefings (driver_id, schicht_datum DESC);

ALTER TABLE schicht_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON schicht_briefings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_own_location" ON schicht_briefings
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "driver_read_own_briefing" ON schicht_briefings
  FOR SELECT TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM employees
      WHERE auth_user_id = auth.uid()
        AND role IN ('fahrer','driver')
    )
  );

CREATE OR REPLACE FUNCTION prune_schicht_briefings(days_old int DEFAULT 30)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted int := 0;
BEGIN
  IF days_old > 0 THEN
    DELETE FROM schicht_briefings
    WHERE schicht_datum < (CURRENT_DATE - (days_old || ' days')::interval)::date;
    GET DIAGNOSTICS deleted = ROW_COUNT;
  END IF;
  RETURN deleted;
END;
$$;
