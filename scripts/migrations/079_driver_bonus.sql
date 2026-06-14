-- Migration 079: Driver Bonus / Incentive Engine (Phase 158)
-- Configurable performance bonuses for drivers: deliveries count, on-time rate, rating threshold

-- ─── Bonus-Konfiguration je Location ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_bonus_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  bonus_type      TEXT NOT NULL,  -- 'deliveries_count' | 'on_time_rate' | 'min_rating' | 'custom'
  label           TEXT NOT NULL,  -- Anzeigename, z. B. "10 Lieferungen Bonus"
  threshold_value NUMERIC(8,2) NOT NULL,  -- z. B. 10 (Lieferungen) oder 0.90 (90% On-Time) oder 4.5 (Rating)
  bonus_amount_eur NUMERIC(8,2) NOT NULL DEFAULT 2.00,
  period          TEXT NOT NULL DEFAULT 'daily',   -- 'daily' | 'weekly'
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT driver_bonus_configs_uq UNIQUE (location_id, bonus_type, period)
);

CREATE INDEX IF NOT EXISTS idx_driver_bonus_configs_location
  ON driver_bonus_configs(location_id) WHERE enabled = TRUE;

-- ─── Bonus-Events je Fahrer/Periode ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_bonus_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id       UUID NOT NULL,   -- mise_drivers.id
  driver_name     TEXT,
  config_id       UUID REFERENCES driver_bonus_configs(id) ON DELETE SET NULL,
  bonus_type      TEXT NOT NULL,
  period          TEXT NOT NULL DEFAULT 'daily',
  reference_date  DATE NOT NULL,   -- Tag/Woche für den der Bonus gilt
  threshold_value NUMERIC(8,2) NOT NULL,
  achieved_value  NUMERIC(8,2) NOT NULL,  -- tatsächlich erreichte Metrik
  bonus_amount_eur NUMERIC(8,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'paid' | 'cancelled'
  payout_period_id UUID,  -- FK zu driver_payout_periods wenn vorhanden
  notes           TEXT,
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT driver_bonus_events_uq UNIQUE (driver_id, bonus_type, period, reference_date)
);

CREATE INDEX IF NOT EXISTS idx_driver_bonus_events_location_date
  ON driver_bonus_events(location_id, reference_date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_bonus_events_driver
  ON driver_bonus_events(driver_id, reference_date DESC);
CREATE INDEX IF NOT EXISTS idx_driver_bonus_events_status
  ON driver_bonus_events(location_id, status) WHERE status IN ('pending','approved');

-- ─── View: Bonus-Übersicht je Fahrer ──────────────────────────────────────────
CREATE OR REPLACE VIEW v_driver_bonus_summary AS
SELECT
  dbe.location_id,
  dbe.driver_id,
  dbe.driver_name,
  COUNT(*)                                          AS total_bonuses,
  SUM(dbe.bonus_amount_eur)                         AS total_eur,
  SUM(dbe.bonus_amount_eur) FILTER (WHERE dbe.status = 'pending')  AS pending_eur,
  SUM(dbe.bonus_amount_eur) FILTER (WHERE dbe.status = 'approved') AS approved_eur,
  SUM(dbe.bonus_amount_eur) FILTER (WHERE dbe.status = 'paid')     AS paid_eur,
  COUNT(*) FILTER (WHERE dbe.status = 'pending')   AS pending_count,
  COUNT(*) FILTER (WHERE dbe.status = 'approved')  AS approved_count,
  COUNT(*) FILTER (WHERE dbe.status = 'paid')      AS paid_count,
  MAX(dbe.reference_date)                           AS latest_bonus_date
FROM driver_bonus_events dbe
GROUP BY dbe.location_id, dbe.driver_id, dbe.driver_name;

-- ─── Updated-At-Trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_driver_bonus_configs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_driver_bonus_configs_updated_at ON driver_bonus_configs;
CREATE TRIGGER trg_driver_bonus_configs_updated_at
  BEFORE UPDATE ON driver_bonus_configs
  FOR EACH ROW EXECUTE FUNCTION update_driver_bonus_configs_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE driver_bonus_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_bonus_events  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_bonus_configs_service ON driver_bonus_configs;
CREATE POLICY driver_bonus_configs_service ON driver_bonus_configs
  USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS driver_bonus_events_service ON driver_bonus_events;
CREATE POLICY driver_bonus_events_service ON driver_bonus_events
  USING (TRUE) WITH CHECK (TRUE);
