-- Migration 038: Delivery Credit & Late-Compensation Engine
-- Erstellt Tabellen für automatische und manuelle Liefergutschriften.
-- Konfigurierbare Regeln pro Location (Auslöser, Schwelle, Betrag).
-- Graceful: alle Felder mit IF NOT EXISTS / IF EXISTS Guards.

-- ────────────────────────────────────────────────────────────────────────────
-- 1) delivery_credit_rules — Konfiguration: Wann wird ein Guthaben ausgestellt?
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_credit_rules (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  trigger_type   text        NOT NULL CHECK (trigger_type IN ('late_delivery', 'failed_delivery', 'manual')),
  -- Für late_delivery: Anzahl Minuten Verspätung die das Guthaben auslösen
  threshold_min  integer     DEFAULT 10  CHECK (threshold_min IS NULL OR threshold_min > 0),
  -- Fester Gutscheinbetrag (EUR)
  credit_eur     numeric(8,2) NOT NULL DEFAULT 2.00 CHECK (credit_eur > 0),
  -- Optionaler prozentualer Aufschlag (% des Bestellwerts, addiert zum Fixbetrag)
  credit_pct     numeric(5,2) DEFAULT NULL CHECK (credit_pct IS NULL OR (credit_pct > 0 AND credit_pct <= 100)),
  -- Maximaler Gutscheinbetrag (Deckel bei credit_pct)
  max_credit_eur numeric(8,2) DEFAULT 10.00 CHECK (max_credit_eur > 0),
  -- Ablaufzeit des ausgestellten Gutscheins in Tagen
  expires_in_days integer     DEFAULT 30 CHECK (expires_in_days > 0),
  active         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, trigger_type)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2) delivery_credits — Ausgestellte Gutscheine
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_credits (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  -- Quell-Bestellung (kann null sein bei rein manuellen Credits)
  order_id         uuid        REFERENCES customer_orders(id) ON DELETE SET NULL,
  -- Redemption: auf welche Bestellung wurde der Gutschein eingelöst?
  redeemed_order_id uuid       REFERENCES customer_orders(id) ON DELETE SET NULL,
  -- Betrag
  amount_eur       numeric(8,2) NOT NULL CHECK (amount_eur > 0),
  -- Auslöser
  reason           text        NOT NULL CHECK (reason IN ('late_delivery', 'failed_delivery', 'manual', 'quality')),
  reason_detail    text,
  -- Zustand
  status           text        NOT NULL DEFAULT 'issued'
                               CHECK (status IN ('issued', 'redeemed', 'expired', 'cancelled')),
  -- Eindeutiger Token für Kunden-Einlösung (URL-safe)
  token            text        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  -- Kundendaten (Snapshot zur Ausstellungszeit für spätere Zuordnung)
  customer_name    text,
  customer_email   text,
  customer_phone   text,
  -- Verspätungsdetail (nur bei late_delivery)
  late_minutes     integer,
  -- Zeitstempel
  issued_at        timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz,
  redeemed_at      timestamptz,
  -- Wer hat den Credit manuell erstellt?
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3) Indizes
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_delivery_credits_location
  ON delivery_credits (location_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_credits_order
  ON delivery_credits (order_id);

CREATE INDEX IF NOT EXISTS idx_delivery_credits_status
  ON delivery_credits (location_id, status);

CREATE INDEX IF NOT EXISTS idx_delivery_credits_token
  ON delivery_credits (token);

CREATE INDEX IF NOT EXISTS idx_delivery_credits_expires
  ON delivery_credits (expires_at)
  WHERE status = 'issued';

CREATE INDEX IF NOT EXISTS idx_delivery_credit_rules_location
  ON delivery_credit_rules (location_id, active);

-- ────────────────────────────────────────────────────────────────────────────
-- 4) updated_at Trigger
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at_credits()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_credits_updated_at         ON delivery_credits;
DROP TRIGGER IF EXISTS trg_credit_rules_updated_at    ON delivery_credit_rules;

CREATE TRIGGER trg_credits_updated_at
  BEFORE UPDATE ON delivery_credits
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at_credits();

CREATE TRIGGER trg_credit_rules_updated_at
  BEFORE UPDATE ON delivery_credit_rules
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at_credits();

