-- 108_order_amendments.sql
-- Phase 211: Smart Order Amendment Engine
-- Tracks post-order modifications with full audit trail, dispatch re-evaluation,
-- and admin analytics.

-- ── order_amendments ─────────────────────────────────────────────────────────
-- One row per field change on a customer_order after it was placed.
CREATE TABLE IF NOT EXISTS order_amendments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id         uuid        NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  amended_by_user  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  amendment_type   text        NOT NULL
    CONSTRAINT chk_amendment_type CHECK (amendment_type IN (
      'item_added', 'item_removed', 'item_changed',
      'address_changed', 'phone_changed', 'notes_changed',
      'amount_adjusted', 'tip_changed', 'priority_changed', 'other'
    )),
  field_name       text,
  old_value        jsonb,
  new_value        jsonb,
  reason           text,
  affected_dispatch boolean     NOT NULL DEFAULT false,
  eta_recalculated  boolean     NOT NULL DEFAULT false,
  delta_eur        numeric(10,2) NOT NULL DEFAULT 0,
  batch_id         uuid,        -- batch that was in-flight when amendment happened
  created_at       timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_amendments_order_id_idx     ON order_amendments(order_id);
CREATE INDEX IF NOT EXISTS order_amendments_location_id_idx  ON order_amendments(location_id);
CREATE INDEX IF NOT EXISTS order_amendments_created_at_idx   ON order_amendments(created_at DESC);
CREATE INDEX IF NOT EXISTS order_amendments_type_idx         ON order_amendments(amendment_type);

ALTER TABLE order_amendments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON order_amendments FOR ALL TO service_role USING (true);

-- ── amendment_type_counts VIEW ────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_amendment_type_counts AS
SELECT
  location_id,
  amendment_type,
  COUNT(*)                                                      AS total_count,
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)           AS today_count,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS week_count,
  AVG(ABS(delta_eur)) FILTER (WHERE delta_eur <> 0)           AS avg_delta_eur,
  COUNT(*) FILTER (WHERE affected_dispatch)                     AS dispatch_impacted
FROM order_amendments
GROUP BY location_id, amendment_type;

-- ── v_amendments_daily ────────────────────────────────────────────────────────
-- Daily KPIs per location (last 30 days).
CREATE OR REPLACE VIEW v_amendments_daily AS
SELECT
  location_id,
  DATE(created_at)                               AS day,
  COUNT(*)                                       AS total_amendments,
  COUNT(DISTINCT order_id)                       AS unique_orders,
  COUNT(*) FILTER (WHERE affected_dispatch)      AS dispatch_impacted,
  COALESCE(SUM(delta_eur), 0)                    AS delta_eur_total,
  COUNT(*) FILTER (WHERE delta_eur > 0)          AS upsell_amendments,
  COUNT(*) FILTER (WHERE delta_eur < 0)          AS discount_amendments
FROM order_amendments
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY location_id, DATE(created_at);

-- ── v_amended_orders_in_flight ────────────────────────────────────────────────
-- Orders modified while they were already picked up / in dispatch.
CREATE OR REPLACE VIEW v_amended_orders_in_flight AS
SELECT DISTINCT ON (co.id)
  co.id                      AS order_id,
  co.location_id,
  co.bestellnummer,
  co.status,
  co.kunde_name,
  co.mise_batch_id,
  co.gesamtbetrag,
  oa.id                      AS latest_amendment_id,
  oa.amendment_type          AS latest_type,
  oa.delta_eur               AS latest_delta_eur,
  oa.affected_dispatch,
  oa.created_at              AS amended_at,
  oa.reason
FROM customer_orders co
JOIN order_amendments oa ON oa.order_id = co.id
WHERE co.status IN ('offen', 'in_zubereitung', 'fertig', 'abholbereit')
  AND oa.created_at >= NOW() - INTERVAL '4 hours'
ORDER BY co.id, oa.created_at DESC;

-- ── v_amendment_summary ───────────────────────────────────────────────────────
-- Single-row KPI summary per location.
CREATE OR REPLACE VIEW v_amendment_summary AS
SELECT
  location_id,
  COUNT(*)                                                         AS total_all_time,
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)              AS today_count,
  COUNT(DISTINCT order_id) FILTER (WHERE created_at >= CURRENT_DATE) AS today_unique_orders,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS week_count,
  COUNT(*) FILTER (WHERE affected_dispatch)                        AS dispatch_impacted_all,
  COALESCE(SUM(delta_eur) FILTER (WHERE created_at >= CURRENT_DATE), 0) AS delta_eur_today,
  COALESCE(SUM(delta_eur) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0) AS delta_eur_week,
  COUNT(*) FILTER (WHERE delta_eur > 0 AND created_at >= CURRENT_DATE) AS upsells_today,
  COUNT(*) FILTER (WHERE delta_eur < 0 AND created_at >= CURRENT_DATE) AS discounts_today
FROM order_amendments
GROUP BY location_id;

-- ── prune function ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_amendments(days_to_keep integer DEFAULT 90)
RETURNS integer AS $$
DECLARE deleted integer;
BEGIN
  WITH del AS (
    DELETE FROM order_amendments
    WHERE created_at < NOW() - (days_to_keep || ' days')::interval
    RETURNING 1
  ) SELECT COUNT(*) INTO deleted FROM del;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
