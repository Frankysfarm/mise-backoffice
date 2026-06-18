-- Migration 122: Smart Delivery Shift Handover Engine
-- Speichert Schicht-Übergabe-Berichte mit vollständigen Ops-KPIs

-- ── Handover-Reports Tabelle ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_handover_reports (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id            UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  generated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by           TEXT NOT NULL DEFAULT 'auto', -- 'auto' oder employee-id
  period_start           TIMESTAMPTZ NOT NULL,
  period_end             TIMESTAMPTZ NOT NULL,
  shift_period_hours     INT NOT NULL DEFAULT 8,

  -- Bestellungen
  orders_total           INT NOT NULL DEFAULT 0,
  orders_delivered       INT NOT NULL DEFAULT 0,
  orders_cancelled       INT NOT NULL DEFAULT 0,
  orders_failed          INT NOT NULL DEFAULT 0,
  orders_pending_end     INT NOT NULL DEFAULT 0,  -- noch offen bei Schichtende

  -- SLA
  sla_on_time            INT NOT NULL DEFAULT 0,
  sla_late               INT NOT NULL DEFAULT 0,
  on_time_rate_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_delivery_min       NUMERIC(6,2),

  -- Umsatz
  revenue_eur            NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fees_eur      NUMERIC(10,2) NOT NULL DEFAULT 0,
  avg_order_value_eur    NUMERIC(8,2),

  -- Fahrer
  drivers_active         INT NOT NULL DEFAULT 0,
  drivers_shifts_completed INT NOT NULL DEFAULT 0,
  tours_completed        INT NOT NULL DEFAULT 0,

  -- Küche
  avg_prep_min           NUMERIC(6,2),
  orders_waited_gt_15min INT NOT NULL DEFAULT 0,

  -- Incidents
  incidents_created      INT NOT NULL DEFAULT 0,
  incidents_open_end     INT NOT NULL DEFAULT 0,

  -- Offene Posten (JSONB für Flexibilität)
  open_orders_json       JSONB NOT NULL DEFAULT '[]',  -- pending orders am Schichtende
  active_alerts_json     JSONB NOT NULL DEFAULT '[]',  -- offene Alarme

  -- Top-Fahrer der Schicht
  top_drivers_json       JSONB NOT NULL DEFAULT '[]',

  -- Admin-Notizen
  notes                  TEXT,

  -- Quittierung
  acknowledged_by        UUID REFERENCES employees(id),
  acknowledged_at        TIMESTAMPTZ,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indizes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS shift_handover_reports_location_idx
  ON shift_handover_reports (location_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS shift_handover_reports_period_idx
  ON shift_handover_reports (location_id, period_end DESC);

-- ── Updated-at Trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_shift_handover_reports_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shift_handover_reports_updated_at ON shift_handover_reports;
CREATE TRIGGER shift_handover_reports_updated_at
  BEFORE UPDATE ON shift_handover_reports
  FOR EACH ROW EXECUTE FUNCTION update_shift_handover_reports_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE shift_handover_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY shift_handover_reports_location_policy ON shift_handover_reports
  FOR ALL USING (
    location_id IN (
      SELECT location_id FROM employees
      WHERE id = auth.uid()
    )
  );

-- ── Cleanup RPC ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_handover_reports(days_to_keep INT DEFAULT 90)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  deleted INT;
BEGIN
  DELETE FROM shift_handover_reports
  WHERE generated_at < now() - (days_to_keep || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ── Letzte unquittierte Übergabe pro Location ─────────────────────────────────
CREATE OR REPLACE VIEW v_unacknowledged_handovers AS
SELECT DISTINCT ON (location_id)
  id,
  location_id,
  generated_at,
  period_start,
  period_end,
  orders_total,
  orders_pending_end,
  incidents_open_end,
  on_time_rate_pct,
  revenue_eur
FROM shift_handover_reports
WHERE acknowledged_at IS NULL
ORDER BY location_id, generated_at DESC;
