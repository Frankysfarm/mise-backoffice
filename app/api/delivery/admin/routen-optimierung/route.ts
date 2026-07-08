/**
 * GET /api/delivery/admin/routen-optimierung?tour_id=<uuid>&location_id=<uuid>
 *
 * Phase 841 — Fahrer-Routen-Optimierungs-API
 * Nearest-Neighbor-Algorithmus optimiert Stopp-Reihenfolge einer Tour.
 * Gibt optimierte Reihenfolge + Zeitersparnis vs. Originalreihenfolge aus.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

interface Stop {
  id: string;
  reihenfolge: number;
  lat: number | null;
  lng: number | null;
  kunde_name: string | null;
  kunde_adresse: string | null;
  geliefert_am: string | null;
}

function nearestNeighbor(stops: Stop[], startLat: number, startLng: number): Stop[] {
  const remaining = [...stops];
  const ordered: Stop[] = [];
  let curLat = startLat;
  let curLng = startLng;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      if (s.lat == null || s.lng == null) {
        if (bestDist === Infinity) bestIdx = i;
        continue;
      }
      const d = haversineKm(curLat, curLng, s.lat, s.lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    ordered.push(chosen);
    if (chosen.lat != null && chosen.lng != null) {
      curLat = chosen.lat;
      curLng = chosen.lng;
    }
  }

  return ordered;
}

function totalRouteKm(stops: Stop[], startLat: number, startLng: number): number {
  let km = 0;
  let curLat = startLat;
  let curLng = startLng;
  for (const s of stops) {
    if (s.lat != null && s.lng != null) {
      km += haversineKm(curLat, curLng, s.lat, s.lng);
      curLat = s.lat;
      curLng = s.lng;
    }
  }
  return km;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const tourId = url.searchParams.get('tour_id');

  if (!tourId) return NextResponse.json({ error: 'tour_id required' }, { status: 400 });

  const sb = await createClient();

  const { data: tour } = await sb
    .from('delivery_batches')
    .select('id, location_id, started_at, fahrer_id, driver_id')
    .eq('id', tourId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!tour) return NextResponse.json({ error: 'Tour not found' }, { status: 404 });

  const driverId = (tour as any).fahrer_id ?? (tour as any).driver_id;

  let startLat = 48.1351;
  let startLng = 11.5820;

  if (driverId) {
    const { data: pos } = await sb
      .from('driver_locations')
      .select('lat, lng')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pos?.lat && pos?.lng) {
      startLat = pos.lat;
      startLng = pos.lng;
    }
  }

  const { data: stopsRaw } = await sb
    .from('delivery_stops')
    .select('id, reihenfolge, lat, lng, kunde_name, kunde_adresse, geliefert_am, order_id')
    .eq('batch_id', tourId)
    .order('reihenfolge', { ascending: true });

  const stops: Stop[] = (stopsRaw ?? []).map((s: any) => ({
    id: s.id,
    reihenfolge: s.reihenfolge ?? 0,
    lat: s.lat ?? null,
    lng: s.lng ?? null,
    kunde_name: s.kunde_name ?? null,
    kunde_adresse: s.kunde_adresse ?? null,
    geliefert_am: s.geliefert_am ?? null,
  }));

  const pending = stops.filter(s => !s.geliefert_am);
  const done = stops.filter(s => s.geliefert_am);

  if (pending.length <= 1) {
    return NextResponse.json({
      tour_id: tourId,
      original_order: pending.map((s, i) => ({ ...s, pos: i + 1 })),
      optimized_order: pending.map((s, i) => ({ ...s, pos: i + 1 })),
      original_km: totalRouteKm(pending, startLat, startLng),
      optimized_km: totalRouteKm(pending, startLat, startLng),
      savings_km: 0,
      savings_min: 0,
      already_done: done.length,
      generatedAt: new Date().toISOString(),
    });
  }

  const originalKm = totalRouteKm(pending, startLat, startLng);
  const optimized = nearestNeighbor(pending, startLat, startLng);
  const optimizedKm = totalRouteKm(optimized, startLat, startLng);
  const savingsKm = Math.max(0, originalKm - optimizedKm);
  const savingsMin = Math.round((savingsKm / 30) * 60);

  return NextResponse.json({
    tour_id: tourId,
    original_order: pending.map((s, i) => ({ ...s, pos: i + 1 })),
    optimized_order: optimized.map((s, i) => ({ ...s, pos: i + 1 })),
    original_km: Math.round(originalKm * 10) / 10,
    optimized_km: Math.round(optimizedKm * 10) / 10,
    savings_km: Math.round(savingsKm * 10) / 10,
    savings_min: savingsMin,
    already_done: done.length,
    generatedAt: new Date().toISOString(),
  });
}
