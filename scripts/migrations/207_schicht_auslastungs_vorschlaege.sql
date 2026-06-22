-- Phase 428: Schicht-Auslastungs-Optimierer
-- Speichert stündliche Fahrer-Empfehlungen basierend auf tages_muster_snapshots.

CREATE TABLE IF NOT EXISTS schicht_auslastungs_vorschlaege (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id     uuid        NOT NULL,
  wochentag       int         NOT NULL CHECK (wochentag BETWEEN 0 AND 6), -- 0=So … 6=Sa
  stunde          int         NOT NULL CHECK (stunde BETWEEN 0 AND 23),
  empfohlene_fahrer_anzahl int NOT NULL DEFAULT 1,
  konfidenz       numeric(4,3) NOT NULL DEFAULT 0.500,   -- 0.000–1.000
  tages_muster_basis int      NOT NULL DEFAULT 0,         -- Basis-Tage aus tages_muster_snapshots
  avg_bestellungen numeric(6,2) NOT NULL DEFAULT 0.00,    -- Ø Bestellungen/Stunde aus Muster
  peak_klasse     text        CHECK (peak_klasse IN ('low','normal','peak','high')),
  berechnet_am    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, wochentag, stunde)
);

CREATE INDEX IF NOT EXISTS idx_schicht_auslastung_loc_dow_h
  ON schicht_auslastungs_vorschlaege (location_id, wochentag, stunde);

ALTER TABLE schicht_auslastungs_vorschlaege ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON schicht_auslastungs_vorschlaege
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_own_location" ON schicht_auslastungs_vorschlaege
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
    )
  );
