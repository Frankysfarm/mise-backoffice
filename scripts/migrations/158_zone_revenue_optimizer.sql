-- Phase 331: Smart Zone Revenue Optimizer
-- Tracks per-zone revenue performance and generates fee/boundary recommendations

-- Daily revenue snapshot per zone
CREATE TABLE IF NOT EXISTS zone_revenue_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  zone_name       TEXT NOT NULL CHECK (zone_name IN ('A','B','C','D','unknown')),
  snapshot_date   DATE NOT NULL,
  order_count     INT  NOT NULL DEFAULT 0,
  revenue_eur     NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_revenue_eur NUMERIC(10,2) NOT NULL DEFAULT 0,  -- surcharge collected
  avg_order_value NUMERIC(10,2),
  avg_distance_km NUMERIC(6,2),
  on_time_count   INT  NOT NULL DEFAULT 0,
  cancelled_count INT  NOT NULL DEFAULT 0,
  on_time_pct     NUMERIC(5,2),   -- 0–100
  cancellation_pct NUMERIC(5,2),  -- 0–100
  margin_score    NUMERIC(5,2),   -- 0–100: composite profitability
  cost_ratio      NUMERIC(6,4),   -- fee_revenue / (avg_distance_km * order_count * cost_per_km)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, zone_name, snapshot_date)
);

-- Recommendations for zone tuning
CREATE TABLE IF NOT EXISTS zone_revenue_recommendations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id        UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  zone_name          TEXT NOT NULL,
  rec_type           TEXT NOT NULL CHECK (rec_type IN (
    'increase_surcharge','decrease_surcharge','increase_mov','decrease_mov',
    'remove_zone','expand_zone','add_free_threshold','investigate'
  )),
  reason             TEXT NOT NULL,
  suggested_surcharge NUMERIC(8,2),
  suggested_mov       NUMERIC(8,2),
  urgency            TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low','normal','high','critical')),
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed','applied')),
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_zone_rev_snaps_loc_date ON zone_revenue_snapshots (location_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_zone_rev_snaps_zone ON zone_revenue_snapshots (location_id, zone_name, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_zone_rev_recs_loc ON zone_revenue_recommendations (location_id, status, generated_at DESC);

-- RLS
ALTER TABLE zone_revenue_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_revenue_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY zone_rev_snap_tenant ON zone_revenue_snapshots USING (
  location_id IN (SELECT id FROM locations WHERE tenant_id = (
    SELECT tenant_id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1
  ))
);
CREATE POLICY zone_rev_rec_tenant ON zone_revenue_recommendations USING (
  location_id IN (SELECT id FROM locations WHERE tenant_id = (
    SELECT tenant_id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1
  ))
);

-- updated_at triggers
CREATE OR REPLACE FUNCTION trg_zone_rev_snap_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER zone_rev_snap_updated
  BEFORE UPDATE ON zone_revenue_snapshots
  FOR EACH ROW EXECUTE FUNCTION trg_zone_rev_snap_updated();

CREATE OR REPLACE FUNCTION trg_zone_rev_rec_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER zone_rev_rec_updated
  BEFORE UPDATE ON zone_revenue_recommendations
  FOR EACH ROW EXECUTE FUNCTION trg_zone_rev_rec_updated();

-- Summary view: latest snapshot per zone per location
CREATE OR REPLACE VIEW v_zone_revenue_latest AS
SELECT DISTINCT ON (location_id, zone_name)
  id, location_id, zone_name, snapshot_date,
  order_count, revenue_eur, fee_revenue_eur, avg_order_value,
  avg_distance_km, on_time_pct, cancellation_pct, margin_score, cost_ratio
FROM zone_revenue_snapshots
ORDER BY location_id, zone_name, snapshot_date DESC;

-- Prune old snapshots
CREATE OR REPLACE FUNCTION prune_zone_revenue_snapshots(days_old INT DEFAULT 90)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE deleted INT;
BEGIN
  DELETE FROM zone_revenue_snapshots
  WHERE snapshot_date < (CURRENT_DATE - days_old);
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
