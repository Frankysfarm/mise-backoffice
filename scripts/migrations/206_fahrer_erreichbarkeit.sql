-- Phase 426: Fahrer-Erreichbarkeits-Engine
-- Trackt automatische Pings an Fahrer 30 Min vor Schichtbeginn via Push/SMS.

CREATE TABLE IF NOT EXISTS fahrer_erreichbarkeit_log (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id   uuid        NOT NULL,
  driver_id     uuid        NOT NULL,
  schicht_id    uuid,                              -- FK auf driver_shifts (optional, shifts können fehlen)
  gepingt_am    timestamptz NOT NULL DEFAULT now(),
  antwort       text        NOT NULL DEFAULT 'keine_antwort'
                            CHECK (antwort IN ('bestätigt','abgelehnt','keine_antwort')),
  kanal         text        NOT NULL DEFAULT 'push'
                            CHECK (kanal IN ('push','sms')),
  schicht_start timestamptz,                       -- geplanter Schichtstart (für Sortierung)
  geantwortet_am timestamptz,                      -- Zeitstempel der Antwort
  UNIQUE (driver_id, schicht_id, gepingt_am::date) -- ein Ping je Fahrer je Schicht je Tag
);

CREATE INDEX IF NOT EXISTS idx_fahrer_erreichbarkeit_loc_gepingt
  ON fahrer_erreichbarkeit_log (location_id, gepingt_am DESC);

CREATE INDEX IF NOT EXISTS idx_fahrer_erreichbarkeit_driver
  ON fahrer_erreichbarkeit_log (driver_id, gepingt_am DESC);

CREATE INDEX IF NOT EXISTS idx_fahrer_erreichbarkeit_schicht
  ON fahrer_erreichbarkeit_log (schicht_id) WHERE schicht_id IS NOT NULL;

ALTER TABLE fahrer_erreichbarkeit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON fahrer_erreichbarkeit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_own_location" ON fahrer_erreichbarkeit_log
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees
      WHERE auth_user_id = auth.uid()
    )
  );

-- Cleanup: alte Logs löschen (Standard 30 Tage)
CREATE OR REPLACE FUNCTION prune_fahrer_erreichbarkeit_log(days_old int DEFAULT 30)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted int := 0;
BEGIN
  IF days_old > 0 THEN
    DELETE FROM fahrer_erreichbarkeit_log
    WHERE gepingt_am < (NOW() - (days_old || ' days')::interval);
    GET DIAGNOSTICS deleted = ROW_COUNT;
  END IF;
  RETURN deleted;
END;
$$;
