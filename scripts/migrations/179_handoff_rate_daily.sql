-- Migration 179: Handoff-Rate Tages-Snapshots
-- Persistiert täglich aggregierte Handoff-Wartezeiten (fertig_am → abgeholt_am)
-- für Trend-Analyse im Kitchen-Dashboard.

CREATE TABLE IF NOT EXISTS handoff_rate_daily (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  snapshot_date    DATE        NOT NULL,

  -- Zählungen
  total_orders     INTEGER     NOT NULL DEFAULT 0,  -- Lieferbestellungen mit fertig_am + abgeholt_am
  quick_pickups    INTEGER     NOT NULL DEFAULT 0,  -- abgeholt_am - fertig_am < 3 Min
  ok_pickups       INTEGER     NOT NULL DEFAULT 0,  -- 3–5 Min
  late_pickups     INTEGER     NOT NULL DEFAULT 0,  -- > 5 Min

  -- Zeitstatistiken (Minuten)
  avg_wait_min     NUMERIC(6,2),
  p50_wait_min     NUMERIC(6,2),
  p75_wait_min     NUMERIC(6,2),
  p95_wait_min     NUMERIC(6,2),
  max_wait_min     NUMERIC(6,2),

  -- Raten (Prozent)
  quick_rate_pct   NUMERIC(5,2),   -- % < 3 Min (Ziel: ≥ 70%)
  ok_rate_pct      NUMERIC(5,2),   -- % 3–5 Min
  late_rate_pct    NUMERIC(5,2),   -- % > 5 Min (KPI: soll < 15%)

  -- Kontext
  peak_wait_hour   SMALLINT,       -- Berliner Stunde mit den meisten verspäteten Abholungen

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (location_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_handoff_rate_daily_loc_date
  ON handoff_rate_daily (location_id, snapshot_date DESC);

-- RLS: nur service_role schreibt Snapshots
ALTER TABLE handoff_rate_daily ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='handoff_rate_daily' AND policyname='service_role full'
  ) THEN
    CREATE POLICY "service_role full" ON handoff_rate_daily
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- updated_at Trigger
CREATE OR REPLACE FUNCTION trg_handoff_rate_daily_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_handoff_rate_daily_updated_at ON handoff_rate_daily;
CREATE TRIGGER trg_handoff_rate_daily_updated_at
  BEFORE UPDATE ON handoff_rate_daily
  FOR EACH ROW EXECUTE PROCEDURE trg_handoff_rate_daily_updated_at();

-- Prune-RPC
CREATE OR REPLACE FUNCTION prune_handoff_rate_daily(days_to_keep INTEGER DEFAULT 180)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pruned INTEGER;
BEGIN
  DELETE FROM handoff_rate_daily WHERE snapshot_date < CURRENT_DATE - days_to_keep;
  GET DIAGNOSTICS pruned = ROW_COUNT;
  RETURN pruned;
END; $$;

-- 30-Tage-Trend-View (für schnelle Dashboard-Abfragen)
CREATE OR REPLACE VIEW v_handoff_rate_trend_30d AS
SELECT
  location_id,
  snapshot_date,
  total_orders,
  quick_pickups,
  late_pickups,
  avg_wait_min,
  p75_wait_min,
  quick_rate_pct,
  late_rate_pct
FROM handoff_rate_daily
WHERE snapshot_date >= CURRENT_DATE - 30
ORDER BY location_id, snapshot_date;
