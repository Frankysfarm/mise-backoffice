-- Migration 190: schicht_targets + order_pulse_snapshots
-- Phase 398 Backend — Schicht-Live-Engine + Order-Pulse-Tracker
--
-- schicht_targets: per-location per-day-of-week revenue/delivery targets
-- order_pulse_snapshots: 15-min order velocity buckets (retention 7d)

-- ── schicht_targets ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schicht_targets (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id       UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week       SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  -- 0=Sonntag, 1=Montag, ..., 6=Samstag (ISO-Woche: 1=Mo, 7=So)
  umsatz_ziel       NUMERIC(10,2) NOT NULL DEFAULT 800,
  lieferungen_ziel  INT           NOT NULL DEFAULT 40,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT schicht_targets_location_dow_uq UNIQUE (location_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS schicht_targets_location_idx ON schicht_targets (location_id);

-- updated_at-Trigger
CREATE OR REPLACE FUNCTION update_schicht_targets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schicht_targets_updated_at_trg ON schicht_targets;
CREATE TRIGGER schicht_targets_updated_at_trg
  BEFORE UPDATE ON schicht_targets
  FOR EACH ROW EXECUTE FUNCTION update_schicht_targets_updated_at();

-- RLS
ALTER TABLE schicht_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY schicht_targets_service_all ON schicht_targets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY schicht_targets_authenticated_read ON schicht_targets
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY schicht_targets_authenticated_write ON schicht_targets
  FOR ALL TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees
      WHERE auth_user_id = auth.uid()
        AND rolle IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    location_id IN (
      SELECT location_id FROM employees
      WHERE auth_user_id = auth.uid()
        AND rolle IN ('admin', 'manager')
    )
  );

-- ── order_pulse_snapshots ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_pulse_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  bucket_start    TIMESTAMPTZ NOT NULL,           -- start of 15-min bucket (UTC)
  order_count     INT         NOT NULL DEFAULT 0, -- orders arriving in this bucket
  revenue_eur     NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_count  INT         NOT NULL DEFAULT 0,
  avg_order_eur   NUMERIC(10,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT order_pulse_location_bucket_uq UNIQUE (location_id, bucket_start)
);

CREATE INDEX IF NOT EXISTS order_pulse_location_bucket_idx
  ON order_pulse_snapshots (location_id, bucket_start DESC);

-- RLS
ALTER TABLE order_pulse_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_pulse_service_all ON order_pulse_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY order_pulse_authenticated_read ON order_pulse_snapshots
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

-- Prune-Funktion: behält nur die letzten N Tage
CREATE OR REPLACE FUNCTION prune_order_pulse_snapshots(days_to_keep INT DEFAULT 7)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM order_pulse_snapshots
  WHERE bucket_start < (now() - (days_to_keep || ' days')::INTERVAL);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
