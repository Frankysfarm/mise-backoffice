-- Migration 059: Smart Driver Pre-Positioning Engine
-- Proaktive Zonen-Empfehlungen für Fahrer basierend auf Nachfrage-Prognosen.
-- Fahrer erhalten Vorschläge sich in optimalen Zonen zu positionieren wenn sie idle sind.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabelle: driver_positioning_suggestions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_positioning_suggestions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  driver_id         UUID        NOT NULL,                                     -- mise_drivers.id
  target_zone       TEXT        NOT NULL,                                     -- 'home' | 'A' | 'B' | 'C' | 'D'
  target_lat        FLOAT,                                                    -- Empfohlene GPS-Position (Breitengrad)
  target_lng        FLOAT,                                                    -- Empfohlene GPS-Position (Längengrad)
  target_label      TEXT        NOT NULL,                                     -- Lesbarer Standortname
  reason            TEXT        NOT NULL,                                     -- Warum dieser Vorschlag
  demand_score      INT         NOT NULL DEFAULT 0 CHECK (demand_score BETWEEN 0 AND 100),
  response          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (response IN ('pending', 'accepted', 'rejected', 'expired')),
  responded_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indizes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dps_location_created
  ON driver_positioning_suggestions (location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dps_driver_response
  ON driver_positioning_suggestions (driver_id, response, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_dps_location_response
  ON driver_positioning_suggestions (location_id, response, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- View: v_positioning_compliance
-- Compliance-Rate pro Location (letzte 24h)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_positioning_compliance AS
SELECT
  location_id,
  COUNT(*)                                                             AS total_suggestions,
  COUNT(*) FILTER (WHERE response = 'accepted')                        AS accepted,
  COUNT(*) FILTER (WHERE response = 'rejected')                        AS rejected,
  COUNT(*) FILTER (WHERE response = 'expired')                         AS expired,
  COUNT(*) FILTER (WHERE response = 'pending')                         AS pending,
  ROUND(
    COUNT(*) FILTER (WHERE response = 'accepted') * 100.0
    / NULLIF(COUNT(*) FILTER (WHERE response <> 'pending'), 0)
  , 1)                                                                 AS acceptance_rate_pct,
  AVG(
    EXTRACT(EPOCH FROM (responded_at - created_at)) / 60.0
  ) FILTER (WHERE responded_at IS NOT NULL)                            AS avg_response_min
FROM driver_positioning_suggestions
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY location_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE driver_positioning_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_positioning"
  ON driver_positioning_suggestions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
