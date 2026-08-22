BEGIN;

CREATE OR REPLACE FUNCTION public.mark_stale_drivers_offline()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.mise_drivers
  SET state = 'offline',
      updated_at = now()
  WHERE active = true
    AND state <> 'offline'
    AND COALESCE(last_position_at, updated_at, created_at) < now() - interval '30 minutes';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_stale_drivers_offline() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_stale_drivers_offline() TO service_role;

COMMIT;
