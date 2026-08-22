-- Migration 007: Konsolidierung + Fahrer-Performance-Statistiken
--
-- Zweck:
--  1. v_open_dispatch_batches — source_system ('legacy'|'mise') Spalte hinzufügen
--     FIX: Fahrer-App kann jetzt den richtigen RPC (claim_delivery_batch vs.
--     claim_mise_delivery_batch) aufrufen, statt immer den Legacy-RPC zu nutzen.
--  2. v_driver_performance_stats — Fahrer-KPIs für Admin-Dashboard
--  3. update_driver_delivery_stats() — Trigger: mise_drivers.total_deliveries
--     automatisch hochzählen wenn ein Stop als delivered markiert wird
--  4. v_delivery_batch_unified — schreibgeschützte Kompatibilitäts-View,
--     die BEIDE Batch-Systeme für interne Abfragen vereint

-- ============================================================
-- 1. v_open_dispatch_batches — source_system-Spalte ergänzen
-- ============================================================
CREATE OR REPLACE VIEW v_open_dispatch_batches AS

  -- Legacy (delivery_batches, status='pickup')
  SELECT
    db.id                         AS batch_id,
    l.tenant_id                   AS tenant_id,
    db.location_id                AS location_id,
    co.id                         AS order_id,
    co.bestellnummer,
    co.kunde_name,
    co.kunde_adresse,
    co.kunde_plz,
    co.kunde_stadt,
    co.kunde_lat,
    co.kunde_lng,
    co.gesamtbetrag,
    NULL::int                     AS geschaetzte_lieferung_min,
    l.name                        AS location_name,
    l.lat                         AS location_lat,
    l.lng                         AS location_lng,
    'legacy'::text                AS source_system
  FROM delivery_batches db
  JOIN delivery_batch_stops dbs ON dbs.batch_id = db.id
  JOIN customer_orders co       ON co.id = dbs.order_id
  LEFT JOIN locations l         ON l.id = db.location_id
  WHERE db.status = 'pickup'

UNION ALL

  -- Mise Smart-Dispatch (mise_delivery_batches, state='pending_acceptance')
  SELECT
    mdb.id                        AS batch_id,
    l.tenant_id                   AS tenant_id,
    co.location_id                AS location_id,
    co.id                         AS order_id,
    co.bestellnummer,
    co.kunde_name,
    co.kunde_adresse,
    co.kunde_plz,
    co.kunde_stadt,
    co.kunde_lat,
    co.kunde_lng,
    co.gesamtbetrag,
    NULL::int                     AS geschaetzte_lieferung_min,
    l.name                        AS location_name,
    l.lat                         AS location_lat,
    l.lng                         AS location_lng,
    'mise'::text                  AS source_system
  FROM mise_delivery_batches mdb
  JOIN mise_delivery_batch_stops mdbs
       ON mdbs.batch_id = mdb.id AND mdbs.type = 'dropoff'
  JOIN customer_orders co         ON co.id = mdbs.order_id
  LEFT JOIN locations l           ON l.id = co.location_id
  WHERE mdb.state = 'pending_acceptance';

COMMENT ON VIEW v_open_dispatch_batches IS
  'Fahrer-App Inbox: offene Touren aus Legacy- und Mise-System. '
  'source_system = ''legacy'' → claim_delivery_batch RPC. '
  'source_system = ''mise''   → claim_mise_delivery_batch RPC.';


-- ============================================================
-- 2. v_driver_performance_stats — Fahrer-KPIs
-- ============================================================
CREATE OR REPLACE VIEW v_driver_performance_stats AS
SELECT
  md.id                                             AS driver_id,
  md.auth_user_id,
  md.vehicle,
  md.active,
  md.state,
  md.total_deliveries,
  md.current_capacity,
  md.max_capacity,
  -- Heute gelieferte Stops
  COUNT(s.id)
    FILTER (WHERE s.completed_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Berlin')
                                AT TIME ZONE 'Europe/Berlin')
                                                    AS deliveries_today,
  -- Gestern gelieferte Stops
  COUNT(s.id)
    FILTER (WHERE s.completed_at >= (date_trunc('day', now() AT TIME ZONE 'Europe/Berlin')
                                     - INTERVAL '1 day') AT TIME ZONE 'Europe/Berlin'
                AND s.completed_at <  date_trunc('day', now() AT TIME ZONE 'Europe/Berlin')
                                    AT TIME ZONE 'Europe/Berlin')
                                                    AS deliveries_yesterday,
  -- Aktive Batch-ID
  (SELECT b.id FROM mise_delivery_batches b
   WHERE b.driver_id = md.id AND b.state IN ('assigned','at_restaurant','on_route')
   ORDER BY b.created_at DESC LIMIT 1)              AS active_batch_id,
  -- Letzter bekannter Standort
  (SELECT jsonb_build_object('lat', dl.lat, 'lng', dl.lng, 'at', dl.recorded_at)
   FROM driver_locations dl WHERE dl.driver_id = md.id
   ORDER BY dl.recorded_at DESC LIMIT 1)            AS last_position,
  -- Letzte Aktivität
  MAX(s.completed_at)                               AS last_delivery_at
