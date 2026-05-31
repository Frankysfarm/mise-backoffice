-- Migration 015: Push-Outbox Indices für Smart-Dispatch-Benachrichtigungen
--
-- Zweck: Optimiert mise_push_outbox-Abfragen des push-flush-Cron.
-- Ab Phase 15 schreibt dispatch-engine.ts direkt in mise_push_outbox
-- (bisher nur via DB-Trigger aus Legacy-System).

-- ============================================================
-- 1. mise_push_outbox — Pflicht-Struktur (IF NOT EXISTS)
--    Tabelle wird vom Frank-System verwaltet; wir ergänzen nur
--    fehlende Indices für den neuen Smart-Dispatch-Pfad.
-- ============================================================

-- Index: unsent Pushes für den push-flush-Cron (sent_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_mise_push_outbox_unsent
  ON mise_push_outbox (driver_id, created_at ASC)
  WHERE sent_at IS NULL AND failed_at IS NULL;

COMMENT ON INDEX idx_mise_push_outbox_unsent IS
  'Beschleunigt push-flush-Cron: Sucht ungesendete Pushes sortiert nach Erstellzeit.';

-- Index: pending_acceptance Batches ohne Push (für fn_repush_pending_batches)
CREATE INDEX IF NOT EXISTS idx_mise_push_outbox_batch
  ON mise_push_outbox ((data->>'batch_id'))
  WHERE sent_at IS NULL;

COMMENT ON INDEX idx_mise_push_outbox_batch IS
  'Ermöglicht schnelles Prüfen ob für einen Batch bereits ein Push enqueued ist.';

-- ============================================================
-- 2. driver_push_outbox — Web-Push Indices (VAPID-Kanal)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_driver_push_outbox_unsent
  ON driver_push_outbox (employee_id, created_at ASC)
  WHERE sent_at IS NULL;

COMMENT ON INDEX idx_driver_push_outbox_unsent IS
  'Beschleunigt web-push-flush: Sucht ungesendete VAPID-Pushes nach Employee.';

-- ============================================================
-- 3. v_push_delivery_stats VIEW — Monitoring Push-Durchsatz
--    Zeigt Erfolgsrate der letzten 24h für Admin-Dashboard.
-- ============================================================
CREATE OR REPLACE VIEW v_push_delivery_stats AS
SELECT
  'mise' AS channel,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '24 hours')       AS sent_24h,
  COUNT(*) FILTER (
    WHERE created_at >= now() - INTERVAL '24 hours'
      AND sent_at IS NOT NULL
  )                                                                         AS delivered_24h,
  COUNT(*) FILTER (
    WHERE created_at >= now() - INTERVAL '24 hours'
      AND failed_at IS NOT NULL
  )                                                                         AS failed_24h,
  COUNT(*) FILTER (WHERE sent_at IS NULL AND failed_at IS NULL)            AS pending_now
FROM mise_push_outbox

UNION ALL

SELECT
  'webpush' AS channel,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '24 hours')       AS sent_24h,
  COUNT(*) FILTER (
    WHERE created_at >= now() - INTERVAL '24 hours'
      AND sent_at IS NOT NULL
  )                                                                         AS delivered_24h,
  COUNT(*) FILTER (
    WHERE created_at >= now() - INTERVAL '24 hours'
      AND error IS NULL
      AND sent_at IS NOT NULL
  )                                                                         AS failed_24h,
  COUNT(*) FILTER (WHERE sent_at IS NULL)                                  AS pending_now
FROM driver_push_outbox;

COMMENT ON VIEW v_push_delivery_stats IS
  'Push-Kanal-Durchsatz (letzte 24h): mise (VoIP/Expo) und webpush (VAPID).';
