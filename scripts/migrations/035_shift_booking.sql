-- Migration 035: Fahrer Self-Service Schichtbuchung
--
-- Fahrer können sich über die Fahrer-App für offene Schicht-Slots anmelden.
-- Admin genehmigt die Anmeldung → automatisches driver_shifts INSERT.
--
-- Tabellen  : shift_claims
-- Indizes   : location+start, driver+status, pending partial-index
-- RLS       : service_role ALL, authenticated darf eigene Claims lesen

-- ============================================================
-- shift_claims
-- ============================================================
CREATE TABLE IF NOT EXISTS shift_claims (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id      UUID        NOT NULL REFERENCES locations(id)   ON DELETE CASCADE,
  driver_id        UUID        NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,
  planned_start    TIMESTAMPTZ NOT NULL,
  planned_end      TIMESTAMPTZ NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  notes            TEXT,
  rejection_reason TEXT,
  reviewed_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT shift_claim_end_after_start CHECK (planned_end > planned_start),
  -- Fahrer darf sich nur einmal pro Start-Zeit anmelden
  CONSTRAINT shift_claim_no_duplicate    UNIQUE (driver_id, planned_start)
);

COMMENT ON TABLE shift_claims IS
  'Fahrer-Schicht-Anmeldungen (Self-Service). '
  'status: pending=wartet auf Prüfung, approved=genehmigt+Schicht angelegt, '
  'rejected=abgelehnt (rejection_reason), cancelled=Fahrer zurückgezogen.';

-- ============================================================
-- Indizes
-- ============================================================

-- Admin: offene Anmeldungen einer Location nach Datum
CREATE INDEX IF NOT EXISTS idx_shift_claims_location_start
  ON shift_claims (location_id, planned_start);

-- Fahrer: eigene Anmeldungen nach Status
CREATE INDEX IF NOT EXISTS idx_shift_claims_driver_status
  ON shift_claims (driver_id, status);

-- Partial-Index: nur pendende Anmeldungen (häufigste Admin-Query)
CREATE INDEX IF NOT EXISTS idx_shift_claims_pending
  ON shift_claims (location_id, planned_start)
  WHERE status = 'pending';

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE shift_claims ENABLE ROW LEVEL SECURITY;

-- Service-Role: alles erlaubt (Cron, API)
CREATE POLICY shift_claims_service_all
  ON shift_claims FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated Fahrer: nur eigene Claims lesen
CREATE POLICY shift_claims_driver_read
  ON shift_claims FOR SELECT
  TO authenticated
  USING (
    driver_id IN (
      SELECT id FROM mise_drivers WHERE auth_user_id = auth.uid()
    )
  );
