-- ============================================================
-- Migration 034: Delivery Proof & Failed-Attempt Engine
-- Phase 40 — Proof of delivery + per-stop failed attempt tracking
-- ============================================================

-- ── delivery_proofs ──────────────────────────────────────────────────────────
-- Beweis-Foto oder Unterschrift bei erfolgreicher Lieferung
CREATE TABLE IF NOT EXISTS delivery_proofs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_stop_id  UUID    NOT NULL,   -- mise_delivery_batch_stops.id
  order_id      UUID,               -- customer_orders.id
  batch_id      UUID,               -- mise_delivery_batches.id
  location_id   UUID    NOT NULL,
  proof_type    TEXT    NOT NULL
    CHECK (proof_type IN ('photo','left_at_door','neighbour','handed_to_person','contactless')),
  photo_url     TEXT,               -- Supabase Storage URL (nullable)
  notes         TEXT    CHECK (char_length(notes) <= 500),
  driver_lat    DOUBLE PRECISION,
  driver_lng    DOUBLE PRECISION,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── delivery_failed_attempts ─────────────────────────────────────────────────
-- Fehlgeschlagene Zustellversuche mit Grund und optionalem Retry-Plan
CREATE TABLE IF NOT EXISTS delivery_failed_attempts (
  id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_stop_id   UUID,               -- mise_delivery_batch_stops.id (optional)
  order_id       UUID     NOT NULL,  -- customer_orders.id
  batch_id       UUID,               -- mise_delivery_batches.id
  location_id    UUID     NOT NULL,
  driver_id      UUID,               -- mise_drivers.id
  reason         TEXT     NOT NULL
    CHECK (reason IN ('no_answer','wrong_address','refused','access_denied','not_home','other')),
  attempt_number SMALLINT NOT NULL DEFAULT 1,
  photo_url      TEXT,               -- Foto der Tür/Adresse als Nachweis
  notes          TEXT     CHECK (char_length(notes) <= 500),
  driver_lat     DOUBLE PRECISION,
  driver_lng     DOUBLE PRECISION,
  -- Resolution
  next_attempt_at TIMESTAMPTZ,       -- wann erneuter Versuch geplant
  resolved_at     TIMESTAMPTZ,
  resolution      TEXT
    CHECK (resolution IN ('delivered','returned_to_restaurant','cancelled','rescheduled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_order
  ON delivery_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_stop
  ON delivery_proofs(tour_stop_id);
CREATE INDEX IF NOT EXISTS idx_delivery_proofs_location_time
  ON delivery_proofs(location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_failed_attempts_order
  ON delivery_failed_attempts(order_id);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_pending
  ON delivery_failed_attempts(location_id, resolved_at)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_failed_attempts_next
  ON delivery_failed_attempts(next_attempt_at)
  WHERE resolved_at IS NULL AND next_attempt_at IS NOT NULL;

-- ── View: offene fehlgeschlagene Zustellversuche ─────────────────────────────
CREATE OR REPLACE VIEW v_pending_failed_attempts AS
SELECT
  fa.id,
  fa.order_id,
  fa.batch_id,
  fa.location_id,
  fa.driver_id,
  fa.reason,
  fa.attempt_number,
  fa.photo_url,
  fa.notes,
  fa.next_attempt_at,
  fa.created_at,
  co.bestellnummer,
  co.kunde_name,
  co.kunde_adresse,
  co.kunde_plz,
  co.kunde_stadt,
  co.kunde_telefon,
  co.gesamtbetrag,
  co.status        AS order_status,
  e.name           AS driver_name,
  md.vehicle       AS driver_vehicle
FROM delivery_failed_attempts fa
LEFT JOIN customer_orders      co ON co.id  = fa.order_id
LEFT JOIN mise_drivers         md ON md.id  = fa.driver_id
LEFT JOIN employees             e ON e.id   = md.employee_id
WHERE fa.resolved_at IS NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE delivery_proofs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_failed_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- delivery_proofs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'delivery_proofs' AND policyname = 'service_role_all_proofs'
  ) THEN
    CREATE POLICY service_role_all_proofs ON delivery_proofs
      FOR ALL TO service_role USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'delivery_proofs' AND policyname = 'authenticated_select_proofs'
  ) THEN
    CREATE POLICY authenticated_select_proofs ON delivery_proofs
      FOR SELECT TO authenticated USING (
        location_id IN (
          SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
        )
      );
  END IF;

  -- delivery_failed_attempts
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'delivery_failed_attempts' AND policyname = 'service_role_all_failed'
  ) THEN
    CREATE POLICY service_role_all_failed ON delivery_failed_attempts
      FOR ALL TO service_role USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'delivery_failed_attempts' AND policyname = 'authenticated_select_failed'
  ) THEN
    CREATE POLICY authenticated_select_failed ON delivery_failed_attempts
      FOR SELECT TO authenticated USING (
        location_id IN (
          SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;
