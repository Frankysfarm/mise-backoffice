-- Migration 065: Order Tracking Sessions + Live Tracking View (Phase 107)
--
-- Zweck:
--   Analytics für die Storefront Live-Tracking-Seite:
--   - order_tracking_sessions: wann/wie oft Kunden die Tracking-Seite aufrufen
--   - v_live_order_tracking: Echtzeit-Tracking mit Geofencing-Daten (Distanz, Almost-There)
--
-- Geofencing-Schwellwerte:
--   almost_there  < 300 m
--   very_close    < 150 m (= Geofence-Ankunft, wird separat via gps-tracker gehandelt)

-- ============================================================
-- 1. order_tracking_sessions — Analytics-Tabelle
-- ============================================================
CREATE TABLE IF NOT EXISTS order_tracking_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid        REFERENCES customer_orders(id) ON DELETE CASCADE,
  location_id     uuid        REFERENCES locations(id) ON DELETE SET NULL,
  bestellnummer   text        NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  last_ping_at    timestamptz NOT NULL DEFAULT now(),
  pings           int         NOT NULL DEFAULT 1,
  almost_there_at timestamptz,   -- erste Almost-There-Triggerung in dieser Session
  arrived_at      timestamptz,   -- Status 'geliefert' in dieser Session erstmals gesehen
  user_agent      text,
  ip_hash         text           -- SHA-256 der IP, gehashed für Datenschutz
);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_order
  ON order_tracking_sessions (order_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_location_recent
  ON order_tracking_sessions (location_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_bestellnummer
  ON order_tracking_sessions (bestellnummer);

ALTER TABLE order_tracking_sessions ENABLE ROW LEVEL SECURITY;

-- Öffentlich lesbar (kein Auth nötig für die Tracking-Seite)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_tracking_sessions'
      AND policyname = 'tracking_sessions_insert_anon'
  ) THEN
    CREATE POLICY tracking_sessions_insert_anon ON order_tracking_sessions
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE order_tracking_sessions IS
  'Analytics: Tracking-Seitenaufrufe durch Kunden. '
  'Kein Auth. IP wird gehasht gespeichert (SHA-256).';

-- ============================================================
-- 2. v_tracking_session_stats — Admin-VIEW Tracking-Analytics
-- ============================================================
CREATE OR REPLACE VIEW v_tracking_session_stats AS
SELECT
  location_id,
  DATE(started_at)                                  AS session_date,
  COUNT(DISTINCT order_id)                          AS unique_orders,
  COUNT(*)                                          AS total_sessions,
  ROUND(AVG(pings)::numeric, 1)                     AS avg_pings_per_session,
  COUNT(*) FILTER (WHERE almost_there_at IS NOT NULL) AS sessions_with_almost_there,
  COUNT(*) FILTER (WHERE arrived_at IS NOT NULL)    AS sessions_saw_arrival
FROM order_tracking_sessions
GROUP BY location_id, DATE(started_at);

COMMENT ON VIEW v_tracking_session_stats IS
  'Tägliche Tracking-Nutzungsstatistik pro Location.';

-- ============================================================
-- 3. v_live_order_tracking — Echtzeit-Tracking mit Geofencing
--    Legt Fahrer-Position + Distanz zum Kunden offen.
--    Öffentlich lesbar (wird von Tracking-API genutzt).
-- ============================================================
CREATE OR REPLACE VIEW v_live_order_tracking AS
SELECT
  o.id                                AS order_id,
  o.bestellnummer,
  o.status,
  o.typ,
  o.eta_earliest,
  o.eta_latest,
  o.mise_batch_id,
  o.location_id,
  o.kunde_lat,
  o.kunde_lng,

  -- Fahrer-Position (jüngster GPS-Ping)
  drv_pos.driver_id,
  drv_pos.lat                         AS driver_lat,
  drv_pos.lng                         AS driver_lng,
  drv_pos.heading                     AS driver_heading,
  drv_pos.speed_kmh                   AS driver_speed_kmh,
  drv_pos.recorded_at                 AS driver_position_at,
  EXTRACT(EPOCH FROM (now() - drv_pos.recorded_at))::int
                                      AS driver_position_age_sec,

  -- Geofencing: Distanz Fahrer → Kunde (Haversine, Meter)
  CASE
    WHEN drv_pos.lat IS NOT NULL
      AND o.kunde_lat IS NOT NULL
    THEN ROUND((
      2 * 6371000 * ASIN(SQRT(
        POWER(SIN(RADIANS((o.kunde_lat  - drv_pos.lat) / 2)), 2) +
        COS(RADIANS(drv_pos.lat)) * COS(RADIANS(o.kunde_lat)) *
        POWER(SIN(RADIANS((o.kunde_lng - drv_pos.lng) / 2)), 2)
      ))
    )::numeric, 0)
    ELSE NULL
  END                                 AS driver_distance_m,

  -- Almost-There-Flag: Fahrer < 300 m vom Kunden entfernt
  CASE
    WHEN drv_pos.lat IS NOT NULL
      AND o.kunde_lat IS NOT NULL
      AND (
        2 * 6371000 * ASIN(SQRT(
          POWER(SIN(RADIANS((o.kunde_lat  - drv_pos.lat) / 2)), 2) +
          COS(RADIANS(drv_pos.lat)) * COS(RADIANS(o.kunde_lat)) *
          POWER(SIN(RADIANS((o.kunde_lng - drv_pos.lng) / 2)), 2)
        ))
      ) < 300
    THEN true
    ELSE false
  END                                 AS almost_there,

  -- Fahrername (für Tracking-Anzeige)
  e.vorname                           AS driver_name,

  -- Batch-Status
  b.state                             AS batch_state

FROM customer_orders o
-- Aktive Batch des Fahrers
LEFT JOIN mise_delivery_batches b
  ON b.id = o.mise_batch_id
-- Fahrer-ID aus Batch oder direkter Zuweisung
LEFT JOIN LATERAL (
  SELECT
    dl.lat, dl.lng, dl.heading, dl.speed_kmh, dl.recorded_at,
    COALESCE(b.driver_id, o.mise_driver_id) AS driver_id
  FROM mise_driver_locations dl
  WHERE dl.driver_id = COALESCE(b.driver_id, o.mise_driver_id)
  ORDER BY dl.recorded_at DESC
  LIMIT 1
) drv_pos ON COALESCE(b.driver_id, o.mise_driver_id) IS NOT NULL
-- Fahrername
LEFT JOIN mise_drivers md
  ON md.id = COALESCE(b.driver_id, o.mise_driver_id)
LEFT JOIN employees e
  ON e.id = md.employee_id
WHERE o.typ = 'lieferung';

COMMENT ON VIEW v_live_order_tracking IS
  'Echtzeit-Tracking für Storefront: Fahrer-Position + Distanz + Almost-There. '
  'Genutzt von /api/delivery/tracking/[bestellnummer]. Phase 107.';
