-- Migration 084: Cash-on-Delivery Reconciliation Engine
-- Tracks cash collected by drivers per shift, float management, discrepancy detection

-- ── Haupttabellen ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_cash_settlements (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id             uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id               uuid        NOT NULL,
  driver_name             text,
  shift_date              date        NOT NULL DEFAULT CURRENT_DATE,
  expected_cash_eur       numeric(10,2) NOT NULL DEFAULT 0,
  actual_cash_eur         numeric(10,2),
  cash_order_count        integer     NOT NULL DEFAULT 0,
  status                  text        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'settled', 'disputed')),
  settled_at              timestamptz,
  settled_by_employee_id  uuid,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(location_id, driver_id, shift_date)
);

CREATE TABLE IF NOT EXISTS cash_float_transactions (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id              uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  transaction_type         text        NOT NULL DEFAULT 'deposit'
    CHECK (transaction_type IN ('deposit', 'withdrawal', 'initial', 'adjustment')),
  amount_eur               numeric(10,2) NOT NULL,
  description              text,
  employee_id              uuid,
  reference_settlement_id  uuid        REFERENCES driver_cash_settlements(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

-- ── Indizes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cash_settlements_loc_date
  ON driver_cash_settlements(location_id, shift_date DESC);

CREATE INDEX IF NOT EXISTS idx_cash_settlements_driver
  ON driver_cash_settlements(driver_id);

CREATE INDEX IF NOT EXISTS idx_cash_settlements_open
  ON driver_cash_settlements(location_id, status)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_cash_float_location
  ON cash_float_transactions(location_id, created_at DESC);

-- ── Updated-at Trigger ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_cash_settlement_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_cash_settlement_updated_at ON driver_cash_settlements;
CREATE TRIGGER trg_cash_settlement_updated_at
  BEFORE UPDATE ON driver_cash_settlements
  FOR EACH ROW EXECUTE FUNCTION update_cash_settlement_updated_at();

-- ── Views ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_cash_settlement_today AS
SELECT
  cs.location_id,
  l.name                                                           AS location_name,
  CURRENT_DATE                                                     AS report_date,
  COUNT(cs.id)                                                     AS total_settlements,
  COUNT(*) FILTER (WHERE cs.status = 'open')                       AS open_count,
  COUNT(*) FILTER (WHERE cs.status = 'settled')                    AS settled_count,
  COUNT(*) FILTER (WHERE cs.status = 'disputed')                   AS disputed_count,
  COALESCE(SUM(cs.expected_cash_eur), 0)                           AS total_expected_eur,
  COALESCE(SUM(cs.actual_cash_eur)   FILTER (WHERE cs.actual_cash_eur IS NOT NULL), 0)
                                                                   AS total_actual_eur,
  COALESCE(SUM(cs.actual_cash_eur - cs.expected_cash_eur)
    FILTER (WHERE cs.actual_cash_eur IS NOT NULL), 0)              AS total_discrepancy_eur,
  COALESCE(SUM(cs.cash_order_count), 0)                            AS total_cash_orders
FROM driver_cash_settlements cs
JOIN locations l ON l.id = cs.location_id
WHERE cs.shift_date = CURRENT_DATE
GROUP BY cs.location_id, l.name;

-- Weekly cash settlement trend (last 14 days)
CREATE OR REPLACE VIEW v_cash_settlement_trend AS
SELECT
  cs.location_id,
  cs.shift_date,
  COUNT(cs.id)                                                     AS driver_count,
  COALESCE(SUM(cs.expected_cash_eur), 0)                           AS expected_eur,
  COALESCE(SUM(cs.actual_cash_eur)
    FILTER (WHERE cs.actual_cash_eur IS NOT NULL), 0)              AS actual_eur,
  COALESCE(SUM(cs.actual_cash_eur - cs.expected_cash_eur)
    FILTER (WHERE cs.actual_cash_eur IS NOT NULL), 0)              AS discrepancy_eur,
  COUNT(*) FILTER (WHERE cs.status = 'disputed')                   AS disputes
FROM driver_cash_settlements cs
WHERE cs.shift_date >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY cs.location_id, cs.shift_date
ORDER BY cs.shift_date DESC;

-- ── RLS ────────────────────────────────────────────────────────────────────────

ALTER TABLE driver_cash_settlements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_float_transactions   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass" ON driver_cash_settlements;
CREATE POLICY "service_role_bypass" ON driver_cash_settlements
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_bypass" ON cash_float_transactions;
CREATE POLICY "service_role_bypass" ON cash_float_transactions
  USING (true) WITH CHECK (true);
