/**
 * GET /api/delivery/admin/fahrer-rueckkehr-prognose-v2?location_id=<uuid>
 *
 * Phase 726 — Fahrer-Rückkehr-Prognose V2
 * Verbesserte ETA für aktive Fahrer-Rückkehr zur Basis:
 *   - Verbleibende Stops → km × 30 km/h Stadtverkehr
 *   - + 5 Min pro Stop (Abladen/Klingeln)
 *   - GPS-Basis-Distanz aus Haversine wenn lat/lng vorhanden
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AVG_SPEED_KMH = 30;
const MIN_PER_STOP = 5;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface FahrerPrognose {
  driver_id: string;
  name: string;
  verbleibende_stops: number;
  geschaetzte_km: number;
  eta_minuten: number;
  eta_uhrzeit: string;
}

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('location_id');
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

  // Get location base coordinates
  const { data: loc } = await sb
    .from('locations')
    .select('lat, lng')
    .eq('id', locationId)
    .maybeSingle();

  // Get active batches
  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, driver_id, distance_km, orders_count')
    .eq('location_id', locationId)
    .eq('status', 'in_progress')
    .not('driver_id', 'is', null);

  if (!batches || batches.length === 0) {
    return NextResponse.json({ fahrer: [] });
  }

  const driverIds = [...new Set(batches.map((b) => b.driver_id as string))];

  // Get driver names and GPS positions
  const { data: drivers } = await sb
    .from('drivers')
    .select('id, name, lat, lng')
    .in('id', driverIds);

  const driverMap: Record<string, { name: string; lat: number | null; lng: number | null }> = {};
  (drivers ?? []).forEach((d) => {
    driverMap[d.id] = { name: d.name ?? d.id.slice(0, 8), lat: d.lat ?? null, lng: d.lng ?? null };
  });

  // Get pending stops per batch
  const { data: allStops } = await sb
    .from('delivery_stops')
    .select('batch_id, status')
    .in('batch_id', batches.map((b) => b.id));

  const stopsMap: Record<string, number> = {};
  (allStops ?? []).forEach((s) => {
    if (s.status === 'pending') {
      stopsMap[s.batch_id] = (stopsMap[s.batch_id] ?? 0) + 1;
    }
  });

  const fahrer: FahrerPrognose[] = driverIds.map((driverId) => {
    const driverBatches = batches.filter((b) => b.driver_id === driverId);
    const totalPendingStops = driverBatches.reduce((s, b) => s + (stopsMap[b.id] ?? b.orders_count ?? 2), 0);
    const driver = driverMap[driverId];

    let estimatedKm = totalPendingStops * 2.5; // default 2.5 km per stop

    // Improve estimate with GPS if available
    if (driver?.lat && driver?.lng && loc?.lat && loc?.lng) {
      const distToBase = haversineKm(driver.lat, driver.lng, loc.lat, loc.lng);
      estimatedKm = distToBase + totalPendingStops * 1.5; // GPS + 1.5km per remaining stop
    }

    const driveMin = (estimatedKm / AVG_SPEED_KMH) * 60;
    const stopMin = totalPendingStops * MIN_PER_STOP;
    const etaMin = Math.round(driveMin + stopMin);

    const etaTime = new Date(Date.now() + etaMin * 60_000);
    const etaUhrzeit = etaTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    return {
      driver_id: driverId,
      name: driver?.name ?? driverId.slice(0, 8),
      verbleibende_stops: totalPendingStops,
      geschaetzte_km: Math.round(estimatedKm * 10) / 10,
      eta_minuten: etaMin,
      eta_uhrzeit: etaUhrzeit,
    };
  });

  fahrer.sort((a, b) => a.eta_minuten - b.eta_minuten);

  return NextResponse.json({ fahrer });
}
