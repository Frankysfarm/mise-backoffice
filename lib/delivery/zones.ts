/**
 * lib/delivery/zones.ts
 *
 * Zonen A/B/C/D Berechnung.
 * Zone A = nächste (< 3 km), Zone D = weiteste (> 10 km).
 * Zonen-Grenzen sind pro Location konfigurierbar (delivery_zones-Tabelle).
 * Fallback auf Default-Grenzen wenn keine DB-Konfiguration vorhanden.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';

export type ZoneName = 'A' | 'B' | 'C' | 'D';

export interface ZoneConfig {
  id: string;
  name: ZoneName;
  label: string;
  min_km: number;
  max_km: number;
  surcharge_eur: number;
  min_order_eur: number;
  eta_base_min: number;
  color: string;
}

const DEFAULT_ZONES: Omit<ZoneConfig, 'id'>[] = [
  { name: 'A', label: 'Express',    min_km: 0,  max_km: 3,  surcharge_eur: 0,    min_order_eur: 0,  eta_base_min: 20, color: '#22c55e' },
  { name: 'B', label: 'Standard',   min_km: 3,  max_km: 6,  surcharge_eur: 1.5,  min_order_eur: 15, eta_base_min: 30, color: '#3b82f6' },
  { name: 'C', label: 'Weit',       min_km: 6,  max_km: 10, surcharge_eur: 2.5,  min_order_eur: 20, eta_base_min: 45, color: '#f59e0b' },
  { name: 'D', label: 'Außerhalb',  min_km: 10, max_km: 999, surcharge_eur: 4.0, min_order_eur: 30, eta_base_min: 60, color: '#ef4444' },
];

const zoneCache = new Map<string, { zones: ZoneConfig[]; at: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Lädt Zonen-Konfiguration für eine Location aus DB (mit kurzem In-Memory-Cache). */
export async function getZoneConfig(locationId: string): Promise<ZoneConfig[]> {
  const cached = zoneCache.get(locationId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.zones;

  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_zones')
    .select('id, name, label, min_km, max_km, surcharge_eur, min_order_eur, eta_base_min, color')
    .eq('location_id', locationId)
    .eq('active', true)
    .order('min_km', { ascending: true });

  const zones: ZoneConfig[] = (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as ZoneName,
    label: r.label as string,
    min_km: Number(r.min_km),
    max_km: Number(r.max_km),
    surcharge_eur: Number(r.surcharge_eur),
    min_order_eur: Number(r.min_order_eur),
    eta_base_min: Number(r.eta_base_min),
    color: r.color as string,
  }));

  const result = zones.length > 0 ? zones : DEFAULT_ZONES.map((z) => ({ ...z, id: `default-${z.name}` }));
  zoneCache.set(locationId, { zones: result, at: Date.now() });
  return result;
}

/** Cache für eine Location invalidieren (nach Zone-Update). */
export function invalidateZoneCache(locationId: string): void {
  zoneCache.delete(locationId);
}

/**
 * Berechnet die Zone für eine Bestellung anhand der Distanz zwischen
 * Restaurant (origin) und Lieferadresse (destination).
 */
export async function classifyZone(
  locationId: string,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<{ zone: ZoneName; zoneConfig: ZoneConfig; distanceKm: number }> {
  const distanceKm = haversineKm(origin, destination);
  const zones = await getZoneConfig(locationId);
  const matched = zones.find((z) => distanceKm >= z.min_km && distanceKm < z.max_km);
  const zoneConfig = matched ?? zones[zones.length - 1];
  return { zone: zoneConfig.name, zoneConfig, distanceKm };
}

/** Alle aktiven Zonen für eine Location (für Admin-Konfiguration). */
export async function listZones(locationId: string): Promise<ZoneConfig[]> {
  return getZoneConfig(locationId);
}

/** Upsert einer Zone-Konfiguration (Admin). */
export async function upsertZone(
  locationId: string,
  zone: Omit<ZoneConfig, 'id'>,
): Promise<ZoneConfig> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('delivery_zones')
    .upsert(
      {
        location_id: locationId,
        name: zone.name,
        label: zone.label,
        min_km: zone.min_km,
        max_km: zone.max_km,
        surcharge_eur: zone.surcharge_eur,
        min_order_eur: zone.min_order_eur,
        eta_base_min: zone.eta_base_min,
        color: zone.color,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'location_id,name' },
    )
    .select()
    .single();

  if (error) throw new Error(`Zone upsert failed: ${error.message}`);
  invalidateZoneCache(locationId);

  return {
    id: data.id as string,
    name: data.name as ZoneName,
    label: data.label as string,
    min_km: Number(data.min_km),
    max_km: Number(data.max_km),
    surcharge_eur: Number(data.surcharge_eur),
    min_order_eur: Number(data.min_order_eur),
    eta_base_min: Number(data.eta_base_min),
    color: data.color as string,
  };
}

/** Initialisiert Default-Zonen für eine neue Location. */
export async function seedDefaultZones(locationId: string): Promise<void> {
  const sb = createServiceClient();
  const rows = DEFAULT_ZONES.map((z) => ({
    location_id: locationId,
    name: z.name,
    label: z.label,
    min_km: z.min_km,
    max_km: z.max_km,
    surcharge_eur: z.surcharge_eur,
    min_order_eur: z.min_order_eur,
    eta_base_min: z.eta_base_min,
    color: z.color,
    active: true,
  }));
  await sb.from('delivery_zones').upsert(rows, { onConflict: 'location_id,name', ignoreDuplicates: true });
  invalidateZoneCache(locationId);
}