-- ────────────────────────────────────────────────────────────────────────────
-- 5) v_credit_summary — Aggregierte Stats pro Location
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_credit_summary AS
SELECT
  dc.location_id,
  l.name                                                              AS location_name,
  COUNT(*) FILTER (WHERE dc.status = 'issued')                       AS issued_count,
  COALESCE(SUM(dc.amount_eur) FILTER (WHERE dc.status = 'issued'),   0) AS issued_total_eur,
  COUNT(*) FILTER (WHERE dc.status = 'redeemed')                     AS redeemed_count,
  COALESCE(SUM(dc.amount_eur) FILTER (WHERE dc.status = 'redeemed'), 0) AS redeemed_total_eur,
  COUNT(*) FILTER (WHERE dc.status = 'expired')                      AS expired_count,
  COALESCE(SUM(dc.amount_eur) FILTER (WHERE dc.status = 'expired'),  0) AS expired_total_eur,
  COUNT(*) FILTER (WHERE dc.status = 'cancelled')                    AS cancelled_count,
  COUNT(*) FILTER (WHERE dc.reason = 'late_delivery')                AS late_delivery_count,
  COUNT(*) FILTER (WHERE dc.reason = 'failed_delivery')              AS failed_delivery_count,
  COUNT(*) FILTER (WHERE dc.reason = 'manual' OR dc.reason = 'quality') AS manual_count,
  ROUND(
    CASE WHEN COUNT(*) FILTER (WHERE dc.status IN ('redeemed','expired','cancelled')) > 0
    THEN (COUNT(*) FILTER (WHERE dc.status = 'redeemed')::numeric /
          COUNT(*) FILTER (WHERE dc.status IN ('redeemed','expired','cancelled'))::numeric) * 100
    ELSE 0 END,
    1
  )                                                                   AS redemption_rate_pct
FROM delivery_credits dc
JOIN locations l ON l.id = dc.location_id
GROUP BY dc.location_id, l.name;

-- ────────────────────────────────────────────────────────────────────────────
-- 6) v_pending_credits — Offene Credits mit Bestelldetails
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_pending_credits AS
SELECT
  dc.id,
  dc.location_id,
  dc.order_id,
  dc.amount_eur,
  dc.reason,
  dc.reason_detail,
  dc.status,
  dc.token,
  dc.customer_name,
  dc.customer_email,
  dc.customer_phone,
  dc.late_minutes,
  dc.issued_at,
  dc.expires_at,
  co.bestellnummer,
  co.gesamtbetrag          AS order_total_eur,
  co.delivery_zone         AS zone
FROM delivery_credits dc
LEFT JOIN customer_orders co ON co.id = dc.order_id
WHERE dc.status = 'issued'
ORDER BY dc.issued_at DESC;

-- ────────────────────────────────────────────────────────────────────────────
-- 7) RLS Policies
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE delivery_credits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_credit_rules ENABLE ROW LEVEL SECURITY;

-- service_role: vollen Zugriff
DO $$
BEGIN
  -- delivery_credits
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='delivery_credits' AND policyname='service_role_all_credits') THEN
    CREATE POLICY service_role_all_credits ON delivery_credits
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- authenticated: nur eigene Location
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='delivery_credits' AND policyname='auth_tenant_credits') THEN
    CREATE POLICY auth_tenant_credits ON delivery_credits
      FOR SELECT TO authenticated
      USING (
        location_id IN (
          SELECT e.location_id FROM employees e
          WHERE e.auth_user_id = auth.uid()
        )
      );
  END IF;

  -- delivery_credit_rules
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='delivery_credit_rules' AND policyname='service_role_all_credit_rules') THEN
    CREATE POLICY service_role_all_credit_rules ON delivery_credit_rules
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='delivery_credit_rules' AND policyname='auth_tenant_credit_rules') THEN
    CREATE POLICY auth_tenant_credit_rules ON delivery_credit_rules
      FOR SELECT TO authenticated
      USING (
        location_id IN (
          SELECT e.location_id FROM employees e
          WHERE e.auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 8) Default-Regeln Seed-Funktion
-- ────────────────────────────────────────────────────────────────────────────
-- Kann pro Location aufgerufen werden um Starter-Regeln anzulegen.
-- Wird NICHT automatisch für alle Locations ausgeführt (opt-in).
CREATE OR REPLACE FUNCTION seed_default_credit_rules(p_location_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO delivery_credit_rules (location_id, trigger_type, threshold_min, credit_eur, max_credit_eur, expires_in_days, active)
  VALUES
    (p_location_id, 'late_delivery',   10, 2.00, 10.00, 30, true),
    (p_location_id, 'failed_delivery', NULL, 5.00, 15.00, 45, true)
  ON CONFLICT (location_id, trigger_type) DO NOTHING;
END;
$$;
