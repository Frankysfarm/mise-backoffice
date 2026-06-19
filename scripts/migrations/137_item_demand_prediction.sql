-- Migration 137: Smart Item Demand Prediction
-- Tracks current stock per menu item per location.
-- Generates reorder alerts when projected stock falls below reorder point.
-- Demand history is derived from delivery_menu_snapshots (Phase 121).

-- ── 1. Artikel-Lagerbestand ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_item_stock (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id      uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  item_name        text NOT NULL,
  current_stock    numeric(10,2) NOT NULL DEFAULT 0,
  unit             text NOT NULL DEFAULT 'stk',
  min_stock_level  numeric(10,2) NOT NULL DEFAULT 0,
  reorder_point    numeric(10,2) NOT NULL DEFAULT 0,
  reorder_qty      numeric(10,2) NOT NULL DEFAULT 0,
  lead_time_days   integer NOT NULL DEFAULT 1,
  cost_per_unit    numeric(10,4) NOT NULL DEFAULT 0,
  supplier_name    text,
  last_checked_at  timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now(),
  UNIQUE (location_id, item_name)
);

ALTER TABLE menu_item_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "location staff" ON menu_item_stock
  USING (location_id IN (
    SELECT location_id FROM employees WHERE id = auth.uid()
  ));

-- ── 2. Nachfrage-Alarm ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS item_demand_alerts (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id         uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  item_name           text NOT NULL,
  alert_level         text NOT NULL CHECK (alert_level IN ('warning','critical')),
  current_stock       numeric(10,2) NOT NULL,
  reorder_point       numeric(10,2) NOT NULL,
  avg_daily_demand    numeric(10,4) NOT NULL DEFAULT 0,
  days_until_depletion numeric(10,1),
  suggested_order_qty numeric(10,2),
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open','ordered','resolved')),
  created_at          timestamptz DEFAULT now(),
  resolved_at         timestamptz,
  UNIQUE (location_id, item_name, status)
);

ALTER TABLE item_demand_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "location staff" ON item_demand_alerts
  USING (location_id IN (
    SELECT location_id FROM employees WHERE id = auth.uid()
  ));

-- ── 3. View: Aktuelle Alarmübersicht ────────────────────────────────────────
CREATE OR REPLACE VIEW v_item_demand_alerts_open AS
SELECT
  a.*,
  s.unit,
  s.supplier_name,
  s.lead_time_days,
  s.cost_per_unit
FROM item_demand_alerts a
JOIN menu_item_stock s ON s.location_id = a.location_id AND s.item_name = a.item_name
WHERE a.status = 'open'
ORDER BY a.alert_level DESC, a.days_until_depletion ASC NULLS FIRST;

-- ── 4. Trigger: updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _trg_menu_stock_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_menu_stock_updated_at ON menu_item_stock;
CREATE TRIGGER trg_menu_stock_updated_at
  BEFORE UPDATE ON menu_item_stock
  FOR EACH ROW EXECUTE FUNCTION _trg_menu_stock_updated_at();

-- ── 5. RPC: Cleanup alter Alarme ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_demand_alerts(p_days integer DEFAULT 90)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pruned integer;
BEGIN
  DELETE FROM item_demand_alerts
  WHERE status = 'resolved' AND resolved_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_pruned = ROW_COUNT;
  RETURN jsonb_build_object('pruned', v_pruned);
END;
$$;
