-- Migration 050: Auto-Versand Bewertungs-Links (Phase 70)
--
-- Zweck:
--   Optimiert die processPendingRatingLinks()-Abfrage, die alle gelieferten
--   Bestellungen mit rating_token aber ohne rating_sent_at findet.
--
-- Keine neuen Tabellen — rating_token und rating_sent_at existieren bereits
-- auf customer_orders (Migration 022). Nur Indexes für Performance.

-- Index für "Lieferungen mit Token, noch kein Link gesendet"
CREATE INDEX IF NOT EXISTS idx_customer_orders_rating_pending
  ON customer_orders(status, rating_token)
  WHERE rating_sent_at IS NULL
    AND rating_token IS NOT NULL;

-- Index für die customer_notification_queue nach event_type (rating_request-Filter)
CREATE INDEX IF NOT EXISTS idx_notification_queue_event_type
  ON customer_notification_queue(location_id, event_type, status);

COMMENT ON INDEX idx_customer_orders_rating_pending IS
  'Partial-Index für processPendingRatingLinks(): '
  'gelieferte Orders mit Token aber ohne gesendeten Link. '
  'Angelegt in Migration 050 (Phase 70).';
