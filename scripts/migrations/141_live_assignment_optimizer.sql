-- ============================================================
-- Migration 141: Live Order Assignment Optimizer
-- Phase 276 — Echtzeit-Zuweisung mit Return-Prediction-Integration
--
-- Tabellen:
--   assignment_suggestions  — KI-generierte Zuweisung-Vorschläge
--
-- Views:
--   v_assignment_suggestions_active   — aktive Vorschläge mit Fahrer-Details
--   v_assignment_optimizer_summary    — Zusammenfassung pro Location
--
-- RPCs:
--   expire_old_assignment_suggestions(p_hours)  — Cleanup abgelaufener Vorschläge
-- ============================================================

-- ── Haupt-Tabelle ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assignment_suggestions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id           uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id              uuid NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  driver_id             uuid NOT NULL REFERENCES mise_drivers(id) ON DELETE CASCADE,

  -- Typ: immediate = Fahrer verfügbar jetzt | pre_assign = kehrt bald zurück | standby = Reserve
  suggestion_type       text NOT NULL CHECK (suggestion_type IN ('immediate', 'pre_assign', 'standby')),

  -- Score 0–100 (höher = besser passend)
  score                 numeric(5,2) NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),

  -- Status-Maschine
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'dismissed', 'expired', 'auto_dispatched')),

  -- Return-Prediction-Kontext (wenn pre_assign)
  predicted_return_utc  timestamptz,
  minutes_until_return  integer,
  return_confidence     numeric(3,2),

  -- Begründung (z.B. "Nächster freier Fahrer, 1.4 km, kehrt in 8 Min zurück")
  reason                text,

  -- Distanz zum Kunden (km)
  distance_km           numeric(6,2),

  -- Fahrzeugtyp des Fahrers
  vehicle               text CHECK (vehicle IN ('bike', 'car')),

  -- Zeitstempel
  created_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  resolved_at           timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- De-Duplikation: pro Bestellung+Fahrer nur ein aktiver Vorschlag
  UNIQUE (order_id, driver_id)
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_assignment_suggestions_location
  ON assignment_suggestions (location_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_suggestions_order
  ON assignment_suggestions (order_id, status);

CREATE INDEX IF NOT EXISTS idx_assignment_suggestions_driver
  ON assignment_suggestions (driver_id, status);

CREATE INDEX IF NOT EXISTS idx_assignment_suggestions_expires
  ON assignment_suggestions (expires_at) WHERE status = 'pending';

-- RLS
ALTER TABLE assignment_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignment_suggestions: service_role full access"
  ON assignment_suggestions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- updated_at Trigger
CREATE OR REPLACE FUNCTION _trg_assignment_suggestions_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_assignment_suggestions_updated_at ON assignment_suggestions;
CREATE TRIGGER trg_assignment_suggestions_updated_at
  BEFORE UPDATE ON assignment_suggestions
  FOR EACH ROW EXECUTE FUNCTION _trg_assignment_suggestions_updated_at();

-- ── Views ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_assignment_suggestions_active AS
SELECT
  s.id,
  s.location_id,
  s.order_id,
  s.driver_id,
  s.suggestion_type,
  s.score,
  s.status,
  s.predicted_return_utc,
  s.minutes_until_return,
  s.return_confidence,
  s.reason,
  s.distance_km,
  s.vehicle,
  s.created_at,
  s.expires_at,
  -- Bestellungs-Details
  o.bestellnummer,
  o.kunde_adresse,
  o.kunde_plz,
  o.kunde_stadt,
  o.gesamtbetrag,
  o.priority,
  o.bestellt_am,
  -- Fahrer-Details
  d.name AS driver_name,
  d.state AS driver_state,
  d.current_capacity,
  d.max_capacity
FROM assignment_suggestions s
JOIN customer_orders o ON o.id = s.order_id
JOIN mise_drivers d     ON d.id = s.driver_id
WHERE s.status = 'pending'
  AND s.expires_at > now()
ORDER BY s.score DESC, s.created_at DESC;

-- Zusammenfassung pro Location
CREATE OR REPLACE VIEW v_assignment_optimizer_summary AS
SELECT
  location_id,
  COUNT(*) FILTER (WHERE status = 'pending' AND expires_at > now())          AS pending_count,
  COUNT(*) FILTER (WHERE status = 'accepted')                                 AS accepted_count,
  COUNT(*) FILTER (WHERE status = 'auto_dispatched')                          AS auto_dispatched_count,
  COUNT(*) FILTER (WHERE status = 'dismissed')                                AS dismissed_count,
  COUNT(*) FILTER (WHERE status = 'expired')                                  AS expired_count,
  COUNT(*) FILTER (WHERE suggestion_type = 'immediate' AND status = 'pending'
                     AND expires_at > now())                                   AS immediate_count,
  COUNT(*) FILTER (WHERE suggestion_type = 'pre_assign' AND status = 'pending'
                     AND expires_at > now())                                   AS pre_assign_count,
  ROUND(AVG(score) FILTER (WHERE status IN ('accepted','auto_dispatched')), 1) AS avg_accepted_score,
  MAX(created_at)                                                              AS last_generated_at
FROM assignment_suggestions
WHERE created_at >= now() - interval '24 hours'
GROUP BY location_id;

-- ── RPC ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION expire_old_assignment_suggestions(p_hours integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE assignment_suggestions
  SET status = 'expired', resolved_at = now()
  WHERE status = 'pending'
    AND expires_at < now() - make_interval(hours => p_hours);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
