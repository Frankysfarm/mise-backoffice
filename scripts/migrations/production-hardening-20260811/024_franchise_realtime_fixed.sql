BEGIN;

-- Corrected production variant of migration 028. Drivers are related to a
-- tenant through mise_driver_tenants, not a missing mise_drivers.employee_id.

CREATE OR REPLACE VIEW public.v_location_realtime_status
WITH (security_invoker = true) AS
SELECT
  l.id AS location_id,
  l.name AS location_name,
  l.tenant_id,
  (SELECT COUNT(*)::integer
   FROM public.customer_orders o
   WHERE o.location_id = l.id
     AND o.typ = 'lieferung'
     AND o.status IN ('neu', 'bestätigt', 'in_zubereitung', 'fertig')
     AND o.mise_batch_id IS NULL
     AND (o.schedule_status IS NULL OR o.schedule_status <> 'scheduled')) AS queue_depth,
  (SELECT COUNT(*)::integer
   FROM public.mise_delivery_batches b
   WHERE b.location_id = l.id
     AND b.state NOT IN ('completed', 'cancelled')) AS active_tours,
  (SELECT COUNT(*)::integer
   FROM public.customer_orders o
   WHERE o.location_id = l.id AND o.status = 'in_zubereitung') AS cooking_now,
  (SELECT EXTRACT(EPOCH FROM (now() - MIN(o.created_at))) / 60
   FROM public.customer_orders o
   WHERE o.location_id = l.id
     AND o.typ = 'lieferung'
     AND o.status IN ('neu', 'bestätigt', 'in_zubereitung', 'fertig')
     AND o.mise_batch_id IS NULL
     AND (o.schedule_status IS NULL OR o.schedule_status <> 'scheduled'))::numeric(10,1)
    AS oldest_queued_min,
  (SELECT COUNT(*)::integer
   FROM public.customer_orders o
   WHERE o.location_id = l.id
     AND o.status IN ('geliefert', 'abgeholt')
     AND o.created_at >=
       date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')
    AS completed_today,
  (SELECT COUNT(*)::integer
   FROM public.delivery_alerts a
   WHERE a.location_id = l.id::text AND a.resolved_at IS NULL) AS active_alerts,
  (SELECT COUNT(*)::integer
   FROM public.delivery_alerts a
   WHERE a.location_id = l.id::text
     AND a.resolved_at IS NULL
     AND a.severity = 'critical') AS critical_alerts
FROM public.locations l;

CREATE OR REPLACE VIEW public.v_tenant_driver_summary
WITH (security_invoker = true) AS
SELECT
  membership.tenant_id,
  COUNT(DISTINCT d.id) FILTER (WHERE d.active AND d.state <> 'offline')::integer
    AS drivers_online,
  COUNT(DISTINCT d.id) FILTER (WHERE d.active AND d.state = 'idle')::integer
    AS drivers_idle,
  COUNT(DISTINCT d.id) FILTER (
    WHERE d.active AND d.state IN ('assigned', 'at_restaurant', 'en_route', 'returning')
  )::integer AS drivers_busy
FROM public.mise_driver_tenants membership
JOIN public.mise_drivers d ON d.id = membership.driver_id
WHERE membership.status = 'active'
GROUP BY membership.tenant_id;

CREATE INDEX IF NOT EXISTS idx_customer_orders_franchise_queue
  ON public.customer_orders(location_id, typ, status, mise_batch_id)
  WHERE typ = 'lieferung'
    AND status IN ('neu', 'bestätigt', 'in_zubereitung', 'fertig')
    AND mise_batch_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_batches_franchise_active
  ON public.mise_delivery_batches(location_id, state)
  WHERE state NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_driver_tenants_tenant_status
  ON public.mise_driver_tenants(tenant_id, status, driver_id);

REVOKE ALL PRIVILEGES ON TABLE
  public.v_location_realtime_status,
  public.v_tenant_driver_summary
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE
  public.v_location_realtime_status,
  public.v_tenant_driver_summary
  TO authenticated, service_role;

COMMIT;
