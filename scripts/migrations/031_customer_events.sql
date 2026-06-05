-- Phase 37: Customer Delivery Event Feed
-- customer_delivery_events: chronologischer Event-Log pro Bestellung
-- Die Tracking-Page konsumiert diese Einträge via Supabase-Realtime.
--
-- Events:
--   driver_assigned       — Dispatch-Engine hat Fahrer zugewiesen
--   driver_at_restaurant  — Fahrer-Geofence: Restaurant-Radius erreicht
--   driver_departing      — Tour-Status → on_route (Fahrer bricht auf)
--   driver_nearby         — Fahrer-Geofence: Kunden-Radius (100 m) erreicht
--   delivered             — Tour-Status → delivered
--   cancelled             — Tour storniert
--   delayed               — ETA wurde signifikant nach hinten verschoben

CREATE TABLE IF NOT EXISTS customer_delivery_events (
  id           uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id     uuid         NOT NULL,
  location_id  uuid         NOT NULL,
  event_type   text         NOT NULL,
  message_de   text         NOT NULL,
  metadata     jsonb,
  created_at   timestamptz  DEFAULT now() NOT NULL
);

-- FOREIGN KEY (migration-safe: ignoriert falls customer_orders nicht existiert)
DO $$ BEGIN
  ALTER TABLE customer_delivery_events
    ADD CONSTRAINT fk_cde_order
    FOREIGN KEY (order_id) REFERENCES customer_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN undefined_table  THEN NULL;
END $$;

-- Index: Tracking-Page liest nach order_id + chronologisch
CREATE INDEX IF NOT EXISTS idx_cde_order_time
  ON customer_delivery_events (order_id, created_at DESC);

-- Index: Admin-Queries nach Location
CREATE INDEX IF NOT EXISTS idx_cde_location_time
  ON customer_delivery_events (location_id, created_at DESC);

-- Supabase Realtime: REPLICA IDENTITY FULL ermöglicht gefilterte Subscriptions
ALTER TABLE customer_delivery_events REPLICA IDENTITY FULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE customer_delivery_events ENABLE ROW LEVEL SECURITY;

-- Service-Role: vollen Zugriff (Backend-Writes, Admin-Reads)
CREATE POLICY "cde_service_all" ON customer_delivery_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Anon (Tracking-Page): Lese-Zugriff — order_id ist implizit geheim (UUID-Entropie)
CREATE POLICY "cde_anon_read" ON customer_delivery_events
  FOR SELECT TO anon
  USING (true);

-- Authenticated Employees: Lese-Zugriff auf eigene Location
CREATE POLICY "cde_employee_read" ON customer_delivery_events
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT location_id FROM employees WHERE user_id = auth.uid()
    )
  );
