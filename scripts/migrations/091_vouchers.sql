-- Migration 091: Voucher / Promo-Code Engine
-- Phase 179 — Smart Delivery Voucher System
-- Gutscheine mit RFM-Segmentierung, Bulk-Generierung und Checkout-Validierung

-- ──────────────────────────────────────────────────────────────────────────────
-- Vouchers Tabelle
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_vouchers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  -- Discount-Typ: flat_eur=Festbetrag, percent=Prozent, free_delivery=Lieferung gratis
  voucher_type    TEXT NOT NULL CHECK (voucher_type IN ('flat_eur', 'percent', 'free_delivery')),
  discount_value  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  min_order_eur   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (min_order_eur >= 0),
  max_discount_eur NUMERIC(10,2) NULL,          -- cap für percent-Typ
  max_uses        INTEGER NULL,                  -- NULL = unbegrenzt
  uses_count      INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  max_uses_per_customer INTEGER NOT NULL DEFAULT 1,
  valid_from      TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until     TIMESTAMPTZ NULL,             -- NULL = kein Ablaufdatum
  -- RFM-Segmentziel (NULL = alle Kunden)
  target_segment  TEXT NULL CHECK (target_segment IN (
    'champion','loyal','potential_loyalist','new_customer','promising',
    'needs_attention','at_risk','cant_lose','hibernating','lost'
  )),
  campaign_name   TEXT NULL,
  description     TEXT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, code)
);

CREATE INDEX IF NOT EXISTS idx_delivery_vouchers_location
  ON delivery_vouchers (location_id, is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_vouchers_code
  ON delivery_vouchers (code) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_delivery_vouchers_segment
  ON delivery_vouchers (location_id, target_segment)
  WHERE target_segment IS NOT NULL AND is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_delivery_vouchers_valid
  ON delivery_vouchers (location_id, valid_until)
  WHERE valid_until IS NOT NULL;

-- RLS
ALTER TABLE delivery_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY delivery_vouchers_service ON delivery_vouchers
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ──────────────────────────────────────────────────────────────────────────────
-- Voucher Redemptions Tabelle
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_voucher_redemptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id       UUID NOT NULL REFERENCES delivery_vouchers(id) ON DELETE CASCADE,
  location_id      UUID NOT NULL,
  order_id         TEXT NULL,    -- customer_orders.id (TEXT in legacy schema)
  customer_phone   TEXT NOT NULL,
  discount_applied_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  order_total_eur  NUMERIC(10,2) NOT NULL DEFAULT 0,
  redeemed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_voucher
  ON delivery_voucher_redemptions (voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_location
  ON delivery_voucher_redemptions (location_id, redeemed_at DESC);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_phone
  ON delivery_voucher_redemptions (customer_phone, location_id);

ALTER TABLE delivery_voucher_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY delivery_voucher_redemptions_service ON delivery_voucher_redemptions
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ──────────────────────────────────────────────────────────────────────────────
-- Update-Trigger für updated_at
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_voucher_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_voucher_updated_at ON delivery_vouchers;
CREATE TRIGGER trg_voucher_updated_at
  BEFORE UPDATE ON delivery_vouchers
  FOR EACH ROW EXECUTE FUNCTION update_voucher_timestamp();

-- ──────────────────────────────────────────────────────────────────────────────
-- Atomic Redeem RPC — prüft + reduziert uses_count in einer Transaktion
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION redeem_voucher(
  p_voucher_id       UUID,
  p_location_id      UUID,
  p_customer_phone   TEXT,
  p_order_id         TEXT,
  p_order_total_eur  NUMERIC,
  p_discount_eur     NUMERIC
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_uses_count INTEGER;
  v_max_uses   INTEGER;
BEGIN
  -- Lock-Row für atomic increment
  SELECT uses_count, max_uses INTO v_uses_count, v_max_uses
  FROM delivery_vouchers
  WHERE id = p_voucher_id AND location_id = p_location_id AND is_active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_max_uses IS NOT NULL AND v_uses_count >= v_max_uses THEN
    RETURN 'exhausted';
  END IF;

  -- Increment
  UPDATE delivery_vouchers
  SET uses_count = uses_count + 1,
      updated_at = now()
  WHERE id = p_voucher_id;

  -- Log Redemption
  INSERT INTO delivery_voucher_redemptions
    (voucher_id, location_id, order_id, customer_phone, discount_applied_eur, order_total_eur)
  VALUES
    (p_voucher_id, p_location_id, p_order_id, p_customer_phone, p_discount_eur, p_order_total_eur);

  RETURN 'ok';
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- VIEW: Voucher-Statistiken
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_voucher_stats AS
SELECT
  v.id,
  v.location_id,
  v.code,
  v.voucher_type,
  v.discount_value,
  v.min_order_eur,
  v.max_uses,
  v.uses_count,
  v.max_uses_per_customer,
  v.valid_from,
  v.valid_until,
  v.target_segment,
  v.campaign_name,
  v.description,
  v.is_active,
  v.created_at,
  COALESCE(r.redemption_count, 0)   AS redemption_count,
  COALESCE(r.total_discount_eur, 0) AS total_discount_eur,
  COALESCE(r.total_order_volume, 0) AS total_order_volume,
  COALESCE(r.unique_customers, 0)   AS unique_customers,
  CASE
    WHEN v.valid_until IS NOT NULL AND v.valid_until < now() THEN 'expired'
    WHEN NOT v.is_active THEN 'inactive'
    WHEN v.max_uses IS NOT NULL AND v.uses_count >= v.max_uses THEN 'exhausted'
    ELSE 'active'
  END AS status
FROM delivery_vouchers v
LEFT JOIN (
  SELECT
    voucher_id,
    COUNT(*)                    AS redemption_count,
    SUM(discount_applied_eur)   AS total_discount_eur,
    SUM(order_total_eur)        AS total_order_volume,
    COUNT(DISTINCT customer_phone) AS unique_customers
  FROM delivery_voucher_redemptions
  GROUP BY voucher_id
) r ON r.voucher_id = v.id;

-- ──────────────────────────────────────────────────────────────────────────────
-- VIEW: Location-weite Zusammenfassung
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_voucher_location_summary AS
SELECT
  location_id,
  COUNT(*)                                                 AS total_vouchers,
  COUNT(*) FILTER (WHERE is_active AND (valid_until IS NULL OR valid_until > now())
                    AND (max_uses IS NULL OR uses_count < max_uses)) AS active_vouchers,
  COALESCE(SUM(uses_count), 0)                             AS total_redemptions,
  COUNT(*) FILTER (WHERE valid_until IS NOT NULL AND valid_until < now()) AS expired_vouchers
FROM delivery_vouchers
GROUP BY location_id;
