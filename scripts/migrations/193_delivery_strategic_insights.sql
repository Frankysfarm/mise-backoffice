-- Migration 193: delivery_strategic_insights
-- Phase 403: Strategic Business Intelligence Engine
-- Persistiert pattern-basierte Erkenntnisse über längere Zeiträume (Tage/Wochen)
-- Ergänzt ops_recommendations (Echtzeit-Empfehlungen) um strategische Muster-Analyse.

CREATE TABLE IF NOT EXISTS delivery_strategic_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES mise_locations(id) ON DELETE CASCADE,

  -- Klassifikation
  category TEXT NOT NULL CHECK (category IN ('sla','revenue','drivers','zones','kitchen','customers')),
  insight_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('critical','warning','info','positive')),

  -- Inhalt
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  impact_score INTEGER NOT NULL DEFAULT 0 CHECK (impact_score BETWEEN 0 AND 100),
  recommendation TEXT,

  -- Status
  is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,

  -- Lifecycle
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Dedup: max 1 aktive Insight pro location + insight_type
  UNIQUE(location_id, insight_type)
);

CREATE INDEX IF NOT EXISTS idx_dsi_location_severity ON delivery_strategic_insights(location_id, severity);
CREATE INDEX IF NOT EXISTS idx_dsi_location_category ON delivery_strategic_insights(location_id, category);
CREATE INDEX IF NOT EXISTS idx_dsi_generated_at ON delivery_strategic_insights(generated_at);

-- RLS
ALTER TABLE delivery_strategic_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dsi_service_role_full" ON delivery_strategic_insights
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "dsi_authenticated_read" ON delivery_strategic_insights
  FOR SELECT TO authenticated
  USING (location_id IN (
    SELECT location_id FROM user_location_access WHERE user_id = auth.uid()
  ));

CREATE POLICY "dsi_authenticated_update" ON delivery_strategic_insights
  FOR UPDATE TO authenticated
  USING (location_id IN (
    SELECT location_id FROM user_location_access WHERE user_id = auth.uid()
  ));

-- updated_at trigger
CREATE OR REPLACE FUNCTION touch_dsi_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_dsi_updated_at ON delivery_strategic_insights;
CREATE TRIGGER trg_dsi_updated_at
  BEFORE UPDATE ON delivery_strategic_insights
  FOR EACH ROW EXECUTE FUNCTION touch_dsi_updated_at();

-- Prune RPC
CREATE OR REPLACE FUNCTION prune_delivery_strategic_insights(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pruned INTEGER;
BEGIN
  DELETE FROM delivery_strategic_insights
  WHERE generated_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND is_acknowledged = TRUE;
  GET DIAGNOSTICS pruned = ROW_COUNT;
  RETURN pruned;
END;
$$;

-- Aggregierter View: Insights-Zusammenfassung je Location
CREATE OR REPLACE VIEW v_strategic_insights_summary AS
SELECT
  location_id,
  COUNT(*) FILTER (WHERE NOT is_dismissed) AS total_active,
  COUNT(*) FILTER (WHERE severity = 'critical' AND NOT is_dismissed) AS critical_count,
  COUNT(*) FILTER (WHERE severity = 'warning' AND NOT is_dismissed) AS warning_count,
  COUNT(*) FILTER (WHERE severity = 'positive' AND NOT is_dismissed) AS positive_count,
  COUNT(*) FILTER (WHERE NOT is_acknowledged AND NOT is_dismissed) AS unacknowledged_count,
  MAX(generated_at) AS last_generated_at
FROM delivery_strategic_insights
GROUP BY location_id;
