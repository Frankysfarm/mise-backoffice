-- Migration 197: Liefertreue-Matrix Engine
-- Speichert 7×24-Heatmap der Lieferpünktlichkeit je Standort

-- ── Haupt-Snapshot-Tabelle ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS liefertreue_matrix_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Zell-Koordinaten (day_of_week: 0=So…6=Sa, hour_of_day: 0–23)
  day_of_week       SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour_of_day       SMALLINT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),

  -- Aggregierte Werte über weeksBack Wochen
  on_time_rate      NUMERIC(5,4),        -- 0.0000–1.0000
  avg_delivery_min  NUMERIC(6,2),
  order_count       INTEGER NOT NULL DEFAULT 0,
  weeks_used        SMALLINT NOT NULL DEFAULT 0,

  -- Bewertung
  quality_label     TEXT NOT NULL DEFAULT 'keine_daten',
  -- excellent(≥0.85) · good(≥0.70) · fair(≥0.55) · poor(≥0.40) · critical(<0.40) · keine_daten
  is_hotspot        BOOLEAN NOT NULL DEFAULT false,  -- true wenn on_time_rate < 0.60 und order_count >= 5

  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (location_id, day_of_week, hour_of_day)
);

-- ── Indizes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ltm_snapshots_location
  ON liefertreue_matrix_snapshots (location_id, day_of_week, hour_of_day);

CREATE INDEX IF NOT EXISTS idx_ltm_snapshots_hotspot
  ON liefertreue_matrix_snapshots (location_id, is_hotspot)
  WHERE is_hotspot = true;

-- ── updated_at Trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_liefertreue_matrix_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_liefertreue_matrix_updated_at ON liefertreue_matrix_snapshots;
CREATE TRIGGER trg_liefertreue_matrix_updated_at
  BEFORE UPDATE ON liefertreue_matrix_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_liefertreue_matrix_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE liefertreue_matrix_snapshots ENABLE ROW LEVEL SECURITY;

-- service_role: vollen Zugriff
CREATE POLICY "service_full_liefertreue_matrix" ON liefertreue_matrix_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- authenticated: nur eigene Standorte lesen
CREATE POLICY "auth_read_own_liefertreue_matrix" ON liefertreue_matrix_snapshots
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM user_location_access WHERE user_id = auth.uid()
    )
  );

-- ── Cleanup-Funktion ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_liefertreue_matrix_snapshots(days_old INT DEFAULT 30)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted INT;
BEGIN
  DELETE FROM liefertreue_matrix_snapshots
  WHERE updated_at < now() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ── View: Hotspot-Zusammenfassung je Standort ────────────────────────────

CREATE OR REPLACE VIEW v_liefertreue_hotspots AS
SELECT
  location_id,
  COUNT(*)                                                  AS total_cells,
  COUNT(*) FILTER (WHERE is_hotspot)                        AS hotspot_count,
  AVG(on_time_rate)                                         AS avg_on_time_rate,
  MIN(on_time_rate)                                         AS min_on_time_rate,
  MAX(on_time_rate)                                         AS max_on_time_rate,
  SUM(order_count)                                          AS total_orders_in_matrix,
  MAX(computed_at)                                          AS last_computed_at
FROM liefertreue_matrix_snapshots
GROUP BY location_id;
