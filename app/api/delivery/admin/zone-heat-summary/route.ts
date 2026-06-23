/**
 * GET /api/delivery/admin/zone-heat-summary
 *
 * Echtzeit-Zonen-Auslastung: offene Batches + verfügbare Fahrer pro Zone.
 * Für DispatchZonenKapazitätsRadar.
 *
 * Response: ZoneHeatSummary[]
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ZoneHeatEntry {
  zone: string;
  label: string;
  color: string;
  openBatches: number;
  activeBatches: number;
  driversInZone: number;
  capacityPct: number; // openBatches / max(1, activeBatches+driversInZone) * 100
}

const ZONE_META: Record<string, { label: string; color: string }> = {
  A: { label: 'Express',   color: '#22c55e' },
  B: { label: 'Standard',  color: '#3b82f6' },
  C: { label: 'Weit',      color: '#f59e0b' },
  D: { label: 'Außerhalb', color: '#ef4444' },
};

const OPEN_STATUSES = ['offen', 'bereit', 'pending', 'assigned', 'pickup'];
const ACTIVE_STATUSES = ['unterwegs', 'on_route', 'at_restaurant', 'pickup'];

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const params = new URL(req.url).searchParams;
  let locationId = params.get('location_id');

  if (!locationId) {
    const { data: emp } = await sb
      .from('employees')
      .select('location_id')
      .eq('auth_user_id', user.id)
      .single();
    locationId = (emp?.location_id as string | null) ?? null;
  }

  if (!locationId) return NextResponse.json({ error: 'Kein Standort' }, { status: 400 });

  // Fetch open batches per zone
  const { data: openBatches } = await sb
    .from('delivery_batches')
    .select('zone')
    .eq('location_id', locationId)
    .in('status', OPEN_STATUSES);

  // Fetch active batches (currently being delivered) per zone
  const { data: activeBatches } = await sb
    .from('delivery_batches')
    .select('zone')
    .eq('location_id', locationId)
    .in('status', ACTIVE_STATUSES);

  // Count open drivers (active shifts, no active batch)
  const today = new Date().toISOString().slice(0, 10);
  const { data: activeShifts } = await sb
    .from('driver_shifts')
    .select('driver_id')
    .eq('location_id', locationId)
    .gte('started_at', `${today}T00:00:00.000Z`)
    .is('ended_at', null);

  const totalDrivers = (activeShifts ?? []).length;

  // Active driver IDs (drivers with active batches)
  const { data: activeBatchesWithDriver } = await sb
    .from('delivery_batches')
    .select('driver_id, zone')
    .eq('location_id', locationId)
    .in('status', ACTIVE_STATUSES)
    .not('driver_id', 'is', null);

  // Build per-zone counts
  const zones = ['A', 'B', 'C', 'D'];
  const openMap = new Map<string, number>();
  const activeMap = new Map<string, number>();
  const driverZoneMap = new Map<string, number>();

  for (const z of zones) {
    openMap.set(z, 0);
    activeMap.set(z, 0);
    driverZoneMap.set(z, 0);
  }

  for (const b of openBatches ?? []) {
    const z = ((b.zone as string | null) ?? 'A').toUpperCase();
    if (zones.includes(z)) openMap.set(z, (openMap.get(z) ?? 0) + 1);
  }

  for (const b of activeBatches ?? []) {
    const z = ((b.zone as string | null) ?? 'A').toUpperCase();
    if (zones.includes(z)) activeMap.set(z, (activeMap.get(z) ?? 0) + 1);
  }

  for (const b of activeBatchesWithDriver ?? []) {
    const z = ((b.zone as string | null) ?? 'A').toUpperCase();
    if (zones.includes(z)) driverZoneMap.set(z, (driverZoneMap.get(z) ?? 0) + 1);
  }

  // Free drivers not in any active batch
  const occupiedDrivers = (activeBatchesWithDriver ?? []).length;
  const freeDrivers = Math.max(0, totalDrivers - occupiedDrivers);
  // Distribute free drivers evenly across zones for capacity calculation
  const freePerZone = Math.floor(freeDrivers / zones.length);

  const result: ZoneHeatEntry[] = zones.map((z) => {
    const meta = ZONE_META[z] ?? { label: z, color: '#94a3b8' };
    const open = openMap.get(z) ?? 0;
    const active = activeMap.get(z) ?? 0;
    const driversInZone = (driverZoneMap.get(z) ?? 0) + freePerZone;
    const denominator = Math.max(1, active + driversInZone);
    const capacityPct = Math.min(100, Math.round((open / denominator) * 100));

    return {
      zone: z,
      label: meta.label,
      color: meta.color,
      openBatches: open,
      activeBatches: active,
      driversInZone,
      capacityPct,
    };
  });

  return NextResponse.json({ zones: result, totalDrivers, freeDrivers });
}
