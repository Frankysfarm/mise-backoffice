-- Phase 38: Surge Pricing + Driver Incentive Engine
-- Dynamischer Aufpreis bei hoher Nachfrage + automatische Fahrer-Boni
--
-- Tabellen:
--   delivery_surge_rules      — Konfigurierbare Surge-Regeln pro Location
--   delivery_surge_events     — Log aktiver Surge-Perioden
--   driver_surge_bonuses      — Bonus-Einträge pro Fahrer/Lieferung während Surge
--
-- Views:
--   v_surge_status            — Aktueller Surge-Status pro Location (Echtzeit)
--   v_driver_surge_earnings   — Bonus-Summe pro Fahrer (heute)

-- ── Surge Rules ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS delivery_surge_rules (
  id                           uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id                  uuid         NOT NULL,
  name                         text         NOT NULL DEFAULT 'Standard Surge',
  is_active                    boolean      DEFAULT true,
  -- Trigger: Mindest-Queue-Tiefe (offene Lieferbest. ohne Fahrer)
  min_queue_depth              int          DEFAULT 5,
  -- Trigger: Mindest-Bestellrate letzte 30 Min (hochgerechnet auf /h)
  min_orders_per_hour          numeric(6,1) DEFAULT 8,
  -- Trigger: Min. % Fahrer ausgelastet (0–100)
  min_driver_utilization_pct   int          DEFAULT 70   CHECK (min_driver_utilization_pct BETWEEN 0 AND 100),
  -- Surge-Multiplikator auf Liefergebühr (1.0 = kein Surge)
  multiplier                   numeric(4,2) DEFAULT 1.25 CHECK (multiplier BETWEEN 1.0 AND 3.0),
  -- Fahrer-Bonus pro Lieferung während Surge
  driver_bonus_eur             numeric(5,2) DEFAULT 0.50 CHECK (driver_bonus_eur >= 0),
  -- Zeitfenster (UTC-Stunden)
  active_from_utc              int          DEFAULT 0    CHECK (active_from_utc BETWEEN 0 AND 23),
  active_until_utc             int          DEFAULT 23   CHECK (active_until_utc BETWEEN 0 AND 23),
  -- Wochentage (0=Mo … 6=So) — NULL = täglich
  active_weekdays              int[]        DEFAULT NULL,
  -- Auto-Deaktivierung nach N Minuten ohne weiteren Trigger
  auto_stop_after_min          int          DEFAULT 30,
  created_at                   timestamptz  DEFAULT now(),
  updated_at                   timestamptz  DEFAULT now(),
  UNIQUE (location_id, name)
);

-- FK (migration-safe)
DO $$ BEGIN
  ALTER TABLE delivery_surge_rules
    ADD CONSTRAINT fk_dsr_location
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN undefined_table  THEN NULL;
END $$;

-- ── Surge Events ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS delivery_surge_events (
  id                       uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id              uuid         NOT NULL,
  rule_id                  uuid,
  started_at               timestamptz  DEFAULT now() NOT NULL,
  ended_at                 timestamptz,
  -- Snapshot der Trigger-Werte bei Aktivierung
  trigger_queue_depth      int,
  trigger_orders_per_hour  numeric(6,1),
  trigger_utilization_pct  int,
  effective_multiplier     numeric(4,2) NOT NULL,
  driver_bonus_eur         numeric(5,2) DEFAULT 0,
  -- Aggregierte Ergebnisse (bei Ende befüllt)
  deliveries_during        int          DEFAULT 0,
  total_bonus_paid_eur     numeric(10,2) DEFAULT 0
);

