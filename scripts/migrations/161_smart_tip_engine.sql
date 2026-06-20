-- ============================================================
-- Migration 161 — Smart Tip Engine + Geofence Auto-Hours
-- Phase 338
-- ============================================================

-- ── Smart Tip Config ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS smart_tip_config (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          text NOT NULL UNIQUE,
  is_enabled           boolean NOT NULL DEFAULT true,
  base_pct             numeric(5,2) NOT NULL DEFAULT 15,
  boost_pct_punctual   numeric(5,2) NOT NULL DEFAULT 5,
  penalty_pct_late     numeric(5,2) NOT NULL DEFAULT 5,
  driver_score_boost   boolean NOT NULL DEFAULT true,
  min_suggestion_eur   numeric(6,2) NOT NULL DEFAULT 0.50,
  max_suggestion_eur   numeric(6,2) NOT NULL DEFAULT 10.00,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ── Smart Tip Suggestions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS smart_tip_suggestions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL UNIQUE,
  location_id           text NOT NULL,
  suggested_low_eur     numeric(6,2) NOT NULL,
  suggested_mid_eur     numeric(6,2) NOT NULL,
  suggested_high_eur    numeric(6,2) NOT NULL,
  order_value_eur       numeric(8,2),
  driver_score          numeric(5,1),
  delivery_min          numeric(6,1),
  eta_min               numeric(6,1),
  punctuality_delta_min numeric(6,1),
  reason                text,
  shown_at              timestamptz NOT NULL DEFAULT now(),
  actual_tip_eur        numeric(6,2),
  tip_chosen_at         timestamptz
);

CREATE INDEX IF NOT EXISTS smart_tip_suggestions_location_idx
  ON smart_tip_suggestions (location_id, shown_at DESC);
CREATE INDEX IF NOT EXISTS smart_tip_suggestions_order_idx
  ON smart_tip_suggestions (order_id);

-- ── Geofence Auto-Hours Config ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geofence_auto_hours_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         text NOT NULL UNIQUE,
  is_enabled          boolean NOT NULL DEFAULT false,
  min_drivers_to_open int NOT NULL DEFAULT 2,
  auto_open_enabled   boolean NOT NULL DEFAULT true,
  auto_close_enabled  boolean NOT NULL DEFAULT true,
  grace_period_min    int NOT NULL DEFAULT 5,
  open_message_de     text DEFAULT 'Lieferung wieder verfügbar',
  close_message_de    text DEFAULT 'Lieferung kurz pausiert – bald wieder verfügbar',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Geofence Auto-Hours Log ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geofence_auto_hours_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     text NOT NULL,
  action          text NOT NULL CHECK (action IN ('opened', 'closed', 'no_change')),
  drivers_online  int NOT NULL,
  triggered_by    text NOT NULL DEFAULT 'cron',
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS geofence_auto_hours_log_location_idx
  ON geofence_auto_hours_log (location_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE smart_tip_config            ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_tip_suggestions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_auto_hours_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_auto_hours_log     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='smart_tip_config' AND policyname='service role full access'
  ) THEN
    CREATE POLICY "service role full access" ON smart_tip_config
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='smart_tip_suggestions' AND policyname='service role full access'
  ) THEN
    CREATE POLICY "service role full access" ON smart_tip_suggestions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='geofence_auto_hours_config' AND policyname='service role full access'
  ) THEN
    CREATE POLICY "service role full access" ON geofence_auto_hours_config
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='geofence_auto_hours_log' AND policyname='service role full access'
  ) THEN
    CREATE POLICY "service role full access" ON geofence_auto_hours_log
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Prune-RPCs ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_smart_tip_suggestions(older_than_days int DEFAULT 90)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM smart_tip_suggestions
  WHERE shown_at < now() - (older_than_days || ' days')::interval;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

CREATE OR REPLACE FUNCTION prune_geofence_auto_hours_log(older_than_days int DEFAULT 30)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted int;
BEGIN
  DELETE FROM geofence_auto_hours_log
  WHERE created_at < now() - (older_than_days || ' days')::interval;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
