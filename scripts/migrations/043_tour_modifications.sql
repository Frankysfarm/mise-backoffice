-- Migration 043: Live-Tour-Modifikation Audit Trail
-- Phase 52: Protokolliert alle Änderungen an aktiven Touren (Stop-Insert, Stop-Remove, Reoptimierung)

-- ── Modifikations-Audit-Log ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tour_modifications (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          uuid        NOT NULL,
  batch_id             uuid        NOT NULL REFERENCES mise_delivery_batches(id) ON DELETE CASCADE,
  modification_type    text        NOT NULL, -- 'stop_inserted' | 'stop_removed' | 'reoptimized'
  order_id             text,                 -- betroffene Bestellung (nullable bei reoptimized)
  stop_id              uuid,                 -- betroffener Stop (nullable bei reoptimized)
  position_before      int,                  -- Sequenz vor Änderung
  position_after       int,                  -- Sequenz nach Änderung
  eta_before_min       int,                  -- Touren-ETA vor Änderung
  eta_after_min        int,                  -- Touren-ETA nach Änderung
  performed_by         text,                 -- Admin-User-ID oder 'system'
  reason               text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tour_modifications IS
  'Audit-Log für alle Live-Änderungen an aktiven Touren. '
  'Ermöglicht Nachvollziehbarkeit und spätere Analyse der operativen Entscheidungen.';

-- ── Felder auf mise_delivery_batches ─────────────────────────────────────────
ALTER TABLE mise_delivery_batches
  ADD COLUMN IF NOT EXISTS modification_count  int         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_modified_at    timestamptz;

-- ── View: offene Touren mit ihren offenen Stops ───────────────────────────────
CREATE OR REPLACE VIEW v_active_tours_open_stops AS
SELECT
  b.id                        AS batch_id,
  b.location_id,
  b.fahrer_id,
  b.state,
  b.stop_count,
  b.total_eta_min,
  b.modification_count,
  b.last_modified_at,
  s.id                        AS stop_id,
  s.order_id,
  s.type                      AS stop_type,
  s.sequence,
  s.lat,
  s.lng,
  s.address,
  s.completed_at IS NULL      AS is_open
FROM mise_delivery_batches b
JOIN mise_delivery_batch_stops s ON s.batch_id = b.id
WHERE b.state IN ('pending_acceptance', 'assigned', 'at_restaurant', 'on_route', 'en_route')
  AND s.completed_at IS NULL
ORDER BY b.id, s.sequence;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE tour_modifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_tour_modifications"
  ON tour_modifications FOR ALL TO service_role USING (true);

CREATE POLICY "authenticated_select_tour_modifications"
  ON tour_modifications FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT id FROM locations WHERE tenant_id = (
        SELECT raw_user_meta_data->>'tenant_id' FROM auth.users WHERE id = auth.uid()
      )
    )
  );

-- ── Hilfsfunktion: Modifikationszähler atomar inkrementieren ────────────────
CREATE OR REPLACE FUNCTION increment_batch_modification_count(p_batch_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE mise_delivery_batches
     SET modification_count = modification_count + 1
   WHERE id = p_batch_id;
$$;

-- ── Indizes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tour_modifications_batch    ON tour_modifications (batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tour_modifications_location ON tour_modifications (location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tour_modifications_order    ON tour_modifications (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_batches_last_modified       ON mise_delivery_batches (last_modified_at DESC) WHERE last_modified_at IS NOT NULL;
