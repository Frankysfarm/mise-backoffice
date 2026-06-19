-- Migration 129: Delivery Performance Score Engine
-- Täglicher aggregierter Standort-Score (0–100) aus 4 Dimensionen:
--   35% Pünktlichkeit (on_time_score)
--   30% Kundenzufriedenheit (satisfaction_score)
--   20% Fahrerauslastung (utilization_score)
--   15% Marge (margin_score)

-- ── Snapshot-Tabelle ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_performance_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  score_date            DATE NOT NULL,

  -- Dimension 1: Pünktlichkeit (0–100)
  on_time_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
  on_time_rate_pct      NUMERIC(5,2),        -- raw: % Lieferungen pünktlich
  total_deliveries      INTEGER DEFAULT 0,
  on_time_deliveries    INTEGER DEFAULT 0,

  -- Dimension 2: Kundenzufriedenheit (0–100)
  satisfaction_score    NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_rating            NUMERIC(3,2),        -- raw: Ø-Bewertung 1–5
  rated_orders          INTEGER DEFAULT 0,

  -- Dimension 3: Fahrerauslastung (0–100)
  utilization_score     NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_utilization_pct   NUMERIC(5,2),        -- raw: Ø Orders pro Fahrer-Kapazität
  active_drivers        INTEGER DEFAULT 0,

  -- Dimension 4: Marge (0–100)
  margin_score          NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_margin_pct        NUMERIC(5,2),        -- raw: Ø Marge %
  total_revenue_eur     NUMERIC(10,2) DEFAULT 0,

  -- Gesamt-Score
  overall_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
  grade                 TEXT NOT NULL DEFAULT 'F'
                          CHECK(grade IN ('A+','A','B+','B','C','D','F')),

  -- Schwächste Dimension (für Empfehlung)
  weakest_dimension     TEXT CHECK(weakest_dimension IN ('on_time','satisfaction','utilization','margin')),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (location_id, score_date)
);

-- RLS
ALTER TABLE delivery_performance_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees can read own location performance scores"
  ON delivery_performance_scores FOR SELECT
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE id = auth.uid()
    )
  );
CREATE POLICY "service role can manage performance scores"
  ON delivery_performance_scores FOR ALL
  USING (auth.role() = 'service_role');

-- Indizes
CREATE INDEX IF NOT EXISTS idx_perf_scores_location_date
  ON delivery_performance_scores (location_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_perf_scores_overall
  ON delivery_performance_scores (overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_perf_scores_grade
  ON delivery_performance_scores (grade);

-- updated_at Trigger
CREATE OR REPLACE FUNCTION update_performance_scores_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_perf_scores_updated_at
  BEFORE UPDATE ON delivery_performance_scores
  FOR EACH ROW EXECUTE FUNCTION update_performance_scores_updated_at();

-- ── View: letzter Score je Standort ──────────────────────────────────────────
CREATE OR REPLACE VIEW v_performance_score_latest AS
SELECT DISTINCT ON (dps.location_id)
  dps.*,
  l.name AS location_name
FROM delivery_performance_scores dps
JOIN locations l ON l.id = dps.location_id
ORDER BY dps.location_id, dps.score_date DESC;

-- ── View: Alle Standorte mit Score + Rank ────────────────────────────────────
CREATE OR REPLACE VIEW v_performance_score_ranking AS
SELECT
  dps.*,
  l.name AS location_name,
  RANK() OVER (ORDER BY dps.overall_score DESC) AS live_rank,
  COUNT(*) OVER () AS total_locations
FROM (
  SELECT DISTINCT ON (location_id) *
  FROM delivery_performance_scores
  ORDER BY location_id, score_date DESC
) dps
JOIN locations l ON l.id = dps.location_id;

-- ── RPC: Alte Snapshots bereinigen ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_old_performance_scores(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM delivery_performance_scores
  WHERE score_date < CURRENT_DATE - days_to_keep;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
