-- Phase 422: Stündliche Tages-Muster-Snapshots je Wochentag × Location
-- Speichert Ø Bestellungen, Ø Umsatz und P75 pro Stunde je Wochentag
-- Grundlage für Daily-Pattern-Recognition und Schicht-Planungs-Hinweise

CREATE TABLE IF NOT EXISTS tages_muster_snapshots (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id      uuid        NOT NULL,
  wochentag        smallint    NOT NULL CHECK (wochentag BETWEEN 0 AND 6),   -- 0=So 1=Mo … 6=Sa (UTC DOW)
  stunde           smallint    NOT NULL CHECK (stunde BETWEEN 0 AND 23),     -- UTC-Stunde
  avg_bestellungen float       NOT NULL DEFAULT 0,
  avg_umsatz_eur   float       NOT NULL DEFAULT 0,
  p75_bestellungen float       NOT NULL DEFAULT 0,
  peak_klasse      text        NOT NULL DEFAULT 'normal'
                     CHECK (peak_klasse IN ('low', 'normal', 'peak', 'high')),
  basis_tage       int         NOT NULL DEFAULT 0,
  berechnet_am     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, wochentag, stunde)
);

CREATE INDEX IF NOT EXISTS idx_tages_muster_loc_dow
  ON tages_muster_snapshots (location_id, wochentag);

ALTER TABLE tages_muster_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON tages_muster_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_own_location" ON tages_muster_snapshots
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION prune_tages_muster_snapshots(days_old int DEFAULT 30)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted int := 0;
BEGIN
  IF days_old > 0 THEN
    DELETE FROM tages_muster_snapshots
    WHERE berechnet_am < now() - (days_old || ' days')::interval;
    GET DIAGNOSTICS deleted = ROW_COUNT;
  END IF;
  RETURN deleted;
END;
$$;
