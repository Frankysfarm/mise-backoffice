-- Migration 201: Wartezeit-Analyse-Engine — Phase 419
-- Analytik-Views für Wartezeiten entlang der Liefer-Pipeline.
-- Liest aus order_lifecycle_snapshots (bereits vorhanden).

-- ── View: Stündliche Wartezeit-Zusammenfassung ────────────────────────────────
CREATE OR REPLACE VIEW v_wartezeit_stunden AS
SELECT
  location_id,
  date_trunc('hour', created_at AT TIME ZONE 'UTC')         AS stunde_utc,
  COUNT(*)                                                    AS anzahl,
  ROUND(AVG(kitchen_prep_min)::NUMERIC,  2)                  AS avg_kueche_min,
  ROUND(AVG(pickup_wait_min)::NUMERIC,   2)                  AS avg_abholung_min,
  ROUND(AVG(drive_min)::NUMERIC,         2)                  AS avg_zustellung_min,
  ROUND(AVG(total_delivery_min)::NUMERIC,2)                  AS avg_gesamt_min,
  ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY total_delivery_min)::NUMERIC, 2)
                                                             AS p90_gesamt_min
FROM order_lifecycle_snapshots
WHERE kitchen_prep_min IS NOT NULL
GROUP BY location_id, date_trunc('hour', created_at AT TIME ZONE 'UTC');

-- ── View: Tägliche Wartezeit-Trends ──────────────────────────────────────────
CREATE OR REPLACE VIEW v_wartezeit_tage AS
SELECT
  location_id,
  (created_at AT TIME ZONE 'Europe/Berlin')::DATE             AS tag_berlin,
  COUNT(*)                                                     AS anzahl,
  ROUND(AVG(kitchen_prep_min)::NUMERIC,  2)                   AS avg_kueche_min,
  ROUND(AVG(pickup_wait_min)::NUMERIC,   2)                   AS avg_abholung_min,
  ROUND(AVG(drive_min)::NUMERIC,         2)                   AS avg_zustellung_min,
  ROUND(AVG(total_delivery_min)::NUMERIC,2)                   AS avg_gesamt_min,
  COUNT(*) FILTER (WHERE total_delivery_min > 35)             AS ueberfaellig_anzahl,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE total_delivery_min <= 35)
    / NULLIF(COUNT(*), 0), 1
  )                                                            AS in_ziel_pct
FROM order_lifecycle_snapshots
WHERE kitchen_prep_min IS NOT NULL
GROUP BY location_id, (created_at AT TIME ZONE 'Europe/Berlin')::DATE;

-- ── View: Fahrer-Abholwartezeit ───────────────────────────────────────────────
-- Zeigt welche Fahrer besonders lange auf ihre Bestellung warten.
CREATE OR REPLACE VIEW v_wartezeit_fahrer AS
SELECT
  ols.location_id,
  ols.fahrer_id,
  e.first_name || ' ' || COALESCE(e.last_name, '')            AS fahrer_name,
  COUNT(*)                                                     AS touren,
  ROUND(AVG(ols.pickup_wait_min)::NUMERIC, 2)                  AS avg_abholung_min,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ols.pickup_wait_min)::NUMERIC, 2)
                                                               AS p75_abholung_min,
  MAX(ols.pickup_wait_min)                                     AS max_abholung_min
FROM order_lifecycle_snapshots ols
LEFT JOIN employees e ON e.id = ols.fahrer_id
WHERE ols.fahrer_id IS NOT NULL
  AND ols.pickup_wait_min IS NOT NULL
  AND ols.created_at >= NOW() - INTERVAL '7 days'
GROUP BY ols.location_id, ols.fahrer_id, e.first_name, e.last_name
ORDER BY avg_abholung_min DESC;

-- Keine neuen Tabellen nötig: liest aus bestehenden order_lifecycle_snapshots.
-- Views sind idempotent (CREATE OR REPLACE).
