-- Migration 013: Dispatch-Eskalation-Tracking
--
-- Problem: Wenn kein Fahrer verfügbar ist, bleibt eine Bestellung dauerhaft "held".
-- Keine Sichtbarkeit für Admins, keine automatische Eskalation.
--
-- Lösung:
--   1. dispatch_attempts / last_dispatch_attempt_at / dispatch_escalated_at auf customer_orders
--   2. Index für Stale-Order-Abfragen
--   3. v_stale_unassigned_orders — Admin-View für unzugewiesene Bestellungen >10 Min
--   4. notify_stale_dispatch() — Admin-Alarm via pg_notify (Supabase Realtime)

-- ============================================================
-- 1. Neue Spalten auf customer_orders
-- ============================================================
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS dispatch_attempts         integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dispatch_attempt_at  timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_escalated_at     timestamptz;

COMMENT ON COLUMN customer_orders.dispatch_attempts IS
  'Anzahl fehlgeschlagener Dispatch-Versuche (Ergebnis "held"). Reset auf 0 bei Zuweisung.';
COMMENT ON COLUMN customer_orders.last_dispatch_attempt_at IS
  'UTC-Zeitpunkt des letzten Dispatch-Versuchs — auch wenn gehalten.';
COMMENT ON COLUMN customer_orders.dispatch_escalated_at IS
  'UTC-Zeitpunkt der ersten Radius-Eskalation (gesetzt ab dispatch_attempts >= 3).';

-- ============================================================
-- 2. Index für Stale-Order- und Eskalations-Abfragen
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_customer_orders_held_attempts
  ON customer_orders (location_id, created_at ASC, dispatch_attempts)
  WHERE typ = 'lieferung'
    AND mise_batch_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_orders_escalation_needed
  ON customer_orders (dispatch_attempts, created_at)
  WHERE typ = 'lieferung'
    AND mise_batch_id IS NULL
    AND dispatch_escalated_at IS NULL;

-- ============================================================
-- 3. v_stale_unassigned_orders — Bestellungen ohne Zuweisung >10 Min
-- ============================================================
CREATE OR REPLACE VIEW v_stale_unassigned_orders AS
SELECT
  co.id,
  co.location_id,
  co.bestellnummer,
  co.created_at,
  co.status,
  co.delivery_zone,
  co.priority,
  co.dispatch_attempts,
  co.last_dispatch_attempt_at,
  co.dispatch_escalated_at,
  co.kunde_adresse,
  co.kunde_plz,
  co.kunde_stadt,
  ROUND(EXTRACT(EPOCH FROM (now() - co.created_at)) / 60)::integer AS age_min,
  CASE
    WHEN co.dispatch_escalated_at IS NOT NULL THEN 'escalated'
    WHEN co.dispatch_attempts >= 3             THEN 'needs_escalation'
    WHEN co.dispatch_attempts >= 1             THEN 'retry'
    ELSE                                            'first_hold'
  END AS escalation_status
FROM customer_orders co
WHERE co.typ         = 'lieferung'
  AND co.mise_batch_id IS NULL
  AND co.status NOT IN ('storniert', 'abgeschlossen', 'geliefert')
  AND co.created_at < now() - INTERVAL '10 minutes'
ORDER BY co.dispatch_attempts DESC, co.created_at ASC;

COMMENT ON VIEW v_stale_unassigned_orders IS
  'Lieferbestellungen ohne Fahrer-Zuweisung seit >10 Minuten. '
  'Dient Admin-Alert, Eskalations-Cron und manueller Nachbearbeitung.';

-- ============================================================
-- 4. reset_dispatch_attempts() — nach erfolgreicher Zuweisung
--    Wird via Trigger aufgerufen wenn mise_batch_id gesetzt wird
-- ============================================================
CREATE OR REPLACE FUNCTION reset_dispatch_attempts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Wenn mise_batch_id neu gesetzt wird (war NULL, ist jetzt NOT NULL)
  IF OLD.mise_batch_id IS NULL AND NEW.mise_batch_id IS NOT NULL THEN
    NEW.dispatch_attempts        := 0;
    NEW.last_dispatch_attempt_at := now();
    -- dispatch_escalated_at bleibt als Audit-Trail
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_dispatch_attempts ON customer_orders;
CREATE TRIGGER trg_reset_dispatch_attempts
  BEFORE UPDATE OF mise_batch_id ON customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION reset_dispatch_attempts();

-- ============================================================
-- 5. RLS: service_role kann lesen/schreiben, authenticated kann lesen
-- ============================================================
-- (customer_orders hat bereits RLS — neue Spalten erben die Policy)
-- View ist nicht direkt RLS-geschützt; Zugriff über Auth-API-Routes
