-- Migration 028: Franchise Real-Time Command Center
--
-- Cross-location real-time KPI views for franchise operators managing
-- multiple restaurant locations within one tenant.
--
-- Views:
--   v_location_realtime_status  — Per-location operational snapshot
--   v_tenant_driver_summary     — Tenant-wide driver distribution
--
-- These complement the period-based v_daily_location_kpis (Migration 026)
-- with live data: queue depth, active tours, kitchen load, alerts.

-- ============================================================
-- 1. v_location_realtime_status
--    Real-time operational snapshot per location.
--    No arguments — computed on SELECT, safe for low-latency polling.
-- ============================================================
CREATE OR REPLACE VIEW v_location_realtime_status AS
SELECT
  l.id                 AS location_id,
  l.name               AS location_name,
  l.tenant_id,

  -- Unassigned delivery orders waiting for a driver
  (SELECT COUNT(*)::int
   FROM   customer_orders co
   WHERE  co.location_id = l.id
     AND  co.typ         = 'lieferung'
     AND  co.status      IN ('neu', 'bestätigt', 'in_zubereitung', 'fertig')
     AND  co.mise_batch_id IS NULL
     AND  (co.schedule_status IS NULL OR co.schedule_status <> 'scheduled')
  ) AS queue_depth,

  -- Active tours (assigned → on_route, not yet completed/cancelled)
  (SELECT COUNT(*)::int
   FROM   mise_delivery_batches b
   WHERE  b.location_id = l.id
     AND  b.state NOT IN ('completed', 'cancelled')
  ) AS active_tours,

  -- Orders currently being cooked at this location
  (SELECT COUNT(*)::int
   FROM   customer_orders co
   WHERE  co.location_id = l.id
     AND  co.status = 'in_zubereitung'
  ) AS cooking_now,

  -- Oldest unassigned order age in minutes (NULL = queue empty)
  (SELECT EXTRACT(EPOCH FROM (NOW() - MIN(co.created_at))) / 60
   FROM   customer_orders co
   WHERE  co.location_id     = l.id
     AND  co.typ             = 'lieferung'
     AND  co.status          IN ('neu', 'bestätigt', 'in_zubereitung', 'fertig')
     AND  co.mise_batch_id   IS NULL
     AND  (co.schedule_status IS NULL OR co.schedule_status <> 'scheduled')
  )::numeric(6,1) AS oldest_queued_min,

  -- Orders completed (delivered/picked up) since UTC midnight
  (SELECT COUNT(*)::int
   FROM   customer_orders co
   WHERE  co.location_id = l.id
     AND  co.status IN ('geliefert', 'abgeholt')
     AND  co.created_at >= CURRENT_DATE
  ) AS completed_today,

  -- Unresolved operational alerts
  (SELECT COUNT(*)::int
   FROM   delivery_alerts da
   WHERE  da.location_id = l.id::text
     AND  da.resolved_at IS NULL
  ) AS active_alerts,

  -- Critical-severity unresolved alerts
  (SELECT COUNT(*)::int
   FROM   delivery_alerts da
   WHERE  da.location_id = l.id::text
     AND  da.resolved_at IS NULL
     AND  da.severity = 'critical'
  ) AS critical_alerts

FROM locations l;

COMMENT ON VIEW v_location_realtime_status IS
  'Real-time operational KPIs per location. '
  'Used by franchise dashboard to compare locations side-by-side without historical aggregation. '
  'Refreshed on every SELECT — not cached.';

-- ============================================================
-- 2. v_tenant_driver_summary
--    Tenant-wide driver headcount by state.
--    Drivers are shared across all locations of a tenant.
-- ============================================================
CREATE OR REPLACE VIEW v_tenant_driver_summary AS
SELECT
  l.tenant_id,
  COUNT(*)::int                           FILTER (WHERE d.active AND d.state <> 'offline') AS drivers_online,
  COUNT(*)::int                           FILTER (WHERE d.active AND d.state = 'idle')      AS drivers_idle,
  COUNT(*)::int                           FILTER (WHERE d.active AND d.state IN (
    'assigned', 'at_restaurant', 'en_route', 'returning'
  ))                                                                                         AS drivers_busy
FROM  mise_drivers  d
JOIN  employees     e  ON e.id          = d.employee_id
JOIN  locations     l  ON l.id          = e.location_id
GROUP BY l.tenant_id;

COMMENT ON VIEW v_tenant_driver_summary IS
  'Driver headcount per tenant (online / idle / busy). '
  'Drivers are shared resources across all locations of a tenant.';

-- ============================================================
-- 3. Performance indexes for view subqueries
-- ============================================================

-- Franchise queue scan: unassigned delivery orders per location
CREATE INDEX IF NOT EXISTS idx_customer_orders_franchise_queue
  ON customer_orders (location_id, typ, status, mise_batch_id)
  WHERE typ = 'lieferung'
    AND status IN ('neu', 'bestätigt', 'in_zubereitung', 'fertig')
    AND mise_batch_id IS NULL;

-- Franchise active-tours scan
CREATE INDEX IF NOT EXISTS idx_batches_franchise_active
  ON mise_delivery_batches (location_id, state)
  WHERE state NOT IN ('completed', 'cancelled');

-- Driver summary via employees → locations
CREATE INDEX IF NOT EXISTS idx_employees_location_auth
  ON employees (location_id, id);
