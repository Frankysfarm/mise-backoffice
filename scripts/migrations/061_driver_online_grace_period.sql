-- 061: Fahrer fliegt nach dem Online-Gehen sofort wieder raus (Live-Bug 14.08.2026)
--
-- Symptom: Fahrer geht in der App online (mise_drivers.state='idle',
-- shift_started_at=now()), seine letzte GPS-Position ist aber naturgemäß noch alt.
-- Der Cron mark_stale_drivers_offline (smart-dispatch, alle 2 min) sieht
-- "last_position_at älter als 30 min" und setzt state='offline' — und nichts holt
-- ihn zurück, wenn Sekunden später frisches GPS eintrifft. Die App zeigt "Online",
-- der Dispatch sieht offline, der Fahrer bekommt nie eine Tour.
--
-- Fix, zwei Seiten:
--  1) hier: Schonfrist von 10 Minuten nach Schichtstart — frisch Online-Gegangene
--     werden nicht rausgeworfen, bevor der erste Fix ankommen konnte.
--  2) app/api/driver/v1/me/position: eingehende Position reaktiviert einen
--     fälschlich offline gesetzten Fahrer (active=true + Schicht läuft -> idle).
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
    AND COALESCE(last_position_at, updated_at, created_at) < now() - interval '30 minutes'
    -- Schonfrist nach Schichtstart: sonst kippt der Cron jeden Fahrer direkt
    -- nach dem Online-Gehen, weil die letzte Position von gestern stammt.
    AND COALESCE(shift_started_at, '-infinity'::timestamptz) < now() - interval '10 minutes';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$fn$;
