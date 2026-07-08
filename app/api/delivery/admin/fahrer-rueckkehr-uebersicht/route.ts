/**
 * GET /api/delivery/admin/fahrer-rueckkehr-uebersicht?location_id=<uuid>
 *
 * Phase 839 — Fahrer-Rückkehr-Übersicht-Live-API
 * Alle Fahrer unterwegs: Erwartete Rückkehr (Haversine + Stop-Count), sortiert nach frühester Rückkehr.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_PER_STOP = 5;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const now = new Date();

  // Get active drivers with their current location
  const { data: drivers } = await sb
    .from('employees')
    .select('id, name, current_lat, current_lng, is_online')
    .eq('location_id', locationId)
    .eq('role', 'driver')
    .eq('is_online', true);

  if (!drivers || drivers.length === 0) {
    return NextResponse.json({ fahrer: [], generatedAt: now.toISOString() });
  }

  // Get active batches for each driver
  const driverIds = drivers.map(d => d.id);
  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, driver_id, started_at')
    .eq('location_id', locationId)
    .in('driver_id', driverIds)
    .is('completed_at', null)
    .not('started_at', 'is', null);

  const batchMap = new Map<string, string>(); // driver_id → batch_id
  for (const b of batches ?? []) {
    if (b.driver_id && b.id) batchMap.set(b.driver_id as string, b.id as string);
  }

  const activeBatchIds = Array.from(batchMap.values());

  // Get pending stops for active batches
  const { data: stops } = activeBatchIds.length > 0
    ? await sb
        .from('delivery_stops')
        .select('id, batch_id, geliefert_am, lat, lng')
        .in('batch_id', activeBatchIds)
        .is('geliefert_am', null)
    : { data: [] };

  const stopsByBatch = new Map<string, typeof stops>();
  for (const s of stops ?? []) {
    const list = stopsByBatch.get(s.batch_id as string) ?? [];
    list.push(s);
    stopsByBatch.set(s.batch_id as string, list);
  }

  // Get location's hub coordinates (first stop fallback)
  const { data: locationData } = await sb
    .from('locations')
    .select('lat, lng')
    .eq('id', locationId)
    .maybeSingle();

  const hubLat = (locationData?.lat as number) ?? 48.137;
  const hubLng = (locationData?.lng as number) ?? 11.575;

  const result = [];

  for (const driver of drivers) {
    const batchId = batchMap.get(driver.id as string);
    if (!batchId) continue; // driver online but no active batch → not en route

    const pendingStops = stopsByBatch.get(batchId) ?? [];
    const count = pendingStops.length;

    // ETA = aktive Stopps × MIN_PER_STOP + Rückfahrt
    const driverLat = (driver.current_lat as number) ?? hubLat;
    const driverLng = (driver.current_lng as number) ?? hubLng;
    const returnKm = haversineKm(driverLat, driverLng, hubLat, hubLng);
    const returnDriveMin = Math.round(returnKm / 30 * 60); // 30 km/h Stadtdurchschnitt
    const etaMin = count * MIN_PER_STOP + returnDriveMin;

    const rueckkehrTime = new Date(now.getTime() + etaMin * 60_000);
    const rueckkehrUhrzeit = rueckkehrTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    const status: 'unterwegs' | 'letzter_stopp' | 'fast_zurueck' =
      count === 0 ? 'fast_zurueck' :
      count === 1 ? 'letzter_stopp' : 'unterwegs';

    result.push({
      fahrer_id: driver.id,
      fahrer_name: driver.name ?? 'Unbekannt',
      aktive_stopps: count,
      rueckkehr_eta_min: Math.max(0, etaMin),
      rueckkehr_uhrzeit: rueckkehrUhrzeit,
      km_zum_ziel: Math.round(returnKm * 10) / 10,
      status,
    });
  }

  result.sort((a, b) => a.rueckkehr_eta_min - b.rueckkehr_eta_min);

  return NextResponse.json({ fahrer: result, generatedAt: now.toISOString() });
}
