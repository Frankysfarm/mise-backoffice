-- Migration 153: Smart Order Delay Prediction Engine
-- Phase 316 — Proactive delay risk scoring at order creation

-- ─── Main predictions table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_delay_predictions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  location_id           UUID NOT NULL,
  predicted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Risk output
  delay_risk_score      SMALLINT NOT NULL CHECK (delay_risk_score BETWEEN 0 AND 100),
  risk_level            TEXT NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  predicted_delay_min   SMALLINT,       -- additional minutes beyond promised ETA

  -- Input signals (stored for analysis + model improvement)
  risk_factors          JSONB NOT NULL DEFAULT '{}',

  -- Settlement (filled after delivery)
  actual_delay_min      SMALLINT,
  settled_at            TIMESTAMPTZ,

  -- Dedup: one active prediction per order
  UNIQUE (order_id),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_order_delay_predictions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_odp_updated_at ON order_delay_predictions;
CREATE TRIGGER trg_odp_updated_at
  BEFORE UPDATE ON order_delay_predictions
  FOR EACH ROW EXECUTE FUNCTION update_order_delay_predictions_updated_at();

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_odp_location_at   ON order_delay_predictions (location_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_odp_order_id      ON order_delay_predictions (order_id);
CREATE INDEX IF NOT EXISTS idx_odp_risk_level    ON order_delay_predictions (location_id, risk_level, settled_at);

-- ─── Accuracy view ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_delay_prediction_accuracy AS
SELECT
  location_id,
  risk_level,
  COUNT(*)                                                         AS total_predictions,
  COUNT(*) FILTER (WHERE settled_at IS NOT NULL)                   AS settled,
  ROUND(AVG(delay_risk_score))::INT                                AS avg_risk_score,
  ROUND(AVG(predicted_delay_min))::INT                             AS avg_predicted_delay_min,
  ROUND(AVG(actual_delay_min))::INT                                AS avg_actual_delay_min,
  ROUND(AVG(ABS(COALESCE(actual_delay_min,0) - COALESCE(predicted_delay_min,0))))::INT
                                                                   AS avg_abs_error_min,
  -- High-risk prediction accuracy: did we correctly flag the late ones?
  COUNT(*) FILTER (WHERE settled_at IS NOT NULL AND actual_delay_min > 5)::FLOAT /
    NULLIF(COUNT(*) FILTER (WHERE settled_at IS NOT NULL), 0)      AS actual_late_rate
FROM order_delay_predictions
GROUP BY location_id, risk_level;

-- ─── Active predictions view ──────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_active_delay_predictions AS
SELECT
  p.*,
  o.bestellnummer,
  o.status            AS order_status,
  o.kunde_adresse,
  o.created_at        AS order_created_at,
  o.eta_earliest,
  o.delivery_zone
FROM order_delay_predictions p
JOIN customer_orders o ON o.id = p.order_id
WHERE p.settled_at IS NULL
  AND o.status NOT IN ('geliefert','storniert','abgebrochen');

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE order_delay_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_full_access" ON order_delay_predictions;
CREATE POLICY "service_full_access" ON order_delay_predictions
  USING (true) WITH CHECK (true);

-- ─── Cleanup RPC ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_delay_predictions(days_old INT DEFAULT 30)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted INT;
BEGIN
  DELETE FROM order_delay_predictions
  WHERE settled_at IS NOT NULL
    AND settled_at < now() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
