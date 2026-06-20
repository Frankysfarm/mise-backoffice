-- ============================================================
-- Migration 162 — Dynamic Pricing Engine
-- Phase 340
-- ============================================================

-- ── Konfiguration je Standort ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dynamic_pricing_configs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           text        NOT NULL UNIQUE,
  is_enabled            boolean     NOT NULL DEFAULT false,
  -- Surge-Multiplikatoren (override der surge.ts-Werte)
  multiplier_normal     numeric(4,2) NOT NULL DEFAULT 1.00,
  multiplier_surge_low  numeric(4,2) NOT NULL DEFAULT 1.20,  -- surge level: elevated
  multiplier_surge_mid  numeric(4,2) NOT NULL DEFAULT 1.50,  -- surge level: high
  multiplier_surge_high numeric(4,2) NOT NULL DEFAULT 2.00,  -- surge level: extreme
  max_surcharge_eur     numeric(6,2) NOT NULL DEFAULT 3.00,  -- absolutes Kappen-Limit
  -- Off-Peak-Rabatt
  off_peak_enabled      boolean     NOT NULL DEFAULT false,
  off_peak_discount_pct numeric(4,1) NOT NULL DEFAULT 10.0,  -- % Rabatt
  off_peak_start_hour   smallint    NOT NULL DEFAULT 14,      -- UTC
  off_peak_end_hour     smallint    NOT NULL DEFAULT 17,      -- UTC
  -- Transparenz-Banner für Kunden
  customer_banner_enabled boolean   NOT NULL DEFAULT true,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dynamic_pricing_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON dynamic_pricing_configs USING (auth.role() = 'service_role');

-- ── Ereignis-Log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dynamic_pricing_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       text        NOT NULL,
  order_id          uuid,                         -- null = Preview
  pricing_reason    text        NOT NULL,         -- normal/surge_low/surge_mid/surge_high/off_peak/off_peak_surge
  base_fee_eur      numeric(6,2) NOT NULL,
  applied_multiplier numeric(4,2) NOT NULL,
  discount_pct      numeric(4,1) NOT NULL DEFAULT 0,
  final_fee_eur     numeric(6,2) NOT NULL,
  surge_level       text,                         -- none/elevated/high/extreme
  hour_utc          smallint    NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dpe_location_date
  ON dynamic_pricing_events (location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dpe_order
  ON dynamic_pricing_events (order_id) WHERE order_id IS NOT NULL;

ALTER TABLE dynamic_pricing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON dynamic_pricing_events USING (auth.role() = 'service_role');

-- ── Tages-Zusammenfassung VIEW ───────────────────────────────────────────────
CREATE OR REPLACE VIEW v_dynamic_pricing_today AS
SELECT
  location_id,
  COUNT(*)                                         AS events_today,
  COUNT(*) FILTER (WHERE pricing_reason LIKE 'surge%') AS surge_events,
  COUNT(*) FILTER (WHERE pricing_reason LIKE 'off_peak%') AS off_peak_events,
  AVG(applied_multiplier)                          AS avg_multiplier,
  SUM(final_fee_eur - base_fee_eur)                AS extra_revenue_eur,
  SUM(base_fee_eur * discount_pct / 100.0)         AS discount_given_eur
FROM dynamic_pricing_events
WHERE order_id IS NOT NULL
  AND created_at >= current_date
GROUP BY location_id;

-- ── Cleanup-Funktion ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_dynamic_pricing_events(days_old integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM dynamic_pricing_events
  WHERE created_at < now() - (days_old || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ── updated_at Trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_dynamic_pricing_config_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_dynamic_pricing_config_ts
  BEFORE UPDATE ON dynamic_pricing_configs
  FOR EACH ROW EXECUTE FUNCTION update_dynamic_pricing_config_ts();
