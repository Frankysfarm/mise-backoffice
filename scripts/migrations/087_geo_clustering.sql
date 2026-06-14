-- Phase 173: Fahrer-Geo-Clustering
-- K-Means Demand-Hotspot-Analyse für optimales Fahrer-Vorpositionieren

-- Cluster-Definitionen (nightly recompute)
CREATE TABLE IF NOT EXISTS delivery_geo_clusters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cluster_idx     INT NOT NULL,
  center_lat      DOUBLE PRECISION NOT NULL,
  center_lng      DOUBLE PRECISION NOT NULL,
  radius_km       DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  order_count     INT NOT NULL DEFAULT 0,
  peak_hour       INT CHECK (peak_hour BETWEEN 0 AND 23),
  avg_hour        DOUBLE PRECISION,
  label           TEXT,
  demand_score    DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, cluster_idx)
);

-- Config pro Location
CREATE TABLE IF NOT EXISTS delivery_geo_cluster_config (
  location_id   UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  k_clusters    INT NOT NULL DEFAULT 5 CHECK (k_clusters BETWEEN 2 AND 12),
  lookback_days INT NOT NULL DEFAULT 30 CHECK (lookback_days BETWEEN 7 AND 90),
  min_orders    INT NOT NULL DEFAULT 3,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  last_computed TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_geo_clusters_location ON delivery_geo_clusters(location_id);
CREATE INDEX IF NOT EXISTS idx_geo_clusters_demand   ON delivery_geo_clusters(location_id, demand_score DESC);

-- updated_at Trigger
CREATE OR REPLACE FUNCTION _update_geo_cluster_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_geo_cluster_updated
    BEFORE UPDATE ON delivery_geo_clusters
    FOR EACH ROW EXECUTE FUNCTION _update_geo_cluster_ts();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_geo_cluster_config_updated
    BEFORE UPDATE ON delivery_geo_cluster_config
    FOR EACH ROW EXECUTE FUNCTION _update_geo_cluster_ts();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS (Service-Role darf alles, Anon nichts)
ALTER TABLE delivery_geo_clusters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_geo_cluster_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "svc_geo_clusters"       ON delivery_geo_clusters       USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "svc_geo_cluster_config" ON delivery_geo_cluster_config USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
