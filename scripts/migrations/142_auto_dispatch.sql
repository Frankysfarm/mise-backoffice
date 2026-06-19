-- ============================================================
-- Migration 142: Auto-Dispatch Engine
-- Phase 277 — Automatische Zuweisung bei Score ≥ 85 + idle Fahrer
--
-- Ergänzt assignment_suggestions um Auto-Dispatch-Log
-- und View für Auto-Dispatch-Statistiken.
-- ============================================================

-- ── Auto-Dispatch-Log ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auto_dispatch_log (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid          NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  suggestion_id   uuid          REFERENCES assignment_suggestions(id) ON DELETE SET NULL,
  order_id        uuid          REFERENCES customer_orders(id) ON DELETE SET NULL,
  driver_id       uuid          REFERENCES mise_drivers(id) ON DELETE SET NULL,
  batch_id        uuid          REFERENCES mise_delivery_batches(id) ON DELETE SET NULL,
  score           numeric(5,2)  NOT NULL,
  distance_km     numeric(6,2),
  vehicle         text,
  dispatched_at   timestamptz   NOT NULL DEFAULT now(),
  outcome         text          NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'skipped', 'error')),
  skip_reason     text
);

CREATE INDEX IF NOT EXISTS idx_auto_dispatch_log_location
  ON auto_dispatch_log (location_id, dispatched_at DESC);

ALTER TABLE auto_dispatch_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svc_all_adl" ON auto_dispatch_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── View: Tages-Statistik Auto-Dispatch ──────────────────────────────────────

CREATE OR REPLACE VIEW v_auto_dispatch_stats AS
SELECT
  location_id,
  date_trunc('day', dispatched_at)::date AS dispatch_date,
  COUNT(*)                               AS total_attempts,
  COUNT(*) FILTER (WHERE outcome = 'success')  AS successful,
  COUNT(*) FILTER (WHERE outcome = 'skipped')  AS skipped,
  COUNT(*) FILTER (WHERE outcome = 'error')    AS errors,
  ROUND(AVG(score)::NUMERIC, 1)          AS avg_score,
  ROUND(AVG(distance_km)::NUMERIC, 2)    AS avg_distance_km
FROM auto_dispatch_log
WHERE dispatched_at >= now() - interval '30 days'
GROUP BY location_id, date_trunc('day', dispatched_at)::date
ORDER BY dispatch_date DESC;
