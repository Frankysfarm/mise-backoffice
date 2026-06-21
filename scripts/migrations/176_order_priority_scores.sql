-- Migration 176: Order Priority Scores — persistierbare KI-Prioritätsscores
-- Phase 362: Backend-seitige Persistierung statt Client-Side-Berechnung

CREATE TABLE IF NOT EXISTS order_priority_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id        UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  scored_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Score 0–100 (höher = dringlicher)
  priority_score  NUMERIC(5,2) NOT NULL CHECK (priority_score BETWEEN 0 AND 100),

  -- Score-Breakdown (je 0–40/25/12/15/20/50)
  pts_priority    NUMERIC(5,2) NOT NULL DEFAULT 0,  -- Bestellpriorität (express/vip/rush/normal)
  pts_status      NUMERIC(5,2) NOT NULL DEFAULT 0,  -- Küchenstatus (fertig/in_zubereitung/neu)
  pts_zone        NUMERIC(5,2) NOT NULL DEFAULT 0,  -- Zonen-Dringlichkeit (D > C > B > A)
  pts_wait        NUMERIC(5,2) NOT NULL DEFAULT 0,  -- Wartezeit-Malus
  pts_escalation  NUMERIC(5,2) NOT NULL DEFAULT 0,  -- Eskalations-Bonus
  pts_boost       NUMERIC(5,2) NOT NULL DEFAULT 0,  -- Admin-manueller Boost

  -- Kontext zum Zeitpunkt des Scorings
  order_status    TEXT,
  order_priority  TEXT,
  delivery_zone   TEXT,
  wait_minutes    NUMERIC(6,1),
  dispatch_attempts SMALLINT,
  was_escalated   BOOLEAN NOT NULL DEFAULT false,

  -- Disposition (wurde dispatched, gehalten, eskaliert?)
  dispatch_outcome TEXT CHECK (dispatch_outcome IN ('dispatched','held','escalated','cancelled')) DEFAULT NULL,
  outcome_at       TIMESTAMPTZ DEFAULT NULL,

  UNIQUE (order_id, scored_at)
);

CREATE INDEX IF NOT EXISTS idx_ops_location_scored ON order_priority_scores(location_id, scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_order_id ON order_priority_scores(order_id);

-- RLS
ALTER TABLE order_priority_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_ops" ON order_priority_scores
  USING (location_id IN (
    SELECT l.id FROM locations l
    JOIN employees e ON e.tenant_id = l.tenant_id
    WHERE e.auth_user_id = auth.uid()
  ));

-- Prune-Funktion (>90 Tage)
CREATE OR REPLACE FUNCTION prune_order_priority_scores(days_old INT DEFAULT 90)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE deleted INT;
BEGIN
  DELETE FROM order_priority_scores
  WHERE scored_at < NOW() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
