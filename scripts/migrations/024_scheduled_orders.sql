-- Migration 024: Scheduled Orders + Pre-Order Management
--
-- Ermöglicht Kunden Bestellungen für einen zukünftigen Zeitpunkt aufzugeben.
-- Der Dispatch-Engine werden erst dispatcht wenn scheduled_at - prep_time erreicht ist.

-- -----------------------------------------------------------------------
-- 1. Neue Spalten auf customer_orders
-- -----------------------------------------------------------------------
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS scheduled_at     timestamptz  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS schedule_status  text         DEFAULT NULL
    CHECK (schedule_status IN ('scheduled', 'released', 'immediate'));

-- Bestehende Bestellungen ohne scheduled_at bleiben NULL → sofort-Dispatch.
-- Neue ASAP-Bestellungen: scheduled_at=NULL, schedule_status=NULL (oder 'immediate').
-- Vorbestell-Bestellungen: scheduled_at=Zielzeit, schedule_status='scheduled'.
-- Freigegebene:            schedule_status='released' → Dispatch greift zu.

-- -----------------------------------------------------------------------
-- 2. Performance-Indizes
-- -----------------------------------------------------------------------
-- Cron-Scan: geplante, noch nicht freigegebene Orders
CREATE INDEX IF NOT EXISTS idx_customer_orders_scheduled
  ON customer_orders (scheduled_at, location_id)
  WHERE schedule_status = 'scheduled';

-- Admin-Übersicht: nächste 4h geplante Orders
CREATE INDEX IF NOT EXISTS idx_customer_orders_schedule_status
  ON customer_orders (schedule_status, location_id, scheduled_at)
  WHERE schedule_status IS NOT NULL;

-- -----------------------------------------------------------------------
-- 3. View: nächste 24h Vorbestellungen
-- -----------------------------------------------------------------------
CREATE OR REPLACE VIEW v_scheduled_orders AS
SELECT
  co.id,
  co.location_id,
  co.bestellnummer,
  co.kunde_name,
  co.kunde_adresse,
  co.scheduled_at,
  co.schedule_status,
  co.status           AS order_status,
  co.typ              AS order_type,
  co.gesamtbetrag,
  co.estimated_prep_min,
  -- Wann muss die Küche anfangen? scheduled_at - prep_time
  (co.scheduled_at - INTERVAL '1 minute' * COALESCE(co.estimated_prep_min, 20))
                      AS kitchen_start_at,
  -- Verbleibende Zeit bis Küchenbeginn (Minuten)
  EXTRACT(EPOCH FROM (
    (co.scheduled_at - INTERVAL '1 minute' * COALESCE(co.estimated_prep_min, 20)) - NOW()
  )) / 60             AS mins_until_kitchen_start,
  -- Ist die Order bereits fällig für den Dispatch?
  CASE WHEN schedule_status = 'released' THEN true
       WHEN schedule_status = 'scheduled' AND
            (scheduled_at - INTERVAL '1 minute' * COALESCE(co.estimated_prep_min, 20)) <= NOW()
            THEN true
       ELSE false
  END                 AS ready_for_dispatch,
  co.created_at
FROM customer_orders co
WHERE co.scheduled_at IS NOT NULL
  AND co.scheduled_at <= NOW() + INTERVAL '24 hours'
  AND co.status NOT IN ('storniert', 'cancelled', 'geliefert', 'abgeholt')
ORDER BY co.scheduled_at ASC;

-- -----------------------------------------------------------------------
-- 4. Funktion: geplante Orders automatisch freigeben
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION release_due_scheduled_orders()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_released integer := 0;
BEGIN
  -- Freigabe: scheduled_at - prep_time <= NOW()
  UPDATE customer_orders
  SET    schedule_status = 'released'
  WHERE  schedule_status = 'scheduled'
    AND  (
           scheduled_at - INTERVAL '1 minute' * COALESCE(estimated_prep_min, 20)
         ) <= NOW();

  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

COMMENT ON FUNCTION release_due_scheduled_orders IS
  'Gibt geplante Bestellungen für den Dispatch frei wenn scheduled_at - prep_time erreicht ist.';
