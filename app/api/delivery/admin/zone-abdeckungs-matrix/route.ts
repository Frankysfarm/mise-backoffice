/**
 * GET /api/delivery/admin/zone-abdeckungs-matrix?location_id=<uuid>
 *
 * Phase 901 — Zone-Abdeckungs-Matrix-API
 * Welche Zonen A/B/C/D sind aktuell von aktiven Fahrern abgedeckt vs. unterbesetzt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

const ZONES = ['A', 'B', 'C', 'D'];

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();

  // Active drivers with their current zone
  const { data: activeDrivers } = await sb
    .from('mise_drivers')
    .select('id, current_zone')
    .eq('location_id', locationId)
    .eq('is_online', true);

  // Pending stops per zone
  const { data: pendingStops } = await sb
    .from('delivery_stops')
    .select('id, zone')
    .eq('location_id', locationId)
    .in('status', ['ausstehend', 'pending', 'in_progress', 'assigned']);

  // Build zone map
  const fahrerPerZone: Record<string, number> = {};
  const stoppsPerZone: Record<string, number> = {};
  let fahrerOhneZone = 0;

  for (const zone of ZONES) {
    fahrerPerZone[zone] = 0;
    stoppsPerZone[zone] = 0;
  }

  for (const d of (activeDrivers ?? [])) {
    const z = (d.current_zone ?? '').toUpperCase();
    if (ZONES.includes(z)) {
      fahrerPerZone[z] = (fahrerPerZone[z] ?? 0) + 1;
    } else {
      fahrerOhneZone++;
    }
  }

  for (const s of (pendingStops ?? [])) {
    const z = (s.zone ?? '').toUpperCase();
    if (ZONES.includes(z)) {
      stoppsPerZone[z] = (stoppsPerZone[z] ?? 0) + 1;
    }
  }

  const zonen = ZONES.map(zone => ({
    zone,
    fahrer_count: fahrerPerZone[zone] ?? 0,
    stopps_ausstehend: stoppsPerZone[zone] ?? 0,
    abgedeckt: (fahrerPerZone[zone] ?? 0) > 0,
    unterbesetzt: (fahrerPerZone[zone] ?? 0) === 1 && (stoppsPerZone[zone] ?? 0) >= 3,
  }));

  return NextResponse.json({
    zonen,
    fahrer_ohne_zone: fahrerOhneZone,
    alle_abgedeckt: zonen.every(z => z.abgedeckt),
    generatedAt: new Date().toISOString(),
  });
}
