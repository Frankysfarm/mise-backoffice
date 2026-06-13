-- Migration 064: Recency-Weighted Driver Rating (Phase 106)
--
-- Zweck:
--   Verbessert die Fahrer-Bewertungsalgorithmen durch Recency-Gewichtung:
--   neuere Lieferungen zählen exponentiell mehr als ältere.
--
--   Halbwertszeit: 10 Lieferungen (Performance) / 7 Bewertungen (Kunden)
--   λ_perf  = ln(2)/10 ≈ 0.0693  → Lieferung vor 10 Touren zählt halb so viel
--   λ_cust  = ln(2)/7  ≈ 0.0990  → Bewertung vor 7 Touren zählt halb so viel
--
-- Ersetzt:
--   recompute_driver_rating (Migration 016) — gleiche Signatur, DROP REPLACE
--   recompute_driver_rating_with_satisfaction (Migration 022) — gleiche Signatur
--
-- Neu:
--   v_driver_rating_breakdown — Transparenz-View: gewichtete Score-Komponenten

-- ============================================================
-- 1. recompute_driver_rating — Recency-gewichtet
--    Gleiche Signatur wie Migration 016, vollständig kompatibel.
-- ============================================================
CREATE OR REPLACE FUNCTION recompute_driver_rating(p_driver_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_weighted_on_time  numeric;
  v_weighted_avg_dev  numeric;
  v_avg_del_min       numeric;
  v_sample_count      int;
  v_new_rating        numeric;
BEGIN
  WITH ranked AS (
    SELECT
      on_time,
      eta_deviation_min,
      delivery_min,
      -- age=0 für jüngste Lieferung, age=29 für älteste der letzten 30
      (ROW_NUMBER() OVER (ORDER BY recorded_at DESC) - 1) AS age
    FROM delivery_performance
    WHERE driver_id = p_driver_id
      AND eta_latest_at IS NOT NULL
    ORDER BY recorded_at DESC
    LIMIT 30
  ),
  weighted AS (
    SELECT
      on_time,
      eta_deviation_min,
      delivery_min,
      -- λ = ln(2)/10 ≈ 0.0693 → Halbwertszeit 10 Lieferungen
      EXP(-0.0693 * age) AS w
    FROM ranked
  )
  SELECT
    COUNT(*)::int,
    SUM(CASE WHEN on_time THEN w ELSE 0 END) / NULLIF(SUM(w), 0),
    SUM(COALESCE(eta_deviation_min, 0) * w)  / NULLIF(SUM(w), 0),
    AVG(delivery_min) FILTER (WHERE delivery_min IS NOT NULL AND delivery_min > 0)
  INTO v_sample_count, v_weighted_on_time, v_weighted_avg_dev, v_avg_del_min
  FROM weighted;

  -- Weniger als 3 Datenpunkte → kein Update
  IF v_sample_count < 3 THEN
    RETURN;
  END IF;

  -- Rating 1–5 aus gewichteter On-Time-Rate + Abweichung
  v_new_rating := CASE
    WHEN v_weighted_on_time >= 0.95 AND v_weighted_avg_dev <= 5  THEN 5.0
    WHEN v_weighted_on_time >= 0.85 AND v_weighted_avg_dev <= 10 THEN 4.5
    WHEN v_weighted_on_time >= 0.75                               THEN 4.0
    WHEN v_weighted_on_time >= 0.60                               THEN 3.0
    WHEN v_weighted_on_time >= 0.45                               THEN 2.0
    ELSE 1.0
  END;

  UPDATE mise_drivers
  SET
    rating           = v_new_rating,
    avg_delivery_min = ROUND(COALESCE(v_avg_del_min, 25))::int
  WHERE id = p_driver_id;
END;
$$;

COMMENT ON FUNCTION recompute_driver_rating IS
  'Recency-gewichtetes Fahrer-Rating (Halbwertszeit 10 Lieferungen). '
  'Ersetzt Migration 016. Neuere Lieferungen zählen exponentiell mehr als ältere.';

-- ============================================================
-- 2. recompute_driver_rating_with_satisfaction — Recency-gewichtet
--    Gleiche Signatur wie Migration 022, vollständig kompatibel.
--    Kombiniert ETA-Performance (60%) + Kunden-Rating (40%) — beide recency-gewichtet.
-- ============================================================
CREATE OR REPLACE FUNCTION recompute_driver_rating_with_satisfaction(p_driver_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_perf_rating   numeric;
  v_cust_rating   numeric;
  v_final_rating  numeric;
  v_avg_min       numeric;
  v_perf_count    int;
  v_cust_count    int;
BEGIN
  -- Leistungs-Rating mit Recency-Gewichtung (λ = 0.0693, Halbwertszeit 10 Lieferungen)
  WITH ranked AS (
    SELECT
      on_time,
      delivery_min,
      (ROW_NUMBER() OVER (ORDER BY recorded_at DESC) - 1) AS age
    FROM delivery_performance
    WHERE driver_id = p_driver_id
      AND recorded_at > NOW() - INTERVAL '30 days'
    ORDER BY recorded_at DESC
    LIMIT 30
  ),
  weighted AS (
    SELECT on_time, delivery_min, EXP(-0.0693 * age) AS w
    FROM ranked
  )
  SELECT
    CASE WHEN COUNT(*) >= 3 THEN
      GREATEST(1.0, LEAST(5.0,
        5.0 - (SUM(CASE WHEN NOT on_time THEN w ELSE 0 END) / NULLIF(SUM(w), 0)) * 4.0
      ))
    ELSE NULL END,
    AVG(delivery_min) FILTER (WHERE delivery_min IS NOT NULL AND delivery_min > 0),
    COUNT(*)::int
  INTO v_perf_rating, v_avg_min, v_perf_count
  FROM weighted;

  -- Kunden-Rating mit Recency-Gewichtung (λ = 0.099, Halbwertszeit 7 Bewertungen)
  WITH ranked_cust AS (
    SELECT
      rating::numeric AS r,
      (ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1) AS age
    FROM customer_delivery_ratings
    WHERE driver_id = p_driver_id
      AND created_at > NOW() - INTERVAL '30 days'
    ORDER BY created_at DESC
    LIMIT 20
  ),
  weighted_cust AS (
    SELECT r, EXP(-0.0990 * age) AS w
    FROM ranked_cust
  )
  SELECT
    SUM(r * w) / NULLIF(SUM(w), 0),
    COUNT(*)::int
  INTO v_cust_rating, v_cust_count
  FROM weighted_cust;

  -- Kombination: 60% ETA-Performance, 40% Kunden-Rating
  v_final_rating := CASE
    WHEN v_perf_rating IS NOT NULL AND v_cust_rating IS NOT NULL THEN
      ROUND((v_perf_rating * 0.6 + v_cust_rating * 0.4)::numeric, 2)
    WHEN v_perf_rating IS NOT NULL THEN ROUND(v_perf_rating::numeric, 2)
    WHEN v_cust_rating IS NOT NULL THEN ROUND(v_cust_rating::numeric, 2)
    ELSE 4.5
  END;

  UPDATE mise_drivers
  SET
    rating           = v_final_rating,
    avg_delivery_min = COALESCE(v_avg_min::int, avg_delivery_min)
  WHERE id = p_driver_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER;

COMMENT ON FUNCTION recompute_driver_rating_with_satisfaction IS
  'Recency-gewichtetes kombiniertes Rating (60% ETA-Performance + 40% Kunden-Bewertung). '
  'Ersetzt Migration 022. ETA: Halbwertszeit 10 Lieferungen. Kunden: Halbwertszeit 7 Bewertungen.';

-- ============================================================
-- 3. v_driver_rating_breakdown — Transparenz-View
--    Zeigt gewichtete Score-Komponenten für Admin-Dashboard.
-- ============================================================
CREATE OR REPLACE VIEW v_driver_rating_breakdown AS
WITH perf AS (
  SELECT
    driver_id,
    COUNT(*)                                                              AS total_deliveries,
    SUM(CASE WHEN on_time THEN EXP(-0.0693 * age) ELSE 0 END)
      / NULLIF(SUM(EXP(-0.0693 * age)), 0)                               AS w_on_time_rate,
    SUM(COALESCE(eta_deviation_min, 0) * EXP(-0.0693 * age))
      / NULLIF(SUM(EXP(-0.0693 * age)), 0)                               AS w_avg_dev_min,
    AVG(delivery_min) FILTER (WHERE delivery_min IS NOT NULL
                                AND delivery_min > 0)                     AS avg_delivery_min
  FROM (
    SELECT
      driver_id, on_time, eta_deviation_min, delivery_min,
      (ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY recorded_at DESC) - 1) AS age
    FROM delivery_performance
    WHERE eta_latest_at IS NOT NULL
      AND recorded_at > NOW() - INTERVAL '90 days'
  ) sub
  WHERE age < 30
  GROUP BY driver_id
),
cust AS (
  SELECT
    driver_id,
    COUNT(*)                                    AS total_cust_ratings,
    SUM(r * EXP(-0.0990 * age))
      / NULLIF(SUM(EXP(-0.0990 * age)), 0)     AS w_cust_rating
  FROM (
    SELECT
      driver_id,
      rating::numeric AS r,
      (ROW_NUMBER() OVER (PARTITION BY driver_id ORDER BY created_at DESC) - 1) AS age
    FROM customer_delivery_ratings
    WHERE created_at > NOW() - INTERVAL '30 days'
  ) sub_c
  WHERE age < 20
  GROUP BY driver_id
)
SELECT
  p.driver_id,
  d.rating                                              AS current_rating,
  p.total_deliveries,
  ROUND((p.w_on_time_rate * 100)::numeric, 1)           AS w_on_time_pct,
  ROUND(p.w_avg_dev_min::numeric, 1)                    AS w_avg_dev_min,
  ROUND(p.avg_delivery_min::numeric, 1)                 AS avg_delivery_min,
  c.total_cust_ratings,
  ROUND(c.w_cust_rating::numeric, 2)                    AS w_cust_rating,
  -- Recency-Score: Anteil der letzten 5 Lieferungen am Gesamtgewicht
  -- Wert nahe 1.0 = wenig Daten, Wert < 0.5 = viele historische Daten vorhanden
  ROUND(
    LEAST(1.0,
      (1 - EXP(-0.0693 * LEAST(p.total_deliveries, 5)::float))
      / (1 - EXP(-0.0693 * LEAST(p.total_deliveries, 30)::float))
    )::numeric,
    2
  )                                                      AS recency_concentration
FROM perf p
LEFT JOIN cust c ON c.driver_id = p.driver_id
LEFT JOIN mise_drivers d ON d.id = p.driver_id;

COMMENT ON VIEW v_driver_rating_breakdown IS
  'Transparenz-View: gewichtete Komponenten des Fahrer-Ratings. '
  'w_on_time_pct / w_avg_dev_min = recency-gewichtete Pünktlichkeit / Abweichung. '
  'recency_concentration: Anteil der letzten 5 Lieferungen am Gesamtgewicht (0–1).';
