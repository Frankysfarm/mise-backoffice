-- Migration 119: Smart Delivery Promise Engine (Phase 229)
-- Track delivery promises made at order placement + actual accuracy

CREATE TABLE IF NOT EXISTS delivery_promises (
  id                  uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id            uuid          NOT NULL,
  location_id         uuid          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  promised_min        int           NOT NULL CHECK (promised_min > 0),
  promised_max        int           NOT NULL CHECK (promised_max >= promised_min),
  confidence_score    int           NOT NULL DEFAULT 70 CHECK (confidence_score BETWEEN 0 AND 100),
  zone_name           text,
  promised_at         timestamptz   NOT NULL DEFAULT now(),
  -- Settled when order is delivered
  actual_delivery_min int,
  settled_at          timestamptz,
  accuracy_bucket     text          GENERATED ALWAYS AS (
    CASE
      WHEN actual_delivery_min IS NULL THEN NULL
      WHEN actual_delivery_min <= promised_min                      THEN 'early'
      WHEN actual_delivery_min <= promised_max                      THEN 'on_time'
      WHEN actual_delivery_min <= promised_max + 10                 THEN 'late'
      ELSE                                                               'very_late'
    END
  ) STORED,
  miss_by_min         int           GENERATED ALWAYS AS (
    CASE
      WHEN actual_delivery_min IS NULL THEN NULL
      WHEN actual_delivery_min > promised_max THEN actual_delivery_min - promised_max
      ELSE 0
    END
  ) STORED,
  -- Context factors captured at promise time
  queue_depth         int           NOT NULL DEFAULT 0,
  available_drivers   int           NOT NULL DEFAULT 0,
  weather_factor      numeric(4,2)  NOT NULL DEFAULT 1.00,
  surge_active        boolean       NOT NULL DEFAULT false,
  UNIQUE (order_id)
);

ALTER TABLE delivery_promises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_delivery_promises" ON delivery_promises
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_delivery_promise_loc_promised
  ON delivery_promises (location_id, promised_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_promise_unsettled
  ON delivery_promises (location_id, promised_at)
  WHERE settled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_promise_accuracy
  ON delivery_promises (location_id, accuracy_bucket)
  WHERE accuracy_bucket IS NOT NULL;

-- Daily accuracy rollup view
CREATE OR REPLACE VIEW v_promise_accuracy_daily AS
SELECT
  location_id,
  date_trunc('day', promised_at)::date AS promise_date,
  COUNT(*)                             AS total_promises,
  COUNT(settled_at)                    AS settled_count,
  COUNT(*) FILTER (WHERE accuracy_bucket = 'early')     AS early_count,
  COUNT(*) FILTER (WHERE accuracy_bucket = 'on_time')   AS on_time_count,
  COUNT(*) FILTER (WHERE accuracy_bucket = 'late')      AS late_count,
  COUNT(*) FILTER (WHERE accuracy_bucket = 'very_late') AS very_late_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE accuracy_bucket IN ('early', 'on_time'))
    / NULLIF(COUNT(settled_at), 0), 1
  )                                    AS on_time_rate_pct,
  ROUND(AVG(actual_delivery_min) FILTER (WHERE actual_delivery_min IS NOT NULL), 1) AS avg_actual_min,
  ROUND(AVG(promised_max - promised_min), 1)                                        AS avg_window_width_min,
  ROUND(AVG(miss_by_min) FILTER (WHERE miss_by_min > 0), 1)                        AS avg_miss_min
FROM delivery_promises
WHERE promised_at >= now() - interval '90 days'
GROUP BY location_id, date_trunc('day', promised_at)::date
ORDER BY location_id, promise_date DESC;

-- 7-day KPI view
CREATE OR REPLACE VIEW v_promise_kpis_7d AS
SELECT
  location_id,
  COUNT(*)                                                                           AS total_7d,
  COUNT(settled_at)                                                                  AS settled_7d,
  ROUND(100.0 * COUNT(*) FILTER (WHERE accuracy_bucket IN ('early', 'on_time'))
    / NULLIF(COUNT(settled_at), 0), 1)                                               AS on_time_rate_pct,
  ROUND(AVG(actual_delivery_min) FILTER (WHERE actual_delivery_min IS NOT NULL), 1) AS avg_actual_min,
  ROUND(AVG(promised_min + promised_max) / 2.0, 1)                                  AS avg_promise_midpoint,
  ROUND(AVG(miss_by_min) FILTER (WHERE miss_by_min > 0), 1)                        AS avg_miss_min,
  COUNT(*) FILTER (WHERE accuracy_bucket = 'very_late')                             AS very_late_7d
FROM delivery_promises
WHERE promised_at >= now() - interval '7 days'
GROUP BY location_id;

-- Cleanup RPC
CREATE OR REPLACE FUNCTION prune_old_delivery_promises(days_to_keep int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM delivery_promises
  WHERE settled_at IS NOT NULL
    AND settled_at < now() - (days_to_keep || ' days')::interval;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