FROM mise_drivers md
LEFT JOIN mise_delivery_batches b  ON b.driver_id = md.id
LEFT JOIN mise_delivery_batch_stops s
       ON s.batch_id = b.id
      AND s.type = 'dropoff'
      AND s.completed_at IS NOT NULL
GROUP BY md.id, md.auth_user_id, md.vehicle, md.active, md.state,
         md.total_deliveries, md.current_capacity, md.max_capacity;

COMMENT ON VIEW v_driver_performance_stats IS
  'Fahrer-KPIs: heutige/gestrige Lieferungen, aktiver Batch, letzter Standort. '
  'Basis für /api/delivery/admin/performance und statistics-view.';


-- ============================================================
-- 3. Trigger: total_deliveries automatisch hochzählen
--    Feuert wenn mise_delivery_batch_stops.completed_at gesetzt wird
-- ============================================================
CREATE OR REPLACE FUNCTION increment_driver_deliveries()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Nur dropoff-Stops zählen, und nur beim ersten Setzen von completed_at
  IF NEW.type = 'dropoff'
     AND NEW.completed_at IS NOT NULL
     AND (OLD.completed_at IS NULL) THEN

    UPDATE mise_drivers md
    SET total_deliveries = COALESCE(total_deliveries, 0) + 1
    FROM mise_delivery_batches b
    WHERE b.id = NEW.batch_id
      AND md.id = b.driver_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_driver_deliveries ON mise_delivery_batch_stops;
CREATE TRIGGER trg_increment_driver_deliveries
  AFTER UPDATE OF completed_at ON mise_delivery_batch_stops
  FOR EACH ROW EXECUTE FUNCTION increment_driver_deliveries();

COMMENT ON FUNCTION increment_driver_deliveries IS
  'Zählt mise_drivers.total_deliveries hoch, wenn ein Dropoff-Stop als zugestellt markiert wird.';


-- ============================================================
-- 4. v_delivery_batch_unified — schreibgeschützte Kompatibilitäts-View
--    Vereint beide Batch-Systeme für Admin-Abfragen
-- ============================================================
CREATE OR REPLACE VIEW v_delivery_batch_unified AS

  -- Legacy-System
  SELECT
    db.id                          AS batch_id,
    db.location_id,
    db.fahrer_id                   AS employee_id,
    NULL::uuid                     AS mise_driver_id,
    db.status                      AS display_state,
    db.startzeit                   AS started_at,
    db.created_at,
    NULL::int                      AS stop_count,
    NULL::numeric                  AS dispatch_score,
    'legacy'::text                 AS source_system
  FROM delivery_batches db

UNION ALL

  -- Mise-System
  SELECT
    mdb.id                         AS batch_id,
    co_loc.location_id,
    emp.id                         AS employee_id,
    mdb.driver_id                  AS mise_driver_id,
    CASE mdb.state
      WHEN 'pending_acceptance'  THEN 'pickup'
      WHEN 'assigned'            THEN 'zugewiesen'
      WHEN 'at_restaurant'       THEN 'pickup'
      WHEN 'on_route'            THEN 'unterwegs'
      WHEN 'completed'           THEN 'abgeschlossen'
      ELSE mdb.state
    END                            AS display_state,
    mdb.created_at                 AS started_at,
    mdb.created_at,
    mdb.stop_count,
    NULL::numeric                  AS dispatch_score,
    'mise'::text                   AS source_system
  FROM mise_delivery_batches mdb
  -- Location via erster Dropoff-Stop → customer_orders
  LEFT JOIN LATERAL (
    SELECT co.location_id
    FROM mise_delivery_batch_stops s
    JOIN customer_orders co ON co.id = s.order_id
    WHERE s.batch_id = mdb.id AND s.type = 'dropoff'
    LIMIT 1
  ) co_loc ON true
  -- Employee via mise_drivers.auth_user_id
  LEFT JOIN LATERAL (
    SELECT e.id
    FROM employees e
    WHERE e.auth_user_id = (
      SELECT md.auth_user_id FROM mise_drivers md WHERE md.id = mdb.driver_id
    )
    LIMIT 1
  ) emp ON true;

COMMENT ON VIEW v_delivery_batch_unified IS
  'Schreibgeschützte Admin-View: beide Batch-Systeme mit normalisierten Status-Labels. '
  'Nicht für Schreiboperationen verwenden — via assign_to_driver RPC oder Smart-Dispatch.';
