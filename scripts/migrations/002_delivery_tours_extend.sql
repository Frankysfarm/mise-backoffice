-- Migration 002: delivery_tours_extend
-- Erweitert bestehende mise_delivery_batches um Smart-Delivery-Felder.
-- Neue Tabellen: dispatch_scores, kitchen_timings.

-- 1) mise_delivery_batches erweitern
ALTER TABLE mise_delivery_batches
  ADD COLUMN IF NOT EXISTS zone              text,         -- 'A','B','C','D'
  ADD COLUMN IF NOT EXISTS dispatch_score    numeric(5,2), -- 0–100 Scoring-Wert
  ADD COLUMN IF NOT EXISTS kitchen_start_at  timestamptz,  -- Wann Küche starten soll
  ADD COLUMN IF NOT EXISTS estimated_pickup_at  timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS optimized         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stop_count        int NOT NULL DEFAULT 0;

-- 2) customer_orders erweitern
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS delivery_zone     text,         -- 'A','B','C','D'
  ADD COLUMN IF NOT EXISTS dispatch_score    numeric(5,2),
  ADD COLUMN IF NOT EXISTS kitchen_start_at  timestamptz,
  ADD COLUMN IF NOT EXISTS eta_earliest      timestamptz,
  ADD COLUMN IF NOT EXISTS eta_latest        timestamptz;

-- 3) mise_drivers erweitern
ALTER TABLE mise_drivers
  ADD COLUMN IF NOT EXISTS current_capacity  int NOT NULL DEFAULT 0,  -- aktuelle Ladung (Stops)
  ADD COLUMN IF NOT EXISTS max_capacity      int NOT NULL DEFAULT 4;   -- Max-Stops pro Tour

-- 4) dispatch_scores: Audit-Log für alle Scoring-Entscheidungen
CREATE TABLE IF NOT EXISTS dispatch_scores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id       uuid NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  driver_id      uuid REFERENCES mise_drivers(id) ON DELETE SET NULL,
  batch_id       uuid REFERENCES mise_delivery_batches(id) ON DELETE SET NULL,
  total_score    numeric(5,2) NOT NULL,
  -- Einzelne Faktoren (0–10 je Faktor, Summe × 10 = 0–100)
  f_distance     numeric(4,2) DEFAULT 0, -- Distanz-Faktor
  f_load         numeric(4,2) DEFAULT 0, -- Fahrer-Auslastung
  f_vehicle      numeric(4,2) DEFAULT 0, -- Fahrzeugtyp
  f_experience   numeric(4,2) DEFAULT 0, -- Fahrer-Erfahrung
  f_zone         numeric(4,2) DEFAULT 0, -- Zonen-Match
  f_prep_time    numeric(4,2) DEFAULT 0, -- Küchen-Timing
  f_time_of_day  numeric(4,2) DEFAULT 0, -- Tageszeit/Rush-Hour
  f_priority     numeric(4,2) DEFAULT 0, -- Bestellpriority
  f_bundle_fit   numeric(4,2) DEFAULT 0, -- Bündelungs-Eignung
  f_history      numeric(4,2) DEFAULT 0, -- Historische Performance
  decision       text NOT NULL,          -- 'assign','bundle','hold'
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_scores_order
  ON dispatch_scores (order_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_scores_location
  ON dispatch_scores (location_id, created_at DESC);

-- 5) kitchen_timings: Küchen-Synchronisation pro Bestellung
CREATE TABLE IF NOT EXISTS kitchen_timings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  order_id       uuid NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  batch_id       uuid REFERENCES mise_delivery_batches(id) ON DELETE SET NULL,
  tour_pickup_at timestamptz NOT NULL,   -- Wann Fahrer abholt
  cook_start_at  timestamptz NOT NULL,   -- Wann Küche starten soll
  ready_target   timestamptz NOT NULL,   -- Wann Essen fertig sein soll
  prep_min       int NOT NULL DEFAULT 15, -- Geschätzte Zubereitungszeit
  buffer_min     int NOT NULL DEFAULT 3,  -- Puffer-Minuten
  status         text NOT NULL DEFAULT 'scheduled', -- 'scheduled','cooking','ready','picked_up'
  notified_at    timestamptz,             -- Wann Küche benachrichtigt wurde
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_timings_location
  ON kitchen_timings (location_id, cook_start_at);
CREATE INDEX IF NOT EXISTS idx_kitchen_timings_batch
  ON kitchen_timings (batch_id);

COMMENT ON TABLE dispatch_scores IS
  'Audit-Log aller Dispatch-Scoring-Entscheidungen. '
  'Wird für Analytics und Modell-Tuning genutzt.';

COMMENT ON TABLE kitchen_timings IS
  'Steuert wann die Küche mit dem Kochen anfangen soll, '
  'synchronisiert mit dem Tourplan des Fahrers.';
