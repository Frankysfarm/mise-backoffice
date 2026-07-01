/**
 * GET /api/delivery/admin/tour-route-efficiency?location_id=...
 *
 * Phase 528 — Tour-Reihenfolge-Optimierungs-Score
 * Berechnet für jede aktive Tour wie optimal die aktuelle Stop-Reihenfolge ist
 * im Vergleich zur kürzesten möglichen Route (Nearest-Neighbour-Heuristik).
 *
 * Response: { ok, tours: TourRouteEfficiency[], summary: RouteSummary, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type RouteAlertLevel = 'optimal' | 'acceptable' | 'suboptimal' | 'poor';

export interface TourRouteEfficiency {
  tourId: string;
  driverName: string | null;
  zone: string | null;
  stopCount: number;
  currentDistKm: number;
  optimalDistKm: number;
  efficiencyPct: number;
  alertLevel: RouteAlertLevel;
  status: string;
}

export interface RouteSummary {
  activeTours: number;
  avgEfficiencyPct: number;
  poorTours: number;
  totalCurrentDistKm: number;
  totalOptimalDistKm: number;
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

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

interface Coord { lat: number; lng: number }

function sequenceDistance(coords: Coord[]): number {
  let dist = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    dist += haversineKm(coords[i].lat, coords[i].lng, coords[i + 1].lat, coords[i + 1].lng);
  }
  return dist;
}

// Nearest-Neighbour TSP heuristic starting from first stop
function nearestNeighbourDistance(coords: Coord[]): number {
  if (coords.length <= 1) return 0;
  const visited = new Set<number>();
  visited.add(0);
  let current = 0;
  let totalDist = 0;

  while (visited.size < coords.length) {
    let bestDist = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < coords.length; i++) {
      if (visited.has(i)) continue;
      const d = haversineKm(
        coords[current].lat, coords[current].lng,
        coords[i].lat, coords[i].lng,
      );
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx === -1) break;
    visited.add(bestIdx);
    totalDist += bestDist;
    current = bestIdx;
  }
  return totalDist;
}

function routeAlertLevel(effPct: number): RouteAlertLevel {
  if (effPct >= 90) return 'optimal';
  if (effPct >= 75) return 'acceptable';
  if (effPct >= 60) return 'suboptimal';
  return 'poor';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();

  // Aktive Batches mit Fahrer
  const { data: batchRows } = await ssb
    .from('mise_delivery_batches')
    .select('id, zone, status, driver:driver_id(name)')
    .eq('location_id', locationId)
    .not('status', 'in', '("abgeschlossen","completed","abgebrochen","cancelled")');

  type BatchRow = {
    id: string;
    zone: string | null;
    status: string;
    driver: { name: string | null } | { name: string | null }[] | null;
  };
  const batches = (batchRows ?? []) as unknown as BatchRow[];

  if (batches.length === 0) {
    return NextResponse.json({
      ok: true,
      tours: [],
      summary: { activeTours: 0, avgEfficiencyPct: 100, poorTours: 0, totalCurrentDistKm: 0, totalOptimalDistKm: 0 },
      generatedAt: new Date().toISOString(),
    });
  }

  const batchIds = batches.map((b) => b.id);

  // Stopps mit Reihenfolge und Order-ID
  const { data: stopRows } = await ssb
    .from('mise_delivery_batch_stops')
    .select('batch_id, order_id, sort_order, status')
    .in('batch_id', batchIds)
    .not('status', 'in', '("delivered","geliefert","completed")')
    .order('sort_order', { ascending: true });

  type StopRow = {
    batch_id: string;
    order_id: string | null;
    sort_order: number | null;
    status: string;
  };
  const stops = (stopRows ?? []) as StopRow[];

  // Bestellungs-Koordinaten
  const orderIds = [...new Set(stops.map((s) => s.order_id).filter(Boolean) as string[])];

  const coordMap = new Map<string, Coord>();
  if (orderIds.length > 0) {
    const { data: orderRows } = await ssb
      .from('customer_orders')
      .select('id, kunde_lat, kunde_lng')
      .in('id', orderIds);

    type OrderCoord = { id: string; kunde_lat: number | null; kunde_lng: number | null };
    const orders = (orderRows ?? []) as OrderCoord[];
    for (const o of orders) {
      if (o.kunde_lat != null && o.kunde_lng != null) {
        coordMap.set(o.id, { lat: o.kunde_lat, lng: o.kunde_lng });
      }
    }
  }

  const tours: TourRouteEfficiency[] = [];

  for (const batch of batches) {
    const batchStops = stops
      .filter((s) => s.batch_id === batch.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const coords = batchStops
      .map((s) => (s.order_id ? coordMap.get(s.order_id) : undefined))
      .filter((c): c is Coord => c !== undefined);

    const driverRaw = batch.driver;
    const driverName = Array.isArray(driverRaw)
      ? (driverRaw[0]?.name ?? null)
      : (driverRaw?.name ?? null);

    if (coords.length < 2) {
      // Not enough coords for efficiency calc — treat as optimal
      tours.push({
        tourId: batch.id,
        driverName,
        zone: batch.zone,
        stopCount: batchStops.length,
        currentDistKm: 0,
        optimalDistKm: 0,
        efficiencyPct: 100,
        alertLevel: 'optimal',
        status: batch.status,
      });
      continue;
    }

    const currentDistKm = Math.round(sequenceDistance(coords) * 100) / 100;
    const optimalDistKm = Math.round(nearestNeighbourDistance(coords) * 100) / 100;

    const efficiencyPct =
      currentDistKm > 0
        ? Math.min(100, Math.round((optimalDistKm / currentDistKm) * 100))
        : 100;

    tours.push({
      tourId: batch.id,
      driverName,
      zone: batch.zone,
      stopCount: batchStops.length,
      currentDistKm,
      optimalDistKm,
      efficiencyPct,
      alertLevel: routeAlertLevel(efficiencyPct),
      status: batch.status,
    });
  }

  const activeTours = tours.length;
  const avgEfficiencyPct =
    activeTours > 0
      ? Math.round(tours.reduce((s, t) => s + t.efficiencyPct, 0) / activeTours)
      : 100;
  const poorTours = tours.filter((t) => t.alertLevel === 'poor' || t.alertLevel === 'suboptimal').length;
  const totalCurrentDistKm = Math.round(tours.reduce((s, t) => s + t.currentDistKm, 0) * 100) / 100;
  const totalOptimalDistKm = Math.round(tours.reduce((s, t) => s + t.optimalDistKm, 0) * 100) / 100;

  return NextResponse.json({
    ok: true,
    tours: tours.sort((a, b) => a.efficiencyPct - b.efficiencyPct),
    summary: { activeTours, avgEfficiencyPct, poorTours, totalCurrentDistKm, totalOptimalDistKm },
    generatedAt: new Date().toISOString(),
  });
}
