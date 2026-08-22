BEGIN;

-- Supabase default privileges grant newly created tables broadly. Keep the
-- browser role read-only and leave all writes to the service-role workers.

REVOKE ALL PRIVILEGES ON TABLE public.delivery_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.delivery_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_events TO service_role;

REVOKE ALL PRIVILEGES ON TABLE public.delivery_demand_snapshots
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.delivery_demand_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.delivery_demand_snapshots TO service_role;

REVOKE ALL PRIVILEGES ON TABLE
  public.v_delivery_today_stats,
  public.v_hourly_demand_pattern,
  public.v_forecast_coverage_recs
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
  public.v_delivery_today_stats,
  public.v_hourly_demand_pattern,
  public.v_forecast_coverage_recs
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_delivery_trends(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_trends(uuid)
  TO authenticated, service_role;

COMMIT;
