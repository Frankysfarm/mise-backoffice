-- Migration 127: Smart Delivery Predictive Restock Engine
-- Liefermaterial-Verbrauchsverfolgung mit KI-Depletion-Prognose

-- ── Materialien-Katalog ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_materials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  unit             TEXT NOT NULL DEFAULT 'Stück',
  category         TEXT NOT NULL DEFAULT 'packaging',
  current_stock    INTEGER NOT NULL DEFAULT 0,
  min_stock_level  INTEGER NOT NULL DEFAULT 50,
  reorder_qty      INTEGER NOT NULL DEFAULT 200,
  cost_per_unit    NUMERIC(8,4) NOT NULL DEFAULT 0,
  items_per_order  NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  supplier_name    TEXT,
  supplier_email   TEXT,
  supplier_phone   TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_restocked_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(location_id, name)
);
CREATE INDEX IF NOT EXISTS idx_delivery_materials_location
  ON delivery_materials(location_id) WHERE is_active;

-- ── Tägliche Verbrauchs-Snapshots ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material_usage_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  material_id  UUID NOT NULL REFERENCES delivery_materials(id) ON DELETE CASCADE,
  date_bucket  DATE NOT NULL,
  orders_count INTEGER NOT NULL DEFAULT 0,
  units_used   NUMERIC(8,2) NOT NULL DEFAULT 0,
  stock_after  INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(material_id, date_bucket)
);
CREATE INDEX IF NOT EXISTS idx_material_usage_location_date
  ON material_usage_snapshots(location_id, date_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_material_usage_material_date
  ON material_usage_snapshots(material_id, date_bucket DESC);

-- ── Restock-Alarme ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restock_alerts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  material_id          UUID NOT NULL REFERENCES delivery_materials(id) ON DELETE CASCADE,
  status               TEXT NOT NULL DEFAULT 'open'
                         CHECK(status IN ('open', 'ordered', 'resolved')),
  current_stock        INTEGER NOT NULL,
  min_stock_level      INTEGER NOT NULL,
  daily_burn_rate      NUMERIC(8,2),
  depletion_date_est   DATE,
  days_until_depletion INTEGER,
  triggered_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ordered_at           TIMESTAMPTZ,
  resolved_at          TIMESTAMPTZ,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_restock_alerts_location_status
  ON restock_alerts(location_id, status);
-- Nur ein offener Alert pro Material gleichzeitig
CREATE UNIQUE INDEX IF NOT EXISTS idx_restock_alerts_one_open
  ON restock_alerts(material_id) WHERE status = 'open';

-- ── VIEW: Burn-Rate + Depletion-Prognose (letzte 14 Tage) ───────────────────
CREATE OR REPLACE VIEW v_material_burn_rate AS
SELECT
  m.id,
  m.location_id,
  m.name,
  m.unit,
  m.category,
  m.current_stock,
  m.min_stock_level,
  m.reorder_qty,
  m.cost_per_unit,
  m.items_per_order,
  m.supplier_name,
  m.supplier_email,
  m.supplier_phone,
  m.last_restocked_at,
  m.is_active,
  COALESCE(AVG(s.units_used), 0)::NUMERIC(8,2)       AS avg_daily_usage,
  COUNT(s.id)::INTEGER                                AS snapshot_days,
  CASE
    WHEN COALESCE(AVG(s.units_used), 0) > 0
    THEN GREATEST(0, FLOOR(m.current_stock::NUMERIC / AVG(s.units_used)))::INTEGER
    ELSE NULL
  END                                                 AS days_until_depletion,
  CASE
    WHEN COALESCE(AVG(s.units_used), 0) > 0
    THEN (CURRENT_DATE + (
      GREATEST(0, FLOOR(m.current_stock::NUMERIC / AVG(s.units_used)))::INTEGER
      * INTERVAL '1 day'
    ))::DATE
    ELSE NULL
  END                                                 AS depletion_date_est,
  CASE
    WHEN m.current_stock <= m.min_stock_level THEN 'critical'
    WHEN COALESCE(AVG(s.units_used), 0) > 0
     AND FLOOR(m.current_stock::NUMERIC / AVG(s.units_used)) <= 7 THEN 'warning'
    ELSE 'ok'
  END                                                 AS stock_level
FROM delivery_materials m
LEFT JOIN material_usage_snapshots s
  ON s.material_id = m.id
 AND s.date_bucket >= CURRENT_DATE - INTERVAL '14 days'
WHERE m.is_active
GROUP BY
  m.id, m.location_id, m.name, m.unit, m.category,
  m.current_stock, m.min_stock_level, m.reorder_qty,
  m.cost_per_unit, m.items_per_order,
  m.supplier_name, m.supplier_email, m.supplier_phone,
  m.last_restocked_at, m.is_active;

-- ── VIEW: Restock-Bedarf ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_restock_needed AS
SELECT *
FROM v_material_burn_rate
WHERE stock_level IN ('critical', 'warning');

-- ── Cleanup RPC ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_material_snapshots(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE pruned_count INTEGER;
BEGIN
  DELETE FROM material_usage_snapshots
  WHERE date_bucket < CURRENT_DATE - (days_to_keep * INTERVAL '1 day');
  GET DIAGNOSTICS pruned_count = ROW_COUNT;
  RETURN pruned_count;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE delivery_materials        ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_usage_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_alerts            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_delivery_materials"       ON delivery_materials;
DROP POLICY IF EXISTS "service_material_usage_snapshots" ON material_usage_snapshots;
DROP POLICY IF EXISTS "service_restock_alerts"           ON restock_alerts;

CREATE POLICY "service_delivery_materials"
  ON delivery_materials FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_material_usage_snapshots"
  ON material_usage_snapshots FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_restock_alerts"
  ON restock_alerts FOR ALL USING (auth.role() = 'service_role');
