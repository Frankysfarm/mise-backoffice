-- 062: "System geht auf dem Handy von selbst offline" (Founder-Befund 14.08.2026)
--
-- Symptom: Fahrer tippt "Online gehen", steckt das Handy ein, und findet sich
-- später offline wieder — ohne etwas getan zu haben.
--
-- Ursache: mark_stale_drivers_offline schaute AUSSCHLIESSLICH auf last_position_at.
-- Auf dem Handy liefert der Browser/WebView keine GPS-Fixes mehr, sobald der
-- Bildschirm aus ist oder die App im Hintergrund liegt. Nach 30 Minuten kippte
-- der Cron den Fahrer auf 'offline'. Zurück holte ihn nur ein neuer GPS-Fix —
-- der nie kam, solange das Handy schlief.
--
-- Fix: Sichtbare Web-/PWA-Nutzung sendet /api/driver/v1/me/heartbeat; die native
-- App sendet auch im Hintergrund GPS. Beides aktualisiert last_active_at. Offline
-- wird nur noch, wer weder Position noch Lebenszeichen gesendet hat.
--
-- Was NICHT geändert wird: Die Dispatch-Regel "GPS < 15 min" in frank.ts bleibt.
-- Ein Fahrer ohne bekannte Position bekommt weiterhin keine Tour zugeteilt —
-- er gilt nur nicht mehr als offline.
--
-- Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.mark_stale_drivers_offline()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  affected integer;
BEGIN
  UPDATE public.mise_drivers
  SET state = 'offline',
      updated_at = now()
  WHERE active = true
    AND state <> 'offline'
    -- Lebenszeichen ODER Position zählt — das spätere von beiden entscheidet.
    -- updated_at/created_at NUR als Notnagel, wenn beides nie gesetzt wurde:
    -- updated_at ändert sich bei jeder Zeilenänderung (z.B. excluded_until) und
    -- würde einen Fahrer sonst dauerhaft "am Leben" halten.
    AND COALESCE(
          GREATEST(last_position_at, last_active_at),
          last_position_at,
          last_active_at,
          updated_at,
          created_at
        ) < now() - interval '30 minutes'
    -- Schonfrist nach Schichtstart: sonst kippt der Cron jeden Fahrer direkt
    -- nach dem Online-Gehen, weil die letzte Position von gestern stammt.
    AND COALESCE(shift_started_at, '-infinity'::timestamptz) < now() - interval '10 minutes';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$fn$;
