-- ─── Phase 312 — Revenue Velocity Engine ─────────────────────────────────────
-- Stündliche Umsatz-Velocity-Snapshots je Location.
-- Liefert: Umsatz/Stunde, Ø Bestellwert, Heute-vs-Gestern-Trend.

-- ── 1. Snapshot-Tabelle ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revenue_velocity_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  hour_bucket     TIMESTAMPTZ NOT NULL,           -- Stundenbeginn UTC (trunc to hour)
  revenue_eur     NUMERIC(10,2) NOT NULL DEFAULT 0,
  orders_count    INT         NOT NULL DEFAULT 0,
  avg_order_value NUMERIC(10,2),                  -- revenue / orders
  velocity_eur_h  NUMERIC(10,2),                  -- revenue in this 1-hour slot
  delivery_count  INT         NOT NULL DEFAULT 0, -- nur typ=lieferung
  pickup_count    INT         NOT NULL DEFAULT 0, -- nur typ=abholung
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(location_id, hour_bucket)
);

-- ── 2. Indizes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rev_vel_location_hour
  ON revenue_velocity_snapshots(location_id, hour_bucket DESC);

-- ── 3. View: Heute ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_revenue_velocity_today AS
SELECT
  location_id,
  SUM(revenue_eur)                                            AS today_revenue,
  SUM(orders_count)                                          AS today_orders,
  ROUND(AVG(avg_order_value)::numeric, 2)                    AS avg_order_value,
  MAX(velocity_eur_h)                                        AS peak_velocity,
  SUM(delivery_count)                                        AS delivery_count,
  SUM(pickup_count)                                          AS pickup_count,
  COUNT(*)                                                   AS hours_with_data,
  -- Umsatz der letzten vollen Stunde als "aktuelle Velocity"
  (
    SELECT velocity_eur_h
    FROM   revenue_velocity_snapshots s2
    WHERE  s2.location_id = rvs.location_id
    ORDER  BY s2.hour_bucket DESC
    LIMIT  1
  )                                                          AS current_velocity
FROM revenue_velocity_snapshots rvs
WHERE hour_bucket >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
  AND hour_bucket <  date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + INTERVAL '1 day'
GROUP BY location_id;

-- ── 4. RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE revenue_velocity_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "location members read revenue_velocity" ON revenue_velocity_snapshots;
CREATE POLICY "location members read revenue_velocity"
  ON revenue_velocity_snapshots FOR SELECT
  USING (
    location_id IN (
      SELECT e.location_id FROM employees e WHERE e.auth_user_id = auth.uid()
    )
  );

-- ── 5. Prune-Funktion ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_revenue_velocity_snapshots(days_old INT DEFAULT 30)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE deleted INT;
BEGIN
  DELETE FROM revenue_velocity_snapshots
  WHERE created_at < now() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