DO $$ BEGIN
  ALTER TABLE delivery_surge_events
    ADD CONSTRAINT fk_dse_rule
    FOREIGN KEY (rule_id) REFERENCES delivery_surge_rules(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN undefined_table  THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_dse_location_active
  ON delivery_surge_events (location_id, started_at DESC)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dse_location_time
  ON delivery_surge_events (location_id, started_at DESC);

-- ── Driver Surge Bonuses ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_surge_bonuses (
  id              uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id       uuid         NOT NULL,
  location_id     uuid         NOT NULL,
  batch_id        uuid,
  order_id        uuid,
  surge_event_id  uuid,
  bonus_eur       numeric(5,2) NOT NULL CHECK (bonus_eur > 0),
  multiplier      numeric(4,2),
  created_at      timestamptz  DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE driver_surge_bonuses
    ADD CONSTRAINT fk_dsb_driver
    FOREIGN KEY (driver_id) REFERENCES mise_drivers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN undefined_table  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE driver_surge_bonuses
    ADD CONSTRAINT fk_dsb_surge_event
    FOREIGN KEY (surge_event_id) REFERENCES delivery_surge_events(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN undefined_table  THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_dsb_driver_time
  ON driver_surge_bonuses (driver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dsb_location_time
  ON driver_surge_bonuses (location_id, created_at DESC);

-- ── View: Aktueller Surge-Status ──────────────────────────────────────────────

CREATE OR REPLACE VIEW v_surge_status AS
SELECT
  r.id              AS rule_id,
  r.location_id,
  r.name,
  r.is_active,
  r.multiplier,
  r.driver_bonus_eur,
  r.min_queue_depth,
  r.min_orders_per_hour,
  r.min_driver_utilization_pct,
  r.active_from_utc,
  r.active_until_utc,
  r.auto_stop_after_min,
  -- Laufendes Surge-Event (falls aktiv)
  se.id             AS active_event_id,
  se.started_at     AS surge_started_at,
  se.effective_multiplier AS active_multiplier,
  -- Aktuelle Queue-Tiefe (offene Lieferbest. ohne Fahrer)
  COALESCE(q.queue_depth, 0)      AS current_queue_depth,
  COALESCE(q.orders_30min, 0)     AS orders_last_30min,
  COALESCE(q.orders_30min * 2.0, 0) AS orders_per_hour_est,
  -- Auslastung: % busy Fahrer
  COALESCE(d.busy_pct, 0)         AS driver_utilization_pct,
  -- Zeitfenster aktiv?
  (EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC')::int
     BETWEEN r.active_from_utc AND r.active_until_utc)  AS in_time_window,
  -- Surge sollte laut Regeln aktiv sein?
  (
    r.is_active
    AND COALESCE(q.queue_depth, 0) >= r.min_queue_depth
    AND COALESCE(q.orders_30min * 2.0, 0) >= r.min_orders_per_hour
    AND COALESCE(d.busy_pct, 0) >= r.min_driver_utilization_pct
    AND (EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC')::int BETWEEN r.active_from_utc AND r.active_until_utc)
  )                               AS conditions_met
FROM delivery_surge_rules r
LEFT JOIN (
  SELECT
    location_id,
    COUNT(*) FILTER (
      WHERE mise_batch_id IS NULL
        AND typ = 'lieferung'
        AND status NOT IN ('storniert', 'abgeholt', 'geliefert', 'rejected')
    ) AS queue_depth,
    COUNT(*) FILTER (
      WHERE erstellt_am > now() - INTERVAL '30 minutes'
    ) AS orders_30min
  FROM customer_orders
  GROUP BY location_id
) q ON q.location_id = r.location_id
LEFT JOIN (
  SELECT
    -- Fahrer-Auslastung: busy = aktueller Batch vorhanden + state nicht frei
    md.location_id,
    CASE WHEN COUNT(*) = 0 THEN 0
         ELSE ROUND(
           100.0 * COUNT(*) FILTER (WHERE md.aktueller_batch_id IS NOT NULL) / COUNT(*)
         )
    END AS busy_pct
  FROM mise_drivers md
  WHERE md.state = 'online'
  GROUP BY md.location_id
) d ON d.location_id = r.location_id
LEFT JOIN delivery_surge_events se
  ON se.location_id = r.location_id
  AND se.ended_at IS NULL
;

-- ── View: Bonus-Summe pro Fahrer (heute) ──────────────────────────────────────

CREATE OR REPLACE VIEW v_driver_surge_earnings AS
SELECT
  dsb.driver_id,
  dsb.location_id,
  SUM(dsb.bonus_eur)                            AS total_bonus_today_eur,
  COUNT(*)                                      AS bonus_deliveries,
  MAX(dsb.created_at)                           AS last_bonus_at,
  COALESCE(e.vorname || ' ' || e.nachname, 'Unbekannt') AS driver_name,
  md.vehicle
FROM driver_surge_bonuses dsb
LEFT JOIN mise_drivers md   ON md.id = dsb.driver_id
LEFT JOIN employees    e    ON e.id  = md.employee_id
WHERE dsb.created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Berlin' AT TIME ZONE 'UTC')
GROUP BY dsb.driver_id, dsb.location_id, e.vorname, e.nachname, md.vehicle
;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE delivery_surge_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_surge_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_surge_bonuses  ENABLE ROW LEVEL SECURITY;

-- Service-Role: vollen Zugriff
CREATE POLICY "dsr_service_all" ON delivery_surge_rules
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "dse_service_all" ON delivery_surge_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "dsb_service_all" ON driver_surge_bonuses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated Employees: Lesen (tenant-gefiltert via employees.location_id)
CREATE POLICY "dsr_auth_read" ON delivery_surge_rules
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "dse_auth_read" ON delivery_surge_events
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "dsb_auth_read" ON driver_surge_bonuses
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
    )
  );
