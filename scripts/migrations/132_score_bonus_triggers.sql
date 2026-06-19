-- Migration 132: Driver Score Bonus Triggers
-- Automatische Bonus-Freischaltung wenn Fahrer-Score eine konfigurierte Schwelle überschreitet.
-- Verknüpft driver_composite_scores (Phase 205) mit dem Bonus-System (Phase 158).

-- ── Trigger-Konfiguration ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_score_bonus_triggers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid        NOT NULL,
  label           text        NOT NULL,
  score_threshold smallint    NOT NULL CHECK (score_threshold BETWEEN 1 AND 100),
  bonus_type      text        NOT NULL DEFAULT 'flat_eur'
                              CHECK (bonus_type IN ('flat_eur', 'provision_pct')),
  bonus_value     numeric(10,2) NOT NULL CHECK (bonus_value > 0),
  -- flat_eur: fester Bonus-Betrag in Euro
  -- provision_pct: Prozent-Aufschlag auf den Wochen-Umsatz des Fahrers
  period          text        NOT NULL DEFAULT 'week'
                              CHECK (period IN ('week', 'month')),
  score_period    text        NOT NULL DEFAULT 'week'
                              CHECK (score_period IN ('week', 'month')),
  enabled         boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, score_threshold, bonus_type, period)
);

CREATE INDEX IF NOT EXISTS idx_score_triggers_location
  ON driver_score_bonus_triggers (location_id)
  WHERE enabled = true;

ALTER TABLE driver_score_bonus_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "score_triggers_authenticated"
  ON driver_score_bonus_triggers
  FOR ALL
  USING (auth.role() = 'authenticated');

-- ── Bonus-Grants (ausgelöste Boni) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_score_bonus_grants (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid        NOT NULL,
  driver_id       uuid        NOT NULL,
  driver_name     text,
  trigger_id      uuid        NOT NULL REFERENCES driver_score_bonus_triggers(id) ON DELETE CASCADE,
  period_start    date        NOT NULL,   -- Wochenbeginn oder Monatsbeginn (ISO Montag)
  composite_score smallint    NOT NULL,
  bonus_type      text        NOT NULL,
  bonus_value     numeric(10,2) NOT NULL,
  -- Für provision_pct: berechneter Euro-Betrag (gesetzt beim Approve)
  resolved_eur    numeric(10,2),
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  auto_triggered  boolean     NOT NULL DEFAULT true,
  notes           text,
  evaluated_at    timestamptz NOT NULL DEFAULT now(),
  approved_at     timestamptz,
  paid_at         timestamptz,
  UNIQUE (driver_id, trigger_id, period_start)  -- 1 Grant pro Fahrer+Trigger+Periode
);

-- Aktive (pending/approved) Grants schnell abrufbar
CREATE INDEX IF NOT EXISTS idx_score_grants_location_active
  ON driver_score_bonus_grants (location_id, evaluated_at DESC)
  WHERE status IN ('pending', 'approved');

-- Cleanup alter Grants
CREATE INDEX IF NOT EXISTS idx_score_grants_period
  ON driver_score_bonus_grants (location_id, period_start DESC);

ALTER TABLE driver_score_bonus_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "score_grants_authenticated"
  ON driver_score_bonus_grants
  FOR ALL
  USING (auth.role() = 'authenticated');

-- ── Updated-At Trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_score_triggers_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_score_triggers_updated_at ON driver_score_bonus_triggers;
CREATE TRIGGER trg_score_triggers_updated_at
  BEFORE UPDATE ON driver_score_bonus_triggers
  FOR EACH ROW EXECUTE FUNCTION update_score_triggers_updated_at();

-- ── Hilfsfunktion: alter Grants bereinigen ────────────────────────────────────

CREATE OR REPLACE FUNCTION prune_old_score_grants(p_days integer DEFAULT 90)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM driver_score_bonus_grants
  WHERE status IN ('paid', 'cancelled')
    AND evaluated_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ── View: Grant-Übersicht mit Trigger-Details ─────────────────────────────────

CREATE OR REPLACE VIEW v_score_bonus_grants AS
SELECT
  g.id,
  g.location_id,
  g.driver_id,
  g.driver_name,
  g.trigger_id,
  t.label         AS trigger_label,
  t.score_threshold,
  g.period_start,
  g.composite_score,
  g.bonus_type,
  g.bonus_value,
  g.resolved_eur,
  g.status,
  g.auto_triggered,
  g.notes,
  g.evaluated_at,
  g.approved_at,
  g.paid_at
FROM driver_score_bonus_grants g
JOIN driver_score_bonus_triggers t ON t.id = g.trigger_id;

COMMENT ON TABLE driver_score_bonus_triggers IS
  'Konfigurierbare Score-Schwellen: Fahrer-Bonus wird automatisch ausgelöst wenn composite_score ≥ score_threshold.';

COMMENT ON TABLE driver_score_bonus_grants IS
  'Ausgelöste Score-Boni: ein Eintrag pro Fahrer×Trigger×Periode (idempotent).';
