-- 186_delivery_transparency.sql
-- Delivery Transparency Snapshots + Trust Score (Phase 389)
-- Täglicher Vertrauens-Score 0–100 + Badge Bronze/Silver/Gold/Platinum je Standort.
-- Daten kommen aus bestehenden Qualitäts-Tabellen — kein neues Tracking nötig.

CREATE TABLE IF NOT EXISTS delivery_transparency_snapshots (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id      uuid NOT NULL REFERENCES mise_locations(id) ON DELETE CASCADE,
  snapshot_date    date NOT NULL DEFAULT CURRENT_DATE,

  -- Gesamt-Vertrauen
  trust_score      numeric(5,2) NOT NULL DEFAULT 0
                   CHECK (trust_score >= 0 AND trust_score <= 100),
  badge_level      text NOT NULL DEFAULT 'bronze'
                   CHECK (badge_level IN ('bronze','silver','gold','platinum')),

  -- Teilbereiche 0–100
  score_ontime     numeric(5,2) NOT NULL DEFAULT 0,
  score_quality    numeric(5,2) NOT NULL DEFAULT 0,
  score_accuracy   numeric(5,2) NOT NULL DEFAULT 0,
  score_speed      numeric(5,2) NOT NULL DEFAULT 0,
  score_care       numeric(5,2) NOT NULL DEFAULT 0,

  -- Öffentliche Kennzahlen
  avg_delivery_min  numeric(6,2),
  on_time_rate_pct  numeric(5,2),
  satisfaction_rate numeric(5,2),  -- 0–100
  total_deliveries  integer DEFAULT 0,
  orders_last_30d   integer DEFAULT 0,

  -- Trend
  trust_delta      numeric(5,2),   -- + verbessert, – schlechter vs. Vortag
  previous_badge   text,

  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL,

  UNIQUE (location_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_transparency_location_date
  ON delivery_transparency_snapshots (location_id, snapshot_date DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE delivery_transparency_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_transparency"
  ON delivery_transparency_snapshots;
CREATE POLICY "service_role_full_transparency"
  ON delivery_transparency_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_own_location_transparency"
  ON delivery_transparency_snapshots;
CREATE POLICY "authenticated_read_own_location_transparency"
  ON delivery_transparency_snapshots FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT ml.id FROM mise_locations ml
      WHERE ml.tenant_id = (
        SELECT ml2.tenant_id FROM mise_locations ml2
        WHERE ml2.id = delivery_transparency_snapshots.location_id
      )
    )
  );

DROP POLICY IF EXISTS "anon_read_transparency"
  ON delivery_transparency_snapshots;
CREATE POLICY "anon_read_transparency"
  ON delivery_transparency_snapshots FOR SELECT TO anon
  USING (true);

-- ── updated_at Trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_transparency_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_transparency_updated_at
  ON delivery_transparency_snapshots;
CREATE TRIGGER trg_transparency_updated_at
  BEFORE UPDATE ON delivery_transparency_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_transparency_updated_at();

-- ── Prune RPC ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_transparency_snapshots(days_to_keep integer DEFAULT 365)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted integer;
BEGIN
  DELETE FROM delivery_transparency_snapshots
  WHERE snapshot_date < CURRENT_DATE - days_to_keep;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ── Trend View ───────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_transparency_trend AS
SELECT
  location_id,
  snapshot_date,
  trust_score,
  badge_level,
  score_ontime,
  score_quality,
  score_accuracy,
  score_speed,
  score_care,
  avg_delivery_min,
  on_time_rate_pct,
  satisfaction_rate,
  trust_delta,
  total_deliveries,
  ROW_NUMBER() OVER (PARTITION BY location_id ORDER BY snapshot_date DESC) AS recency_rank
FROM delivery_transparency_snapshots
ORDER BY location_id, snapshot_date DESC;
