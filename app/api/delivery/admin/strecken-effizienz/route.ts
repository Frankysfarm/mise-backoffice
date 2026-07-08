/**
 * GET /api/delivery/admin/strecken-effizienz?driver_id=X&location_id=Y
 *
 * Phase 849 — Strecken-Effizienz-Feedback-API
 * Letzte abgeschlossene Tour des Fahrers: optimale vs. gefahrene Route, Effizienz-Score, Tipp.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighborKm(coords: Array<{ lat: number; lon: number }>): number {
  if (coords.length <= 1) return 0;
  const visited = new Set<number>([0]);
  let current = 0;
  let total = 0;
  while (visited.size < coords.length) {
    let best = Infinity;
    let nextIdx = -1;
    for (let i = 0; i < coords.length; i++) {
      if (visited.has(i)) continue;
      const d = haversineKm(coords[current].lat, coords[current].lon, coords[i].lat, coords[i].lon);
      if (d < best) { best = d; nextIdx = i; }
    }
    if (nextIdx === -1) break;
    total += best;
    visited.add(nextIdx);
    current = nextIdx;
  }
  return total;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  const locationId = searchParams.get('location_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const sb = await createClient();

  // Letzte abgeschlossene Tour
  const q = sb
    .from('delivery_batches')
    .select('id, created_at, delivered_at, total_distance_km')
    .eq('driver_id', driverId)
    .not('delivered_at', 'is', null)
    .order('delivered_at', { ascending: false })
    .limit(1);

  if (locationId) q.eq('location_id', locationId);
  const { data: batches } = await q;
  const batch = batches?.[0];

  if (!batch) {
    return NextResponse.json({ letzte_tour: null, wochen_avg_score: null, generatedAt: new Date().toISOString() });
  }

  // Stopps + Koordinaten
  const { data: stops } = await sb
    .from('delivery_stops')
    .select('id, sequence_order, delivery_lat, delivery_lon')
    .eq('batch_id', batch.id)
    .order('sequence_order', { ascending: true });

  const coords = (stops ?? [])
    .filter(s => s.delivery_lat && s.delivery_lon)
    .map(s => ({ lat: s.delivery_lat as number, lon: s.delivery_lon as number }));

  const gefahreneKm = (batch.total_distance_km as number | null) ?? 0;
  const optimaleKm = nearestNeighborKm(coords);
  const mehrKm = Math.max(0, gefahreneKm - optimaleKm);
  const effizienz = optimaleKm > 0 ? Math.min(100, Math.round((optimaleKm / Math.max(gefahreneKm, 0.1)) * 100)) : 85;

  const label: 'sehr gut' | 'gut' | 'verbesserbar' | 'schlecht' =
    effizienz >= 90 ? 'sehr gut' : effizienz >= 75 ? 'gut' : effizienz >= 55 ? 'verbesserbar' : 'schlecht';

  const tipp = mehrKm < 0.5
    ? 'Ausgezeichnet! Deine Route war nahezu optimal.'
    : mehrKm < 2
    ? `Du hast ~${mehrKm.toFixed(1)} km mehr gefahren als nötig. Versuche Stopps nach Nähe zu sortieren.`
    : `${mehrKm.toFixed(1)} km Umweg erkannt. Optimiere die Reihenfolge: zunächst naheliegendste Stopps, dann weiter entfernte.`;

  // Wochenscores: letzte 7 abgeschlossene Touren
  const { data: recentBatches } = await sb
    .from('delivery_batches')
    .select('id, total_distance_km')
    .eq('driver_id', driverId)
    .not('delivered_at', 'is', null)
    .order('delivered_at', { ascending: false })
    .limit(7);

  let wochenAvg: number | null = null;
  if (recentBatches && recentBatches.length > 1) {
    const scores = recentBatches.map(b => {
      const km = (b.total_distance_km as number | null) ?? 0;
      return km > 0 ? Math.min(100, Math.round(85 * (1 - Math.min(km, 20) / 40))) : 80;
    });
    wochenAvg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  }

  const deliveredAt = new Date(batch.delivered_at as string);
  const now = new Date();
  const isToday = deliveredAt.toDateString() === now.toDateString();
  const zeitStr = isToday
    ? `Heute ${deliveredAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
    : deliveredAt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

  return NextResponse.json({
    letzte_tour: {
      tour_id: batch.id,
      datum: zeitStr,
      optimale_km: Math.round(optimaleKm * 10) / 10,
      gefahrene_km: Math.round(gefahreneKm * 10) / 10,
      effizienz_score: effizienz,
      effizienz_label: label,
      tipp,
      stopps: (stops ?? []).length,
    },
    wochen_avg_score: wochenAvg,
    generatedAt: new Date().toISOString(),
  });
}
