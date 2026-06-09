-- Migration 040: Fahrer-Abrechnungs-Perioden Management
-- Fügt Views und Indizes hinzu, um Perioden-Abrechnungen effizienter abzufragen
-- und CSV-Exports zu ermöglichen.

-- ─── View: Perioden mit Fahrerdaten ──────────────────────────────────────────
CREATE OR REPLACE VIEW v_payout_periods_full AS
SELECT
  p.id,
  p.location_id,
  p.driver_id,
  p.period_type,
  p.period_start,
  p.period_end,
  p.deliveries_count,
  p.total_km,
  p.total_base,
  p.total_km_bonus,
  p.total_peak_bonus,
  p.total_rating_bonus,
  p.total_milestone_bonus,
  p.total_payout,
  p.avg_rating,
  p.on_time_rate_pct,
  p.status,
  p.approved_at,
  p.paid_at,
  p.notes,
  p.created_at,
  p.updated_at,
  -- Fahrerdaten
  COALESCE(d.name, e.name) AS driver_name,
  e.name AS employee_name,
  d.fahrzeug AS vehicle_type
FROM driver_payout_periods p
LEFT JOIN mise_drivers d ON d.id = p.driver_id
LEFT JOIN employees e ON e.id = d.employee_id;

-- ─── View: Tages-Zusammenfassung pro Location ────────────────────────────────
CREATE OR REPLACE VIEW v_payout_daily_summary AS
SELECT
  location_id,
  DATE(period_start AT TIME ZONE 'Europe/Berlin') AS period_date,
  COUNT(*)                                          AS driver_count,
  SUM(deliveries_count)                             AS total_deliveries,
  SUM(total_km)                                     AS total_km,
  SUM(total_payout)                                 AS total_payout_eur,
  AVG(avg_rating) FILTER (WHERE avg_rating IS NOT NULL) AS avg_rating,
  COUNT(*) FILTER (WHERE status = 'draft')          AS draft_count,
  COUNT(*) FILTER (WHERE status = 'approved')       AS approved_count,
  COUNT(*) FILTER (WHERE status = 'paid')           AS paid_count
FROM driver_payout_periods
GROUP BY location_id, DATE(period_start AT TIME ZONE 'Europe/Berlin');

-- ─── Index: Perioden nach Status + Location (für Bulk-Operationen) ───────────
CREATE INDEX IF NOT EXISTS idx_payout_periods_location_status
  ON driver_payout_periods (location_id, status, period_start DESC);

-- ─── Index: Payout-Records für CSV-Export (location + zeitraum) ──────────────
CREATE INDEX IF NOT EXISTS idx_payout_records_export
  ON driver_payout_records (location_id, completed_at DESC, paid_out);

-- RLS für neue Views
DO $$
BEGIN
  ALTER VIEW v_payout_periods_full OWNER TO postgres;
  ALTER VIEW v_payout_daily_summary OWNER TO postgres;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
