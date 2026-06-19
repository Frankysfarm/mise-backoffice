-- Migration 134: Smart Dispatch ML-Scoring V2
-- Per-location weight configs + historical zone×vehicle success rates

-- ── Scoring V2 configs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scoring_v2_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Factor weights (admin-tunable; used as-is in score computation)
  w_distance      integer NOT NULL DEFAULT 12,
  w_load          integer NOT NULL DEFAULT 8,
  w_vehicle       integer NOT NULL DEFAULT 8,
  w_experience    integer NOT NULL DEFAULT 6,
  w_zone          integer NOT NULL DEFAULT 10,
  w_prep_time     integer NOT NULL DEFAULT 10,
  w_time_of_day   integer NOT NULL DEFAULT 6,
  w_priority      integer NOT NULL DEFAULT 6,
  w_bundle_fit    integer NOT NULL DEFAULT 8,
  w_history       integer NOT NULL DEFAULT 10,
  w_weather       integer NOT NULL DEFAULT 8,   -- NEW: weather difficulty
  w_velocity      integer NOT NULL DEFAULT 8,   -- NEW: driver deliveries/hour

  -- Feature flags
  use_weather               boolean NOT NULL DEFAULT true,
  use_velocity              boolean NOT NULL DEFAULT true,
  use_zone_vehicle_stats    boolean NOT NULL DEFAULT true,

  -- Toggle V2 on/off per location (false = stay on V1)
  is_active       boolean NOT NULL DEFAULT false,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (location_id)
);

ALTER TABLE scoring_v2_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scoring_v2_configs: location read"
  ON scoring_v2_configs FOR SELECT USING (true);
CREATE POLICY "scoring_v2_configs: service write"
  ON scoring_v2_configs FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER trg_scoring_v2_configs_updated_at
  BEFORE UPDATE ON scoring_v2_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Zone × Vehicle historical stats ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_zone_vehicle_stats (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id         uuid NOT NULL,
  zone                text NOT NULL CHECK (zone IN ('A','B','C','D')),
  vehicle             text NOT NULL CHECK (vehicle IN ('bike','car')),

  total_deliveries    integer NOT NULL DEFAULT 0,
  on_time_count       integer NOT NULL DEFAULT 0,
  avg_delivery_min    numeric(6,2) NOT NULL DEFAULT 25,
  success_rate        numeric(5,4) NOT NULL DEFAULT 0.8000,

  last_rebuilt_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (location_id, zone, vehicle)
);

CREATE INDEX IF NOT EXISTS idx_zone_vehicle_stats_location
  ON driver_zone_vehicle_stats (location_id);

ALTER TABLE driver_zone_vehicle_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zone_vehicle_stats: read"
  ON driver_zone_vehicle_stats FOR SELECT USING (true);
CREATE POLICY "zone_vehicle_stats: service write"
  ON driver_zone_vehicle_stats FOR ALL USING (auth.role() = 'service_role');

-- ── rebuild_zone_vehicle_stats(location_id) SQL function ───────────────────
-- Aggregates last 30 days of completed deliveries by zone + vehicle.
-- Called by API / cron; idempotent (upsert on conflict).
CREATE OR REPLACE FUNCTION rebuild_zone_vehicle_stats(p_location_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_rows integer;
  v_since timestamptz := now() - interval '30 days';
BEGIN
  WITH raw AS (
    SELECT
      co.delivery_zone                            AS zone,
      md.fahrzeug                                 AS vehicle,
      COUNT(*)                                    AS total_deliveries,
      COUNT(*) FILTER (
        WHERE co.fertig_am IS NOT NULL
          AND co.eta_earliest IS NOT NULL
          AND co.fertig_am <= co.eta_earliest
      )                                           AS on_time_count,
      AVG(
        EXTRACT(EPOCH FROM (co.fertig_am - co.bestellt_am)) / 60.0
      ) FILTER (
        WHERE co.fertig_am IS NOT NULL
          AND co.bestellt_am IS NOT NULL
          AND EXTRACT(EPOCH FROM (co.fertig_am - co.bestellt_am)) / 60.0
              BETWEEN 1 AND 240
      )                                           AS avg_delivery_min
    FROM customer_orders co
    JOIN mise_delivery_batches mdb ON mdb.id = co.mise_batch_id
    JOIN mise_drivers md          ON md.id = mdb.driver_id
    WHERE co.location_id = p_location_id
      AND co.typ = 'lieferung'
      AND co.status IN ('geliefert', 'abgeschlossen', 'completed')
      AND co.delivery_zone IN ('A','B','C','D')
      AND md.fahrzeug IN ('bike','car')
      AND co.fertig_am >= v_since
    GROUP BY co.delivery_zone, md.fahrzeug
  )
  INSERT INTO driver_zone_vehicle_stats
    (location_id, zone, vehicle, total_deliveries, on_time_count, avg_delivery_min,
     success_rate, last_rebuilt_at)
  SELECT
    p_location_id,
    zone,
    vehicle,
    total_deliveries::integer,
    on_time_count::integer,
    COALESCE(avg_delivery_min, 25)::numeric(6,2),
    CASE WHEN total_deliveries > 0
         THEN (on_time_count::numeric / total_deliveries)
         ELSE 0.8
    END::numeric(5,4),
    now()
  FROM raw
  ON CONFLICT (location_id, zone, vehicle)
  DO UPDATE SET
    total_deliveries = EXCLUDED.total_deliveries,
    on_time_count    = EXCLUDED.on_time_count,
    avg_delivery_min = EXCLUDED.avg_delivery_min,
    success_rate     = EXCLUDED.success_rate,
    last_rebuilt_at  = now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

-- ── Overview view ──────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_scoring_v2_overview AS
SELECT
  sc.location_id,
  sc.is_active,
  sc.use_weather,
  sc.use_velocity,
  sc.use_zone_vehicle_stats,
  sc.w_distance + sc.w_load + sc.w_vehicle + sc.w_experience +
    sc.w_zone + sc.w_prep_time + sc.w_time_of_day + sc.w_priority +
    sc.w_bundle_fit + sc.w_history + sc.w_weather + sc.w_velocity  AS weight_sum,
  (SELECT COUNT(*) FROM driver_zone_vehicle_stats s
   WHERE s.location_id = sc.location_id)                           AS zone_vehicle_rows,
  (SELECT MAX(s.last_rebuilt_at) FROM driver_zone_vehicle_stats s
   WHERE s.location_id = sc.location_id)                           AS last_rebuilt_at
FROM scoring_v2_configs sc;
