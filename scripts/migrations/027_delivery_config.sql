-- Migration 027: Dynamic Delivery Configuration Engine
--
-- Allows operators to tune delivery parameters per-location without code deploys.
-- All settings fall back to hard-coded defaults when not configured.
--
-- 1. delivery_settings        — per-location key/value config store
-- 2. get_delivery_setting()   — helper function: DB value or fallback default
-- 3. v_delivery_settings_all  — VIEW: merges custom settings with system defaults
-- 4. Performance indexes

-- ============================================================
-- 1. delivery_settings — key/value config per location
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_settings (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id  uuid        NOT NULL,
  key          text        NOT NULL,
  value        jsonb       NOT NULL,
  description  text,
  updated_by   uuid,        -- auth.users.id of admin who last changed it
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (location_id, key)
);

COMMENT ON TABLE delivery_settings IS
  'Per-location delivery configuration. Missing keys fall back to system defaults.';

-- RLS: admins of the same tenant can read + write their own settings
ALTER TABLE delivery_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY delivery_settings_service_all ON delivery_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY delivery_settings_auth_select ON delivery_settings
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT e.location_id
      FROM   employees e
      WHERE  e.auth_user_id = auth.uid()
        AND  e.location_id IS NOT NULL
    )
  );

CREATE POLICY delivery_settings_auth_modify ON delivery_settings
  FOR ALL TO authenticated
  USING (
    location_id IN (
      SELECT e.location_id
      FROM   employees e
      WHERE  e.auth_user_id = auth.uid()
        AND  e.location_id IS NOT NULL
    )
  )
  WITH CHECK (
    location_id IN (
      SELECT e.location_id
      FROM   employees e
      WHERE  e.auth_user_id = auth.uid()
        AND  e.location_id IS NOT NULL
    )
  );

-- ============================================================
-- 2. System defaults table (read-only reference)
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_setting_defaults (
  key           text    PRIMARY KEY,
  default_value jsonb   NOT NULL,
  description   text    NOT NULL,
  min_value     numeric,
  max_value     numeric,
  category      text    NOT NULL DEFAULT 'general'  -- 'dispatch' | 'bundling' | 'zones' | 'eta' | 'kitchen' | 'scoring'
);

COMMENT ON TABLE delivery_setting_defaults IS
  'System-wide defaults for all delivery_settings keys. Immutable by users.';

-- Populate defaults (idempotent)
INSERT INTO delivery_setting_defaults (key, default_value, description, min_value, max_value, category) VALUES
  -- Dispatch
  ('dispatch_escalation_min',     '10',    'Minutes before order dispatch escalates to wider radius',       1,   120,  'dispatch'),
  ('dispatch_max_radius_km',      '12',    'Maximum driver search radius in km',                            1,   50,   'dispatch'),
  ('dispatch_stale_batch_min',    '60',    'Minutes before a stuck batch is auto-cancelled and recovered',  10,  240,  'dispatch'),
  ('dispatch_max_attempts',       '5',     'Max dispatch attempts before manual escalation flag',           1,   20,   'dispatch'),
  -- Bundling
  ('bundling_max_detour_km',      '1.5',   'Max extra km allowed when adding a stop to existing tour',      0.1, 10,   'bundling'),
  ('bundling_max_stops',          '4',     'Maximum stops per delivery batch',                              1,   10,   'bundling'),
  ('bundling_time_window_min',    '8',     'Max age difference (minutes) between orders to allow bundling', 1,   30,   'bundling'),
  -- Zones
  ('zone_a_radius_km',            '2.0',   'Zone A (premium) radius in km',                                0.1, 5,    'zones'),
  ('zone_b_radius_km',            '4.0',   'Zone B (standard) radius in km',                               0.5, 10,   'zones'),
  ('zone_c_radius_km',            '7.0',   'Zone C (extended) radius in km',                               1,   20,   'zones'),
  -- ETA
  ('eta_base_min',                '15',    'Minimum ETA in minutes regardless of distance',                 5,   60,   'eta'),
  ('eta_buffer_pct',              '20',    'ETA buffer percentage added on top of calculated time',         0,   100,  'eta'),
  ('eta_avg_speed_kmh',           '25',    'Assumed average delivery speed in km/h',                        5,   80,   'eta'),
  -- Kitchen
  ('kitchen_prep_default_min',    '12',    'Default kitchen preparation time in minutes',                   3,   60,   'kitchen'),
  ('kitchen_sync_interval_min',   '2',     'How often kitchen timings are synced from cron (minutes)',      1,   15,   'kitchen'),
  -- Scoring weights (must sum ≤ 100, remainder is implicit tie-break)
  ('scoring_weight_distance',     '30',    'Score weight for driver distance to restaurant (0–100)',         0,   100,  'scoring'),
  ('scoring_weight_capacity',     '25',    'Score weight for driver remaining capacity',                    0,   100,  'scoring'),
  ('scoring_weight_rating',       '20',    'Score weight for driver historical rating',                     0,   100,  'scoring'),
  ('scoring_weight_zone',         '15',    'Score weight for driver zone match',                            0,   100,  'scoring'),
  ('scoring_weight_priority',     '10',    'Score weight for order priority level',                         0,   100,  'scoring')
ON CONFLICT (key) DO UPDATE
  SET default_value = EXCLUDED.default_value,
      description   = EXCLUDED.description,
      min_value     = EXCLUDED.min_value,
      max_value     = EXCLUDED.max_value,
      category      = EXCLUDED.category;

-- ============================================================
-- 3. get_delivery_setting() — returns custom value or default
-- ============================================================
CREATE OR REPLACE FUNCTION get_delivery_setting(
  p_location_id uuid,
  p_key         text
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT ds.value
     FROM   delivery_settings ds
     WHERE  ds.location_id = p_location_id
       AND  ds.key         = p_key),
    (SELECT dsd.default_value
     FROM   delivery_setting_defaults dsd
     WHERE  dsd.key = p_key)
  );
$$;

COMMENT ON FUNCTION get_delivery_setting IS
  'Returns per-location setting value, falling back to system default if not customised.';

-- ============================================================
-- 4. v_delivery_settings_all — merged view (custom + defaults)
-- ============================================================
CREATE OR REPLACE VIEW v_delivery_settings_all AS
SELECT
  dsd.key,
  dsd.default_value,
  dsd.description,
  dsd.min_value,
  dsd.max_value,
  dsd.category,
  ds.location_id,
  COALESCE(ds.value, dsd.default_value)             AS effective_value,
  (ds.value IS NOT NULL)                            AS is_customised,
  ds.value                                          AS custom_value,
  ds.updated_at,
  ds.updated_by
FROM  delivery_setting_defaults dsd
LEFT JOIN delivery_settings ds ON ds.key = dsd.key;

COMMENT ON VIEW v_delivery_settings_all IS
  'All known settings with effective values. NULL location_id rows = uncustomised defaults.';

-- ============================================================
-- 5. Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_delivery_settings_location
  ON delivery_settings (location_id);

CREATE INDEX IF NOT EXISTS idx_delivery_settings_location_key
  ON delivery_settings (location_id, key);

CREATE INDEX IF NOT EXISTS idx_delivery_setting_defaults_category
  ON delivery_setting_defaults (category);
