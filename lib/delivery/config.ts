/**
 * lib/delivery/config.ts
 *
 * Dynamic Delivery Configuration Engine.
 * Loads per-location settings from DB, falls back to hard-coded defaults.
 * 60-second in-memory cache per location to avoid DB round-trips on every dispatch tick.
 */
import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

// ─── Supabase service client (singleton) ────────────────────────────────────

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (_sb) return _sb;
  _sb = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _sb;
}

// ─── Known setting keys ──────────────────────────────────────────────────────

export type DeliverySettingKey =
  // dispatch
  | 'dispatch_escalation_min'
  | 'dispatch_max_radius_km'
  | 'dispatch_stale_batch_min'
  | 'dispatch_max_attempts'
  // bundling
  | 'bundling_max_detour_km'
  | 'bundling_max_stops'
  | 'bundling_time_window_min'
  // zones
  | 'zone_a_radius_km'
  | 'zone_b_radius_km'
  | 'zone_c_radius_km'
  // eta
  | 'eta_base_min'
  | 'eta_buffer_pct'
  | 'eta_avg_speed_kmh'
  // kitchen
  | 'kitchen_prep_default_min'
  | 'kitchen_sync_interval_min'
  // scoring weights
  | 'scoring_weight_distance'
  | 'scoring_weight_capacity'
  | 'scoring_weight_rating'
  | 'scoring_weight_zone'
  | 'scoring_weight_priority';

// ─── Hard-coded defaults (mirror of migration 027 seed data) ─────────────────

const DEFAULTS: Record<DeliverySettingKey, number> = {
  dispatch_escalation_min:    10,
  dispatch_max_radius_km:     12,
  dispatch_stale_batch_min:   60,
  dispatch_max_attempts:       5,
  bundling_max_detour_km:     1.5,
  bundling_max_stops:          4,
  bundling_time_window_min:    8,
  zone_a_radius_km:           2.0,
  zone_b_radius_km:           4.0,
  zone_c_radius_km:           7.0,
  eta_base_min:               15,
  eta_buffer_pct:             20,
  eta_avg_speed_kmh:          25,
  kitchen_prep_default_min:   12,
  kitchen_sync_interval_min:   2,
  scoring_weight_distance:    30,
  scoring_weight_capacity:    25,
  scoring_weight_rating:      20,
  scoring_weight_zone:        15,
  scoring_weight_priority:    10,
};

export type DeliverySettings = typeof DEFAULTS;

// ─── In-memory cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  settings: DeliverySettings;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const cache = new Map<string, CacheEntry>();

function fromCache(locationId: string): DeliverySettings | null {
  const entry = cache.get(locationId);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.settings;
}

