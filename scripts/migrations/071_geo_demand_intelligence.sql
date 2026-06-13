-- Migration 071: Geo-Demand Intelligence & Zone Expansion Advisor
-- Analysiert Bestelldichte nach Postleitzahl und identifiziert PLZs außerhalb
-- der aktuellen Lieferzonen als Expansionskandidaten mit ROI-Schätzung.

CREATE TABLE IF NOT EXISTS delivery_geo_demand_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  snapshot_date   date        NOT NULL,
  plz             text        NOT NULL,
  order_count     int         NOT NULL DEFAULT 0,
  revenue_eur     numeric(10,2) NOT NULL DEFAULT 0,
  avg_distance_km numeric(6,2),
  on_time_count   int         NOT NULL DEFAULT 0,
  zone_name       text,           -- 'A'/'B'/'C'/'D' oder NULL wenn außerhalb
  is_outside_zone boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, snapshot_date, plz)
);

CREATE INDEX IF NOT EXISTS idx_geo_demand_loc_date
  ON delivery_geo_demand_snapshots (location_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_geo_demand_outside
  ON delivery_geo_demand_snapshots (location_id, is_outside_zone)
  WHERE is_outside_zone = true;

ALTER TABLE delivery_geo_demand_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geo_demand_tenant_isolation"
  ON delivery_geo_demand_snapshots
  USING (
    location_id IN (
      SELECT id FROM locations
      WHERE tenant_id = (
        SELECT tenant_id FROM employees
        WHERE auth_user_id = auth.uid()
        LIMIT 1
      )
    )
  );

-- ─── View: Nachfrage-Zusammenfassung letzte 30 Tage pro PLZ ──────────────────

CREATE OR REPLACE VIEW v_geo_demand_summary AS
SELECT
  location_id,
  plz,
  zone_name,
  is_outside_zone,
  SUM(order_count)                                                        AS total_orders,
  ROUND(SUM(revenue_eur)::numeric, 2)                                     AS total_revenue_eur,
  ROUND(AVG(avg_distance_km)::numeric, 2)                                 AS avg_distance_km,
  SUM(on_time_count)                                                      AS total_on_time,
  ROUND(
    CASE WHEN SUM(order_count) > 0
      THEN SUM(on_time_count)::numeric / SUM(order_count) * 100
      ELSE 0
    END, 1
  )                                                                       AS on_time_pct,
  COUNT(DISTINCT snapshot_date)                                           AS days_with_data,
  MAX(snapshot_date)::text                                                AS last_seen_date
FROM delivery_geo_demand_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY location_id, plz, zone_name, is_outside_zone;

-- ─── View: Expansionskandidaten ───────────────────────────────────────────────
-- PLZs außerhalb der Zone mit ≥3 Bestellungen in 30 Tagen + Demand-Score

CREATE OR REPLACE VIEW v_zone_expansion_candidates AS
SELECT
  location_id,
  plz,
  SUM(order_count)                                                        AS total_orders,
  ROUND(SUM(revenue_eur)::numeric, 2)                                     AS total_revenue_eur,
  ROUND(AVG(avg_distance_km)::numeric, 2)                                 AS avg_distance_km,
  COUNT(DISTINCT snapshot_date)                                           AS active_days,
  -- Hochrechnung: Wöchentlicher Umsatz (aus tatsächlichen aktiven Tagen)
  ROUND(
    SUM(revenue_eur)::numeric / GREATEST(COUNT(DISTINCT snapshot_date), 1) * 7,
    2
  )                                                                       AS estimated_weekly_revenue,
  -- Jahres-Projektion
  ROUND(
    SUM(revenue_eur)::numeric / GREATEST(COUNT(DISTINCT snapshot_date), 1) * 365,
    2
  )                                                                       AS projected_annual_revenue,
  -- Demand-Score: Umsatz × Häufigkeit ÷ Distanz-Penalty
  ROUND(
    (SUM(revenue_eur)::numeric * COUNT(DISTINCT snapshot_date)::numeric)
    / GREATEST(AVG(avg_distance_km)::numeric, 1.0),
    1
  )                                                                       AS expansion_score
FROM delivery_geo_demand_snapshots
WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
  AND is_outside_zone = true
GROUP BY location_id, plz
HAVING SUM(order_count) >= 3
ORDER BY expansion_score DESC;

COMMENT ON TABLE delivery_geo_demand_snapshots IS
  'Tägliche Nachfrage-Snapshots nach PLZ pro Location. '
  'Basis für Zonen-Expansions-Empfehlungen und Demand-Heatmap.';

COMMENT ON VIEW v_geo_demand_summary IS
  'Aggregierte PLZ-Nachfrage letzte 30 Tage: Orders, Umsatz, Pünktlichkeit, Zone.';

COMMENT ON VIEW v_zone_expansion_candidates IS
  'PLZs außerhalb der aktuellen Zonen mit ≥3 Bestellungen/30d. '
  'Sortiert nach Expansion-Score (Umsatz × Häufigkeit ÷ Distanz).';
