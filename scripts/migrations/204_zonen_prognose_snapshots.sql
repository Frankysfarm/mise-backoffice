-- Phase 423: 7-Tage Zonen-Profitabilitäts-Prognose je Zone (A/B/C/D) × Standort
-- Speichert vorausberechnete Revenue-/Orders-Prognosen je Zone und Prognosedatum.
-- Grundlage: zone_revenue_snapshots (Phase 331) × Exponential-Decay-Gewichtung.

CREATE TABLE IF NOT EXISTS zonen_prognose_snapshots (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id          uuid        NOT NULL,
  zone                 text        NOT NULL CHECK (zone IN ('A','B','C','D')),
  prognose_datum       date        NOT NULL,
  wochentag            smallint    NOT NULL CHECK (wochentag BETWEEN 0 AND 6), -- 0=So 6=Sa
  expected_orders      float       NOT NULL DEFAULT 0,
  expected_revenue_eur float       NOT NULL DEFAULT 0,
  expected_fee_eur     float       NOT NULL DEFAULT 0,
  expected_margin_pct  float,
  confidence           float       NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 1),
  range_low_eur        float       NOT NULL DEFAULT 0,
  range_high_eur       float       NOT NULL DEFAULT 0,
  basis_snapshots      int         NOT NULL DEFAULT 0,
  trend_richtung       text        NOT NULL DEFAULT 'stable'
                         CHECK (trend_richtung IN ('up','stable','down')),
  berechnet_am         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, zone, prognose_datum)
);

CREATE INDEX IF NOT EXISTS idx_zonen_prognose_loc_datum
  ON zonen_prognose_snapshots (location_id, prognose_datum);

CREATE INDEX IF NOT EXISTS idx_zonen_prognose_loc_zone
  ON zonen_prognose_snapshots (location_id, zone);

ALTER TABLE zonen_prognose_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON zonen_prognose_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_own_location" ON zonen_prognose_snapshots
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION prune_zonen_prognose_snapshots(days_old int DEFAULT 60)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted int := 0;
BEGIN
  IF days_old > 0 THEN
    DELETE FROM zonen_prognose_snapshots
    WHERE berechnet_am < now() - (days_old || ' days')::interval;
    GET DIAGNOSTICS deleted = ROW_COUNT;
  END IF;
  RETURN deleted;
END;
$$;
