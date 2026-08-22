/**
 * lib/delivery/tour-optimizer.ts
 *
 * Routen-Optimierung für mehrstoppige Touren.
 * Nutzt Google Directions mit waypoint-optimize für echte TSP-Lösung.
 * Fallback auf Nearest-Neighbor-Heuristik wenn Google nicht verfügbar.
 */
import 'server-only';
import { directions, haversineKm } from '@/lib/google-maps';
import { createServiceClient } from '@/lib/supabase/server';

export interface TourStop {
  id: string;
  order_id: string;
  type: 'pickup' | 'dropoff';
  sequence: number;
  lat: number;
  lng: number;
  address: string | null;
}

export interface OptimizedTour {
  batchId: string;
  stops: TourStop[];
  totalDistanceKm: number;
  totalEtaMin: number;
  polyline: string | null;
  optimizedWithGoogle: boolean;
}

/**
 * Optimiert die Stop-Reihenfolge einer Tour und speichert das Ergebnis in der DB.
 * Strategie: Pickups immer zuerst (selbes Restaurant = kein Extraumweg),
 * dann Dropoffs via Google TSP oder Nearest-Neighbor.
 */
export async function optimizeTour(batchId: string): Promise<OptimizedTour> {
  const sb = createServiceClient();

  const { data: rawStops } = await sb
    .from('mise_delivery_batch_stops')
    .select('id, order_id, type, sequence, lat, lng, address')
    .eq('batch_id', batchId)
    .order('sequence', { ascending: true });

  const stops = (rawStops ?? []) as TourStop[];
  if (stops.length < 2) {
    return { batchId, stops, totalDistanceKm: 0, totalEtaMin: 0, polyline: null, optimizedWithGoogle: false };
  }

  const pickups = stops.filter((s) => s.type === 'pickup');
  const dropoffs = stops.filter((s) => s.type === 'dropoff');

  // Dedupliziere Pickups (selbes Restaurant → 1 Stop)
  const uniquePickups = deduplicatePickups(pickups);
  const validDropoffs = dropoffs.filter((s) => s.lat != null && s.lng != null);

  // Optimiere Dropoff-Reihenfolge
  let optimizedDropoffs: TourStop[];
  let polyline: string | null = null;
  let totalDistanceKm = 0;
  let totalEtaMin = 0;
  let optimizedWithGoogle = false;

  if (validDropoffs.length <= 1) {
    optimizedDropoffs = validDropoffs;
  } else {
    const result = await optimizeDropoffs(uniquePickups, validDropoffs);
    optimizedDropoffs = result.stops;
    polyline = result.polyline;
    totalDistanceKm = result.totalDistanceKm;
    totalEtaMin = result.totalEtaMin;
    optimizedWithGoogle = result.optimizedWithGoogle;
  }

  if (totalDistanceKm === 0) {
    totalDistanceKm = computeHaversineTotal([...uniquePickups, ...optimizedDropoffs]);
    totalEtaMin = Math.round((totalDistanceKm / 25) * 60); // 25 km/h Schnitt
  }

  // Neue Sequenz-Nummern zuweisen
  const resequenced: TourStop[] = [
    ...uniquePickups.map((s, i) => ({ ...s, sequence: i })),
    ...optimizedDropoffs.map((s, i) => ({ ...s, sequence: uniquePickups.length + i })),
  ];

  // DB updaten
  for (const s of resequenced) {
    await sb
      .from('mise_delivery_batch_stops')
      .update({ sequence: s.sequence })
      .eq('id', s.id);
  }

  await sb
    .from('mise_delivery_batches')
    .update({
      polyline,
      total_distance_km: Math.round(totalDistanceKm * 10) / 10,
      total_eta_min: totalEtaMin,
      stop_count: resequenced.length,
      optimized: true,
    })
    .eq('id', batchId);

  return { batchId, stops: resequenced, totalDistanceKm, totalEtaMin, polyline, optimizedWithGoogle };
}

async function optimizeDropoffs(
  pickups: TourStop[],
  dropoffs: TourStop[],
): Promise<{
  stops: TourStop[];
  polyline: string | null;
  totalDistanceKm: number;
  totalEtaMin: number;
  optimizedWithGoogle: boolean;
}> {
  const origin = pickups[pickups.length - 1] ?? dropoffs[0];
  const destination = dropoffs[dropoffs.length - 1];
  const waypoints = dropoffs.slice(0, -1).map((s) => ({ lat: s.lat, lng: s.lng }));

  try {
    const route = await directions({
      origin:      { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      waypoints,
      optimize: true,
      mode: 'driving',
    });

    // Waypoints in optimierter Reihenfolge neu sortieren
    const middle = dropoffs.slice(0, -1);
    const reordered = route.optimized_order.map((i) => middle[i]);
    const optimizedStops = [...reordered, destination];

    return {
      stops: optimizedStops,
      polyline: route.polyline,
      totalDistanceKm: route.total_distance_m / 1000,
      totalEtaMin: Math.round(route.total_duration_s / 60),
      optimizedWithGoogle: true,
    };
  } catch {
    // Fallback: Nearest-Neighbor
    const nnOrder = nearestNeighbor(origin, dropoffs);
    const km = computeHaversineTotal([origin, ...nnOrder]);
    return {
      stops: nnOrder,
      polyline: null,
      totalDistanceKm: km,
      totalEtaMin: Math.round((km / 25) * 60),
      optimizedWithGoogle: false,
    };
  }
}

function nearestNeighbor(start: { lat: number; lng: number }, stops: TourStop[]): TourStop[] {
  const remaining = [...stops];
  const result: TourStop[] = [];
  let current = start;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    result.push(next);
    current = next;
  }
  return result;
}

function computeHaversineTotal(points: Array<{ lat: number; lng: number }>): number {
  let km = 0;
  for (let i = 0; i < points.length - 1; i++) {
    km += haversineKm(points[i], points[i + 1]);
  }
  return km;
}

function deduplicatePickups(pickups: TourStop[]): TourStop[] {
  const seen = new Set<string>();
  return pickups.filter((p) => {
    const key = `${Math.round(p.lat * 1000)},${Math.round(p.lng * 1000)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
