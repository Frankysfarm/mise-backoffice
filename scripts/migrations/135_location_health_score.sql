-- Phase 264: Location-Gesundheits-Score API
-- Aggregierter Standort-Score (0–100) aus 4 Dimensionen:
--   40% Pünktlichkeit       (on_time_score)    — fertig_am ≤ eta_earliest
--   25% Fahrerverfügbarkeit (driver_score)     — online Fahrer vs. Bedarf
--   20% Stornoquote         (cancel_score)     — % stornierter Bestellungen (invertiert)
--   15% Kundenzufriedenheit (rating_score)     — Ø Kundenbewertung 1–5 → 0–100

-- ============================================================
-- Tabelle: location_health_scores
-- ============================================================

CREATE TABLE IF NOT EXISTS location_health_scores (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       text        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  score_date        date        NOT NULL,
  -- Rohdaten
  total_deliveries  int         NOT NULL DEFAULT 0,
  on_time_count     int         NOT NULL DEFAULT 0,
  on_time_rate_pct  numeric(5,2),                  -- % pünktlicher Lieferungen
  drivers_online    int         NOT NULL DEFAULT 0, -- aktive Fahrer beim Snapshot
  drivers_needed    int         NOT NULL DEFAULT 0, -- geschätzter Bedarf aus Aufträgen/Kapazität
  cancel_count      int         NOT NULL DEFAULT 0,
  total_orders      int         NOT NULL DEFAULT 0,
  cancel_rate_pct   numeric(5,2),                  -- % stornierter Bestellungen
  avg_rating        numeric(3,2),                  -- Ø Kundenbewertung
  rated_orders      int         NOT NULL DEFAULT 0,
  -- Dimension-Scores (0–100 je)
  on_time_score     int         NOT NULL DEFAULT 0,
  driver_score      int         NOT NULL DEFAULT 0,
  cancel_score      int         NOT NULL DEFAULT 0,
  rating_score      int         NOT NULL DEFAULT 0,
  -- Gesamt
  overall_score     int         NOT NULL DEFAULT 0,
  grade             text        NOT NULL DEFAULT 'F', -- A+/A/B+/B/C/D/F
  trend             text        NOT NULL DEFAULT 'stable', -- up/stable/down
  score_delta       int         NOT NULL DEFAULT 0,  -- Differenz zu Vortag
  weakest_dimension text,                            -- 'on_time'|'driver'|'cancel'|'rating'
  -- Meta
  snapped_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE(location_id, score_date)
);

COMMENT ON TABLE location_health_scores IS
  'Tägliche Standort-Gesundheits-Scores (0–100) aus 4 Dimensionen. Täglich via Cron befüllt.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_location_health_scores_location_date
  ON location_health_scores(location_id, score_date DESC);

CREATE INDEX IF NOT EXISTS idx_location_health_scores_date
  ON location_health_scores(score_date DESC);

-- Updated_at Trigger
CREATE OR REPLACE FUNCTION trg_location_health_scores_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_location_health_scores_updated_at ON location_health_scores;
CREATE TRIGGER trg_location_health_scores_updated_at
  BEFORE UPDATE ON location_health_scores
  FOR EACH ROW EXECUTE FUNCTION trg_location_health_scores_updated_at();

-- RLS
ALTER TABLE location_health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "location_health_scores_service" ON location_health_scores
  USING (true) WITH CHECK (true);

-- ============================================================
-- VIEW: v_location_health_latest
-- ============================================================

CREATE OR REPLACE VIEW v_location_health_latest AS
SELECT
  lhs.*,
  l.name AS location_name
FROM location_health_scores lhs
JOIN locations l ON l.id = lhs.location_id
WHERE lhs.score_date = (
  SELECT MAX(score_date) FROM location_health_scores lhs2
  WHERE lhs2.location_id = lhs.location_id
);

-- ============================================================
-- VIEW: v_location_health_ranking (alle Standorte nach Score)
-- ============================================================

CREATE OR REPLACE VIEW v_location_health_ranking AS
SELECT
  lhs.location_id,
  l.name AS location_name,
  lhs.overall_score,
  lhs.grade,
  lhs.trend,
  lhs.score_delta,
  lhs.score_date,
  RANK() OVER (ORDER BY lhs.overall_score DESC) AS health_rank,
  COUNT(*) OVER ()::int AS total_locations
FROM location_health_scores lhs
JOIN locations l ON l.id = lhs.location_id
WHERE lhs.score_date = (
  SELECT MAX(score_date) FROM location_health_scores lhs2
  WHERE lhs2.location_id = lhs.location_id
);

-- ============================================================
-- RPC: prune_old_health_scores
-- ============================================================

CREATE OR REPLACE FUNCTION prune_old_health_scores(p_days int DEFAULT 90)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_deleted int;
BEGIN
  DELETE FROM location_health_scores
  WHERE score_date < (CURRENT_DATE - p_days);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
