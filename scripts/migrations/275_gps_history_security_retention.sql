-- Harden the existing driver GPS history and provide bounded retention.
-- Position writes are performed by the server-side service role.

ALTER TABLE public.mise_driver_locations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mise_driver_locations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mise_driver_locations TO service_role;

CREATE OR REPLACE FUNCTION public.fn_cleanup_mise_driver_locations(
  p_keep_days integer DEFAULT 30,
  p_limit integer DEFAULT 10000
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted bigint;
BEGIN
  IF p_keep_days < 7 OR p_keep_days > 365 THEN
    RAISE EXCEPTION 'p_keep_days must be between 7 and 365';
  END IF;
  IF p_limit < 1 OR p_limit > 50000 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 50000';
  END IF;

  DELETE FROM public.mise_driver_locations
  WHERE id IN (
    SELECT id
    FROM public.mise_driver_locations
    WHERE recorded_at < now() - make_interval(days => p_keep_days)
    ORDER BY recorded_at
    LIMIT p_limit
  );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cleanup_mise_driver_locations(integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cleanup_mise_driver_locations(integer, integer)
  TO service_role, postgres;

COMMENT ON TABLE public.mise_driver_locations IS
  'Server-written GPS history for delivery drivers. Retained for 30 days by the production cleanup job.';

NOTIFY pgrst, 'reload schema';
