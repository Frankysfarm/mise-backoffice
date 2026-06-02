-- Migration 023: Proactive Delay Alert System
-- Erkennt Lieferungen die die ETA überschreiten und protokolliert Delay-Notifications.
-- Erstellt automatisch Kompensations-Gutscheine bei starken Verspätungen (>30 Min).

-- ─── Delay-Alert-Tracking ────────────────────────────────────────────────────
-- Protokolliert welcher Alert-Typ für welche Bestellung gesendet wurde.
-- UNIQUE (order_id, alert_type) verhindert Duplikat-Benachrichtigungen.

CREATE TABLE IF NOT EXISTS delivery_delay_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  location_id     UUID NOT NULL,
  alert_type      TEXT NOT NULL CHECK (alert_type IN ('first_notice', 'critical_notice', 'compensation')),
  delay_minutes   INTEGER NOT NULL,
  batch_id        UUID REFERENCES mise_delivery_batches(id) ON DELETE SET NULL,
  driver_id       UUID REFERENCES mise_drivers(id) ON DELETE SET NULL,
  notified_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, alert_type)
);

-- ─── Kompensations-Gutscheine ────────────────────────────────────────────────
-- Auto-erstellte Gutscheincodes für Bestellungen mit >30 Min Verspätung.
-- voucher_code ist menschenlesbar (SORRY-XXXXX) + unique.

CREATE TABLE IF NOT EXISTS delay_compensation_vouchers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  location_id           UUID NOT NULL,
  voucher_code          TEXT NOT NULL UNIQUE,
  discount_amount       NUMERIC(8,2) NOT NULL DEFAULT 5.00,
  delay_minutes         INTEGER NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  redeemed_at           TIMESTAMPTZ,
  redeemed_by_order_id  UUID REFERENCES customer_orders(id) ON DELETE SET NULL,
  UNIQUE (order_id)     -- max. 1 Gutschein pro Bestellung
);

-- ─── Performance-Indizes ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_dda_order_type
  ON delivery_delay_alerts (order_id, alert_type);

CREATE INDEX IF NOT EXISTS idx_dda_location_time
  ON delivery_delay_alerts (location_id, notified_at DESC);

CREATE INDEX IF NOT EXISTS idx_dcv_code
  ON delay_compensation_vouchers (voucher_code);

CREATE INDEX IF NOT EXISTS idx_dcv_location_time
  ON delay_compensation_vouchers (location_id, created_at DESC);

-- ─── View: Aktive Verspätungen ────────────────────────────────────────────────
-- Lieferbestellungen deren eta_latest überschritten ist und die noch nicht geliefert wurden.
-- Enthält denormalisiert welche Alert-Typen bereits gesendet wurden.

CREATE OR REPLACE VIEW v_delayed_orders AS
SELECT
  co.id,
  co.bestellnummer,
  co.location_id,
  co.status,
  co.eta_latest,
  co.mise_batch_id,
  co.mise_driver_id,
  ROUND(EXTRACT(EPOCH FROM (NOW() - co.eta_latest)) / 60) AS delay_minutes,
  EXISTS (
    SELECT 1 FROM delivery_delay_alerts dda
    WHERE dda.order_id = co.id AND dda.alert_type = 'first_notice'
  ) AS first_notice_sent,
  EXISTS (
    SELECT 1 FROM delivery_delay_alerts dda
    WHERE dda.order_id = co.id AND dda.alert_type = 'critical_notice'
  ) AS critical_notice_sent,
  EXISTS (
    SELECT 1 FROM delivery_delay_alerts dda
    WHERE dda.order_id = co.id AND dda.alert_type = 'compensation'
  ) AS compensation_flagged,
  EXISTS (
    SELECT 1 FROM delay_compensation_vouchers dcv
    WHERE dcv.order_id = co.id
  ) AS voucher_created
FROM customer_orders co
WHERE
  co.status NOT IN ('geliefert', 'abgeschlossen', 'storniert', 'cancelled', 'rejected')
  AND co.bestelltyp = 'lieferung'
  AND co.eta_latest IS NOT NULL
  AND co.eta_latest < NOW();

-- ─── View: Kompensations-Übersicht mit Bestelldetails ────────────────────────

CREATE OR REPLACE VIEW v_compensation_vouchers AS
SELECT
  v.id,
  v.order_id,
  v.location_id,
  v.voucher_code,
  v.discount_amount,
  v.delay_minutes,
  v.created_at,
  v.expires_at,
  v.redeemed_at,
  v.redeemed_by_order_id,
  co.bestellnummer,
  co.status    AS order_status
FROM delay_compensation_vouchers v
JOIN customer_orders co ON co.id = v.order_id;
