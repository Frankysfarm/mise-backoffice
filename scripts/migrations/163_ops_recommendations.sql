-- Phase 342: Ops Decision Support Engine
-- Synthesizes signals from all delivery data sources into prioritized action items.

CREATE TABLE IF NOT EXISTS ops_recommendations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  type         text NOT NULL,
  priority     text NOT NULL CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  title        text NOT NULL,
  body         text NOT NULL,
  action_label text,
  action_type  text,
  action_params jsonb NOT NULL DEFAULT '{}',
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'dismissed', 'expired', 'auto_resolved')),
  impact_estimate text,
  data_snapshot jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '2 hours')
);

CREATE INDEX IF NOT EXISTS idx_ops_recos_location_status
  ON ops_recommendations(location_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_recos_location_type
  ON ops_recommendations(location_id, type, created_at DESC);

ALTER TABLE ops_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_ops_recos" ON ops_recommendations;
CREATE POLICY "service_role_ops_recos"
  ON ops_recommendations
  USING (true)
  WITH CHECK (true);

-- Prune helper (returns count of deleted rows)
CREATE OR REPLACE FUNCTION prune_ops_recommendations(days_old int DEFAULT 7)
RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  WITH deleted AS (
    DELETE FROM ops_recommendations
    WHERE created_at < now() - (days_old || ' days')::interval
    RETURNING id
  )
  SELECT count(*)::int FROM deleted;
$$;
