-- Migration 022: Customer Satisfaction Tracking
-- Kunden können nach Lieferung eine Bewertung abgeben (1–5 Sterne).
-- Bewertungen fließen in das Fahrer-Rating (mise_drivers.rating) ein.
-- Öffentlicher Rating-Link: einmaliger Token pro Bestellung.

-- ─── Ratings-Tabelle ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_delivery_ratings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  batch_id        UUID REFERENCES mise_delivery_batches(id) ON DELETE SET NULL,
  driver_id       UUID REFERENCES mise_drivers(id) ON DELETE SET NULL,
  location_id     UUID NOT NULL,   -- Multi-Tenant-Filter
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  rating_token    TEXT UNIQUE,     -- einmaliger Hash-Token im Link
  token_used_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token-Index für schnelles Lookup beim Kunden-Link
CREATE UNIQUE INDEX IF NOT EXISTS idx_cdr_token
  ON customer_delivery_ratings (rating_token)
  WHERE rating_token IS NOT NULL;

-- Order-Index: max. 1 Rating pro Bestellung (Unique Constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cdr_order_unique
  ON customer_delivery_ratings (order_id);

-- Fahrer-Index für Aggregationen
CREATE INDEX IF NOT EXISTS idx_cdr_driver_location
  ON customer_delivery_ratings (driver_id, location_id, created_at DESC);

-- ─── Rating-Token-Spalte auf customer_orders ────────────────────────────────
-- Speichert den Token, der nach Lieferung an den Kunden gesendet wird.
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS rating_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS rating_sent_at TIMESTAMPTZ;

-- ─── View: Fahrer-Zufriedenheits-Übersicht ──────────────────────────────────
CREATE OR REPLACE VIEW v_driver_satisfaction AS
SELECT
  dr.id                                        AS driver_id,
  dr.name                                      AS driver_name,
  COUNT(r.id)                                  AS total_ratings,
  ROUND(AVG(r.rating)::NUMERIC, 2)             AS avg_rating,
  COUNT(*) FILTER (WHERE r.rating >= 4)        AS positive_ratings,
  COUNT(*) FILTER (WHERE r.rating <= 2)        AS negative_ratings,
  COUNT(*) FILTER (WHERE r.rating = 5)         AS five_star_count,
  COUNT(*) FILTER (WHERE r.rating = 1)         AS one_star_count,
  MAX(r.created_at)                            AS last_rating_at
FROM mise_drivers dr
LEFT JOIN customer_delivery_ratings r ON r.driver_id = dr.id
GROUP BY dr.id, dr.name;

-- ─── View: Standort-Zufriedenheits-Zusammenfassung ──────────────────────────
CREATE OR REPLACE VIEW v_location_satisfaction AS
SELECT
  location_id,
  DATE_TRUNC('day', created_at)                AS rating_day,
  COUNT(id)                                    AS total_ratings,
  ROUND(AVG(rating)::NUMERIC, 2)               AS avg_rating,
  COUNT(*) FILTER (WHERE rating >= 4)          AS positive_count,
  COUNT(*) FILTER (WHERE rating <= 2)          AS negative_count,
  COUNT(*) FILTER (WHERE comment IS NOT NULL)  AS with_comment
FROM customer_delivery_ratings
GROUP BY location_id, DATE_TRUNC('day', created_at);

-- ─── Funktion: Fahrer-Rating nach Kunden-Bewertung neu berechnen ─────────────
-- Kombiniert delivery_performance (ETA-Genauigkeit) und customer-Ratings.
CREATE OR REPLACE FUNCTION recompute_driver_rating_with_satisfaction(p_driver_id UUID)
RETURNS VOID AS $$
DECLARE
  v_perf_rating   NUMERIC;
  v_cust_rating   NUMERIC;
  v_final_rating  NUMERIC;
  v_avg_min       NUMERIC;
  v_perf_count    INT;
  v_cust_count    INT;
BEGIN
  -- Leistungsbasiertes Rating (ETA-Genauigkeit) aus letzten 30 Lieferungen
  SELECT
    CASE
      WHEN COUNT(*) >= 3 THEN
        GREATEST(1.0, LEAST(5.0,
          5.0 - (
            COUNT(*) FILTER (WHERE NOT on_time)::NUMERIC / NULLIF(COUNT(*), 0)
          ) * 4.0
        ))
      ELSE NULL
    END,
    AVG(delivery_min),
    COUNT(*)
  INTO v_perf_rating, v_avg_min, v_perf_count
  FROM delivery_performance
  WHERE driver_id = p_driver_id
    AND recorded_at > NOW() - INTERVAL '30 days'
  LIMIT 30;

  -- Kunden-Rating (letzte 20 Bewertungen)
  SELECT
    AVG(rating::NUMERIC),
    COUNT(*)
  INTO v_cust_rating, v_cust_count
  FROM customer_delivery_ratings
  WHERE driver_id = p_driver_id
    AND created_at > NOW() - INTERVAL '30 days'
  LIMIT 20;

  -- Gewichtete Kombination (60% ETA-Performance, 40% Kunden-Rating)
  v_final_rating :=
    CASE
      WHEN v_perf_rating IS NOT NULL AND v_cust_rating IS NOT NULL THEN
        ROUND((v_perf_rating * 0.6 + v_cust_rating * 0.4)::NUMERIC, 2)
      WHEN v_perf_rating IS NOT NULL THEN
        ROUND(v_perf_rating::NUMERIC, 2)
      WHEN v_cust_rating IS NOT NULL THEN
        ROUND(v_cust_rating::NUMERIC, 2)
      ELSE 4.5  -- Default bis genug Daten vorhanden
    END;

  UPDATE mise_drivers
  SET
    rating          = v_final_rating,
    avg_delivery_min = COALESCE(v_avg_min, avg_delivery_min)
  WHERE id = p_driver_id;
END;
$$ LANGUAGE plpgsql;

-- ─── Trigger: Auto-Recompute nach neuer Kunden-Bewertung ────────────────────
CREATE OR REPLACE FUNCTION trg_recompute_rating_on_customer_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.driver_id IS NOT NULL THEN
    PERFORM recompute_driver_rating_with_satisfaction(NEW.driver_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cdr_recompute ON customer_delivery_ratings;
CREATE TRIGGER trg_cdr_recompute
  AFTER INSERT ON customer_delivery_ratings
  FOR EACH ROW
  EXECUTE FUNCTION trg_recompute_rating_on_customer_rate();
