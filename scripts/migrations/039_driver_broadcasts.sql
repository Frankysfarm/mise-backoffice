-- Migration 039: Driver Broadcast & Operational Messages
-- Ermöglicht Dispatch-Mitarbeitern, Nachrichten an alle aktiven Fahrer zu senden.
-- Nachrichten sind ortsbezogen, priorisierbar und laufen automatisch ab.

-- ────────────────────────────────────────────────────────────────────────────
-- 1) driver_broadcasts — Ausgehende Nachrichten vom Dispatch an Fahrer
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_broadcasts (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  uuid         NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  message      text         NOT NULL CHECK (char_length(message) BETWEEN 1 AND 280),
  priority     text         NOT NULL DEFAULT 'normal'
                            CHECK (priority IN ('normal', 'urgent')),
  -- Ziel: 'all' = alle aktiven Fahrer, UUID = bestimmter Fahrer (mise_drivers.id)
  target       text         NOT NULL DEFAULT 'all',
  sent_by_name text,        -- Klarname des sendenden Mitarbeiters (denormalisiert)
  created_at   timestamptz  NOT NULL DEFAULT now(),
  expires_at   timestamptz  NOT NULL DEFAULT (now() + interval '4 hours')
);

CREATE INDEX IF NOT EXISTS idx_driver_broadcasts_location_expires
  ON driver_broadcasts(location_id, expires_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 2) driver_broadcast_reads — Welcher Fahrer hat welche Nachricht gelesen?
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_broadcast_reads (
  broadcast_id  uuid        NOT NULL REFERENCES driver_broadcasts(id) ON DELETE CASCADE,
  driver_id     uuid        NOT NULL,
  read_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (broadcast_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_broadcast_reads_driver
  ON driver_broadcast_reads(driver_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 3) View: Broadcast-Status mit Lesebestätigungen für Admin
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_broadcast_status AS
SELECT
  b.id,
  b.location_id,
  b.message,
  b.priority,
  b.target,
  b.sent_by_name,
  b.created_at,
  b.expires_at,
  b.expires_at > now()                       AS is_active,
  COUNT(r.driver_id)                         AS read_count
FROM driver_broadcasts b
LEFT JOIN driver_broadcast_reads r ON r.broadcast_id = b.id
GROUP BY b.id;

-- ────────────────────────────────────────────────────────────────────────────
-- 4) RLS
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE driver_broadcasts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_broadcast_reads  ENABLE ROW LEVEL SECURITY;

-- Service-Role hat vollen Zugriff (Backend-Funktionen nutzen service_role)
CREATE POLICY "service_full_driver_broadcasts"
  ON driver_broadcasts FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_full_driver_broadcast_reads"
  ON driver_broadcast_reads FOR ALL
  TO service_role USING (true) WITH CHECK (true);
