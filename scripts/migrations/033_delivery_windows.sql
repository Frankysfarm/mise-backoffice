-- Migration 033: Delivery Time Window Booking
-- Kunden können konkrete 30-Minuten-Lieferfenster vorbuchen.
-- Operations plant Dispatch + Küche rund um gebuchte Fenster.
-- Baut auf Migration 024 (scheduled_orders) auf.

-- ─────────────────────────────────────────────────────────────────────────────
-- delivery_time_slots: konfigurierbare Zeitfenster pro Location
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_time_slots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  day_of_week     smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
                  -- 0=Montag, 1=Dienstag, ..., 6=Sonntag (ISO-Wochentag - 1)
  slot_start_utc  time NOT NULL,   -- UTC-Uhrzeit Beginn (z.B. '16:30')
  slot_end_utc    time NOT NULL,   -- UTC-Uhrzeit Ende   (z.B. '17:00')
  capacity        int NOT NULL DEFAULT 10 CHECK (capacity > 0),
  is_active       boolean NOT NULL DEFAULT true,
  slot_type       text NOT NULL DEFAULT 'standard'
                    CHECK (slot_type IN ('standard', 'express', 'scheduled')),
  extra_fee_eur   numeric(8,2) NOT NULL DEFAULT 0.00 CHECK (extra_fee_eur >= 0),
  label           text,           -- optionaler Anzeigename, z.B. "Abend-Fenster"
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, day_of_week, slot_start_utc)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- delivery_window_bookings: Buchung Bestellung → Slot
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_window_bookings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                uuid NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  slot_id                 uuid NOT NULL REFERENCES delivery_time_slots(id) ON DELETE RESTRICT,
  location_id             uuid NOT NULL,
  -- Konkrete UTC-Datetimes für den Buchungstag
  window_start_utc        timestamptz NOT NULL,
  window_end_utc          timestamptz NOT NULL,
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','confirmed','dispatched','delivered','missed','cancelled')),
  extra_fee_eur           numeric(8,2) NOT NULL DEFAULT 0.00,
  confirmed_at            timestamptz,
  dispatched_at           timestamptz,
  delivered_at            timestamptz,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)  -- max. 1 Buchung pro Bestellung
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indizes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_time_slots_location_dow
  ON delivery_time_slots (location_id, day_of_week)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_window_bookings_location_window
  ON delivery_window_bookings (location_id, window_start_utc)
  WHERE status NOT IN ('delivered', 'missed', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_window_bookings_slot
  ON delivery_window_bookings (slot_id, window_start_utc)
  WHERE status NOT IN ('delivered', 'missed', 'cancelled');

-- Für Cron-Scan: offene Buchungen die in Kürze starten
CREATE INDEX IF NOT EXISTS idx_window_bookings_pending_start
  ON delivery_window_bookings (window_start_utc)
  WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────────────────────
-- v_slot_availability: Live-Kapazität pro Slot + Tag
-- Zeigt für den heutigen und morgigen Tag gebuchte vs. verfügbare Plätze
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_slot_availability AS
SELECT
  s.id                                          AS slot_id,
  s.location_id,
  s.day_of_week,
  s.slot_start_utc,
  s.slot_end_utc,
  s.capacity,
  s.slot_type,
  s.extra_fee_eur,
  s.label,
  s.is_active,
  -- Für die nächsten 2 Tage jeweils zählen
  d.booking_date,
  (d.booking_date + s.slot_start_utc)::timestamptz AS window_start_utc,
  (d.booking_date + s.slot_end_utc)::timestamptz   AS window_end_utc,
  COALESCE(b.booked_count, 0)                   AS booked_count,
  s.capacity - COALESCE(b.booked_count, 0)      AS remaining_capacity,
  ROUND(
    100.0 * COALESCE(b.booked_count, 0) / NULLIF(s.capacity, 0)
  )::int                                         AS utilization_pct
FROM delivery_time_slots s
CROSS JOIN (
  SELECT generate_series(0, 2)::int AS day_offset,
         (current_date + generate_series(0, 2))::date AS booking_date
) d
-- nur passende Wochentage (0=Montag in ISO, pg dow ist 0=Sonntag)
WHERE s.day_of_week = EXTRACT(DOW FROM d.booking_date)::int
  AND s.is_active = true
LEFT JOIN (
  SELECT slot_id,
         window_start_utc::date AS bdate,
         COUNT(*) AS booked_count
  FROM delivery_window_bookings
  WHERE status NOT IN ('delivered', 'missed', 'cancelled')
  GROUP BY slot_id, window_start_utc::date
) b ON b.slot_id = s.id AND b.bdate = d.booking_date;

-- ─────────────────────────────────────────────────────────────────────────────
-- v_window_dispatch_queue: Buchungen die in <15 Min starten und noch pending
-- Für Cron: diese Orders sollen automatisch freigegeben werden
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_window_dispatch_queue AS
SELECT
  wb.id            AS booking_id,
  wb.order_id,
  wb.location_id,
  wb.slot_id,
  wb.window_start_utc,
  wb.window_end_utc,
  wb.extra_fee_eur,
  co.bestellnummer,
  co.estimated_prep_min,
  co.schedule_status,
  co.mise_batch_id
FROM delivery_window_bookings wb
JOIN customer_orders co ON co.id = wb.order_id
WHERE wb.status = 'pending'
  -- Fenster startet in ≤15 Minuten
  AND wb.window_start_utc <= (now() + interval '15 minutes')
  -- Bestellung noch nicht dispatched
  AND co.mise_batch_id IS NULL
  AND co.status NOT IN ('storniert', 'cancelled', 'geliefert', 'abgeholt');

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE delivery_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_window_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- time_slots: service_role darf alles, authenticated SELECT eigene Location
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'delivery_time_slots' AND policyname = 'service_role_all_slots'
  ) THEN
    CREATE POLICY service_role_all_slots ON delivery_time_slots
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'delivery_time_slots' AND policyname = 'auth_select_own_slots'
  ) THEN
    CREATE POLICY auth_select_own_slots ON delivery_time_slots
      FOR SELECT TO authenticated
      USING (location_id IN (
        SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
      ));
  END IF;

  -- window_bookings: service_role alles, anon SELECT via order_id (kein PII), auth via location
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'delivery_window_bookings' AND policyname = 'service_role_all_bookings'
  ) THEN
    CREATE POLICY service_role_all_bookings ON delivery_window_bookings
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'delivery_window_bookings' AND policyname = 'auth_select_own_bookings'
  ) THEN
    CREATE POLICY auth_select_own_bookings ON delivery_window_bookings
      FOR SELECT TO authenticated
      USING (location_id IN (
        SELECT location_id FROM employees WHERE auth_user_id = auth.uid()
      ));
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: Beispiel-Slots für neue Locations (wird via API überschrieben)
-- Insert wird nur ausgeführt wenn Tabelle leer für eine Location
-- → keine Daten-Verschmutzung bei mehrfachem Ausführen
-- ─────────────────────────────────────────────────────────────────────────────
-- Kein automatischer Seed — Slots werden via Admin-API konfiguriert.
-- getOrCreateDefaultSlots() in windows.ts erstellt Defaults on-demand.