function toCache(locationId: string, settings: DeliverySettings): void {
  cache.set(locationId, { settings, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateCache(locationId: string): void {
  cache.delete(locationId);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Loads all delivery settings for a location, merged with defaults.
 * Cached for 60 seconds. Graceful fallback to defaults on DB error.
 */
export async function getSettings(locationId: string): Promise<DeliverySettings> {
  const cached = fromCache(locationId);
  if (cached) return cached;

  const merged: DeliverySettings = { ...DEFAULTS };

  try {
    const { data, error } = await sb()
      .from('delivery_settings')
      .select('key, value')
      .eq('location_id', locationId);

    if (error) {
      // Migration not run yet — graceful fallback
      if (error.code === '42P01') {
        toCache(locationId, merged);
        return merged;
      }
      throw error;
    }

    for (const row of data ?? []) {
      const key = row.key as DeliverySettingKey;
      if (key in DEFAULTS) {
        const num = typeof row.value === 'number' ? row.value : Number(row.value);
        if (!isNaN(num)) {
          (merged as Record<string, number>)[key] = num;
        }
      }
    }
  } catch (err) {
    console.error('[delivery/config] getSettings failed, using defaults:', err);
  }

  toCache(locationId, merged);
  return merged;
}

/**
 * Returns a single setting value for a location.
 * Falls back to hard-coded default without a DB call when not cached.
 */
export async function getSetting(
  locationId: string,
  key: DeliverySettingKey,
): Promise<number> {
  const settings = await getSettings(locationId);
  return settings[key];
}

export interface SettingRow {
  key: DeliverySettingKey;
  effective_value: number;
  default_value: number;
  custom_value: number | null;
  is_customised: boolean;
  description: string;
  category: string;
  min_value: number | null;
  max_value: number | null;
  updated_at: string | null;
}

/**
 * Returns all settings for a location with metadata (description, min/max, customised flag).
 * Requires migration 027.
 */
export async function listSettings(locationId: string): Promise<SettingRow[]> {
  const { data, error } = await sb()
    .from('v_delivery_settings_all')
    .select('key, effective_value, default_value, custom_value, is_customised, description, category, min_value, max_value, updated_at')
    .or(`location_id.eq.${locationId},location_id.is.null`);

  if (error) {
    // Fallback: return defaults without metadata
    return (Object.keys(DEFAULTS) as DeliverySettingKey[]).map((key) => ({
      key,
      effective_value: DEFAULTS[key],
      default_value:   DEFAULTS[key],
      custom_value:    null,
      is_customised:   false,
      description:     '',
      category:        'general',
      min_value:       null,
      max_value:       null,
      updated_at:      null,
    }));
  }

  // Deduplicate: prefer row with location_id (customised) over null (default-only)
  const seen = new Map<string, SettingRow>();
  for (const row of data ?? []) {
    const existing = seen.get(row.key as string);
    if (!existing || row.is_customised) {
      seen.set(row.key as string, {
        key:             row.key as DeliverySettingKey,
        effective_value: Number(row.effective_value),
        default_value:   Number(row.default_value),
        custom_value:    row.custom_value !== null ? Number(row.custom_value) : null,
        is_customised:   Boolean(row.is_customised),
        description:     row.description ?? '',
        category:        row.category ?? 'general',
        min_value:       row.min_value !== null ? Number(row.min_value) : null,
        max_value:       row.max_value !== null ? Number(row.max_value) : null,
        updated_at:      row.updated_at ?? null,
      });
    }
  }

  return Array.from(seen.values()).sort((a, b) =>
    a.category.localeCompare(b.category) || a.key.localeCompare(b.key),
  );
}

/**
 * Upserts a single setting for a location.
 * Validates value against min/max from delivery_setting_defaults.
 * Invalidates the in-memory cache.
 */
export async function upsertSetting(
  locationId: string,
  key: DeliverySettingKey,
  value: number,
  updatedBy?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(key in DEFAULTS)) {
    return { ok: false, error: `Unbekannter Setting-Schlüssel: ${key}` };
  }

  // Validate against DB min/max
  const { data: meta } = await sb()
    .from('delivery_setting_defaults')
    .select('min_value, max_value')
    .eq('key', key)
    .maybeSingle();

  if (meta) {
    if (meta.min_value !== null && value < meta.min_value) {
      return { ok: false, error: `${key}: Wert ${value} ist kleiner als Minimum ${meta.min_value}` };
    }
    if (meta.max_value !== null && value > meta.max_value) {
      return { ok: false, error: `${key}: Wert ${value} ist größer als Maximum ${meta.max_value}` };
    }
  }

  const { error } = await sb()
    .from('delivery_settings')
    .upsert(
      {
        location_id: locationId,
        key,
        value:       value as unknown,
        updated_by:  updatedBy ?? null,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'location_id,key' },
    );

  if (error) return { ok: false, error: error.message };

  invalidateCache(locationId);
  return { ok: true };
}

/**
 * Resets all custom settings for a location to system defaults (deletes all rows).
 */
export async function resetToDefaults(locationId: string): Promise<{ ok: boolean; deleted: number }> {
  const { count, error } = await sb()
    .from('delivery_settings')
    .delete({ count: 'exact' })
    .eq('location_id', locationId);

  if (error) return { ok: false, deleted: 0 };

  invalidateCache(locationId);
  return { ok: true, deleted: count ?? 0 };
}

/**
 * Copies all custom settings from one location to another (tenant-internal clone).
 */
export async function cloneSettings(
  sourceLocationId: string,
  targetLocationId: string,
): Promise<{ ok: boolean; copied: number }> {
  const { data, error: fetchError } = await sb()
    .from('delivery_settings')
    .select('key, value, description')
    .eq('location_id', sourceLocationId);

  if (fetchError || !data?.length) return { ok: !fetchError, copied: 0 };

  const rows = data.map((r) => ({
    location_id: targetLocationId,
    key:         r.key,
    value:       r.value,
    description: r.description,
    updated_at:  new Date().toISOString(),
  }));

  const { error: upsertError } = await sb()
    .from('delivery_settings')
    .upsert(rows, { onConflict: 'location_id,key' });

  if (upsertError) return { ok: false, copied: 0 };

  invalidateCache(targetLocationId);
  return { ok: true, copied: rows.length };
}

/** Returns the hard-coded defaults without any DB access. */
export function getHardcodedDefaults(): DeliverySettings {
  return { ...DEFAULTS };
}
