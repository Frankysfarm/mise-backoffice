-- Migration 198: Storno-Muster-Matrix Engine
-- Speichert 7×24-Heatmap der Storno-Muster je Standort

-- ── Haupt-Snapshot-Tabelle ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS storno_muster_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Zell-Koordinaten (day_of_week: 0=So…6=Sa, hour_of_day: 0–23)
  day_of_week       SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour_of_day       SMALLINT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),

  -- Aggregierte Werte über weeksBack Wochen
  storno_rate       NUMERIC(5,4),        -- 0.0000–1.0000
  storno_count      INTEGER NOT NULL DEFAULT 0,
  total_count       INTEGER NOT NULL DEFAULT 0,
  weeks_used        SMALLINT NOT NULL DEFAULT 0,

  -- Häufigste Ursachenkategorie dieser Zelle
  primary_cause     TEXT,
  -- 'kueche_verzoegerung' | 'kein_fahrer' | 'kunde_storniert' | 'zone_problem' | 'unbekannt'

  -- Bewertung
  quality_label     TEXT NOT NULL DEFAULT 'keine_daten',
  -- excellent(<0.03) · good(<0.06) · fair(<0.10) · poor(<0.15) · critical(≥0.15) · keine_daten
  is_hotspot        BOOLEAN NOT NULL DEFAULT false,
  -- true wenn storno_rate >= 0.10 und total_count >= 5

  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (location_id, day_of_week, hour_of_day)
);

-- ── Indizes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_storno_muster_location
  ON storno_muster_snapshots (location_id, day_of_week, hour_of_day);

CREATE INDEX IF NOT EXISTS idx_storno_muster_hotspot
  ON storno_muster_snapshots (location_id, is_hotspot)
  WHERE is_hotspot = true;

-- ── updated_at Trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_storno_muster_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_storno_muster_updated_at ON storno_muster_snapshots;
CREATE TRIGGER trg_storno_muster_updated_at
  BEFORE UPDATE ON storno_muster_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_storno_muster_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE storno_muster_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_storno_muster" ON storno_muster_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_own_storno_muster" ON storno_muster_snapshots
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM user_location_access WHERE user_id = auth.uid()
    )
  );

-- ── Cleanup-Funktion ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_storno_muster_snapshots(days_old INT DEFAULT 30)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted INT;
BEGIN
  DELETE FROM storno_muster_snapshots
  WHERE updated_at < now() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- ── View: Hotspot-Zusammenfassung je Standort ────────────────────────────

CREATE OR REPLACE VIEW v_storno_muster_hotspots AS
SELECT
  location_id,
  COUNT(*)                                              AS total_cells,
  COUNT(*) FILTER (WHERE is_hotspot)                    AS hotspot_count,
  AVG(storno_rate)                                      AS avg_storno_rate,
  MAX(storno_rate)                                      AS max_storno_rate,
  MIN(storno_rate) FILTER (WHERE storno_count > 0)      AS min_storno_rate,
  SUM(storno_count)                                     AS total_stornos,
  SUM(total_count)                                      AS total_orders_in_matrix,
  MAX(computed_at)                                      AS last_computed_at
FROM storno_muster_snapshots
GROUP BY location_id;
