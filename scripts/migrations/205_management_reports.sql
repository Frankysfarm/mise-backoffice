-- Phase 424: Management-Report — Automatischer Wochenbericht je Standort
-- Aggregiert KPIs aus customer_orders + driver_score_daily_snapshots für jede Kalenderwoche.

CREATE TABLE IF NOT EXISTS management_reports (
  id                     uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id            uuid        NOT NULL,
  woche_von              date        NOT NULL,  -- Monday YYYY-MM-DD
  woche_bis              date        NOT NULL,  -- Sunday YYYY-MM-DD
  umsatz_eur             float       NOT NULL DEFAULT 0,
  lieferungen            int         NOT NULL DEFAULT 0,
  puenktlichkeit_pct     float       NOT NULL DEFAULT 0 CHECK (puenktlichkeit_pct BETWEEN 0 AND 100),
  top_fahrer_id          uuid,
  top_fahrer_name        text,
  top_zone               text        CHECK (top_zone IN ('A','B','C','D')),
  schlechteste_zone      text        CHECK (schlechteste_zone IN ('A','B','C','D')),
  cancellation_rate      float       NOT NULL DEFAULT 0 CHECK (cancellation_rate BETWEEN 0 AND 1),
  avg_delivery_min       float,
  vergleich_vorwoche_pct float,
  generiert_am           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, woche_von)
);

CREATE INDEX IF NOT EXISTS idx_management_reports_loc_woche
  ON management_reports (location_id, woche_von DESC);

ALTER TABLE management_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON management_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_own_location" ON management_reports
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION prune_management_reports(weeks_old int DEFAULT 52)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted int := 0;
BEGIN
  IF weeks_old > 0 THEN
    DELETE FROM management_reports
    WHERE woche_von < (CURRENT_DATE - (weeks_old * 7));
    GET DIAGNOSTICS deleted = ROW_COUNT;
  END IF;
  RETURN deleted;
END;
$$;
