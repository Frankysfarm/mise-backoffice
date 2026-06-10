-- Migration 045: Smart Dispatch Queue Intelligence
--
-- Problem: Der Dispatch-Engine dispatcht Bestellungen in reiner FIFO-Reihenfolge
--          (ORDER BY created_at ASC). VIP/Express-Bestellungen, fertige Orders
--          und Zone-D-Bestellungen (längere ETA) warten hinter normalen Bestellungen.
--
-- Lösung:
--   1. dispatch_priority_boost — Admin kann einzelne Orders manuell hochstufen
--   2. compute_dispatch_priority() — Komposit-Score 0–100
--   3. v_dispatch_priority_queue — geordnete Queue-Sicht für Admin-Dashboard
--   4. Performance-Index für Priority-Queue-Abfragen

-- ── 1. Admin-Override-Spalte ──────────────────────────────────────────────────
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS dispatch_priority_boost integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN customer_orders.dispatch_priority_boost IS
  'Manueller Admin-Boost für die Dispatch-Priorität (Punkte 0–50). '
  'Wird zum compute_dispatch_priority()-Score addiert.';

-- ── 2. Komposit-Prioritätsfunktion ────────────────────────────────────────────
-- Berechnet einen Score 0–100 für jede unzugewiesene Lieferbestellung.
--
-- Faktoren:
--   Bestell-Priorität (0–40):   express=40 | vip=35 | rush=20 | normal=0
--   Küchen-Status    (0–25):    fertig=25  | in_zubereitung=10 | neu=0
--   Zone-Dringlichkeit (0–12):  D=12 | C=8 | B=4 | A=0
--   Wartezeit        (0–15):    +1 je 2 Minuten Wartezeit, max 15
--   Eskalation       (0–20):    +20 wenn dispatch_escalated_at gesetzt
--   Admin-Boost      (0–50):    COALESCE(dispatch_priority_boost, 0)
--
-- Ergebnis: LEAST(100, Summe) → immer im Bereich 0–100

CREATE OR REPLACE FUNCTION compute_dispatch_priority(p_order_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT LEAST(100,
    CASE o.priority
      WHEN 'express' THEN 40
      WHEN 'vip'     THEN 35
      WHEN 'rush'    THEN 20
      ELSE 0
    END
    + CASE o.status
      WHEN 'fertig'         THEN 25
      WHEN 'in_zubereitung' THEN 10
      ELSE 0
    END
    + CASE o.delivery_zone
      WHEN 'D' THEN 12
      WHEN 'C' THEN  8
      WHEN 'B' THEN  4
      ELSE 0
    END
    + LEAST(15, (EXTRACT(EPOCH FROM (now() - o.created_at)) / 120)::int)
    + CASE WHEN o.dispatch_escalated_at IS NOT NULL THEN 20 ELSE 0 END
    + COALESCE(o.dispatch_priority_boost, 0)
  )::integer
  FROM customer_orders o
  WHERE o.id = p_order_id
$$;

COMMENT ON FUNCTION compute_dispatch_priority IS
  'Berechnet den Dispatch-Priority-Score (0–100) für eine Lieferbestellung. '
  'Höherer Score = früher dispatchen.';

-- ── 3. Priority-Queue-View ─────────────────────────────────────────────────────
-- Zeigt alle wartenden Lieferbestellungen nach Priorität sortiert.
-- Wird vom Admin-Dashboard und vom Queue-Intelligence-Endpoint genutzt.

CREATE OR REPLACE VIEW v_dispatch_priority_queue AS
SELECT
  co.id,
  co.location_id,
  co.bestellnummer,
  co.status,
  co.priority,
  co.delivery_zone,
  co.gesamtbetrag,
  co.kunde_name,
  co.kunde_adresse,
  co.kunde_plz,
  co.kunde_stadt,
  co.created_at,
  co.dispatch_attempts,
  co.dispatch_escalated_at,
  co.dispatch_priority_boost,
  co.eta_earliest,
  co.eta_latest,
  -- Berechneter Score
  compute_dispatch_priority(co.id)                         AS queue_score,
  -- Score-Breakdown (für Dashboard-Anzeige)
  CASE co.priority
    WHEN 'express' THEN 'Express (+40)'
    WHEN 'vip'     THEN 'VIP (+35)'
    WHEN 'rush'    THEN 'Eilig (+20)'
    ELSE NULL
  END                                                       AS priority_label,
  CASE co.status
    WHEN 'fertig'         THEN 'Küche fertig (+25)'
    WHEN 'in_zubereitung' THEN 'In Zubereitung (+10)'
    ELSE NULL
  END                                                       AS status_label,
  CASE WHEN co.dispatch_escalated_at IS NOT NULL
    THEN 'Eskaliert (+20)' ELSE NULL
  END                                                       AS escalation_label,
  ROUND(EXTRACT(EPOCH FROM (now() - co.created_at)) / 60)  AS wait_minutes
FROM customer_orders co
WHERE co.typ = 'lieferung'
  AND co.mise_batch_id IS NULL
  AND co.status IN ('neu', 'in_zubereitung', 'fertig')
  AND (co.schedule_status IS NULL OR co.schedule_status <> 'scheduled')
ORDER BY
  compute_dispatch_priority(co.id) DESC,
  co.created_at ASC;

COMMENT ON VIEW v_dispatch_priority_queue IS
  'Wartende Lieferbestellungen (noch kein mise_batch_id) sortiert nach Dispatch-Priorität. '
  'Höchster Score zuerst → VIP/Express/Fertig/Zone-D werden zuerst dispatcht.';

-- ── 4. Performance-Indizes ─────────────────────────────────────────────────────

-- Index für Priority-Queue (ersetzt alten FIFO-Index, der nur created_at nutzte)
CREATE INDEX IF NOT EXISTS idx_orders_priority_queue
  ON customer_orders (location_id, status, priority, dispatch_attempts, created_at)
  WHERE typ = 'lieferung'
    AND mise_batch_id IS NULL;

-- Partial-Index für Admin-Boost (schnelle Suche nach manuell gepushten Orders)
CREATE INDEX IF NOT EXISTS idx_orders_priority_boost
  ON customer_orders (location_id, dispatch_priority_boost DESC)
  WHERE typ = 'lieferung'
    AND mise_batch_id IS NULL
    AND dispatch_priority_boost > 0;
