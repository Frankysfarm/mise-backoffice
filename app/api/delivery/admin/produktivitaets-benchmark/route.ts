/**
 * GET /api/delivery/admin/produktivitaets-benchmark?location_id=<uuid>
 *
 * Phase 846 — Fahrer-Produktivitäts-Benchmark-API
 * Vergleicht jeden Fahrer mit dem Locations-Durchschnitt (Stopps/h, km/Stopp, Pünktlichkeit, Bewertung).
 * Gibt Rang + prozentuale Abweichung vom Ø aus.
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

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const seit7d = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();

  // Lade alle Fahrer der Location
  const { data: drivers } = await sb
    .from('drivers')
    .select('id, name')
    .eq('location_id', locationId);

  if (!drivers || drivers.length === 0) {
    return NextResponse.json({ fahrer: [], location_avg: null, generatedAt: new Date().toISOString() });
  }

  // Lade Batches + Stopps der letzten 7 Tage
  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, driver_id, created_at, delivered_at, total_distance_km')
    .eq('location_id', locationId)
    .gte('created_at', seit7d)
    .not('driver_id', 'is', null);

  const { data: stops } = await sb
    .from('delivery_stops')
    .select('id, batch_id, delivered_at, scheduled_delivery_at, rating')
    .not('delivered_at', 'is', null);

  // Aggregiere je Fahrer
  const batchMap = new Map<string, typeof batches>(drivers.map(d => [d.id, []]));
  for (const b of batches ?? []) {
    if (b.driver_id && batchMap.has(b.driver_id)) {
      batchMap.get(b.driver_id)!.push(b as never);
    }
  }

  const stopsByBatch = new Map<string, { on_time: boolean; rating: number | null }[]>();
  for (const s of stops ?? []) {
    if (!s.batch_id) continue;
    if (!stopsByBatch.has(s.batch_id)) stopsByBatch.set(s.batch_id, []);
    const on_time = s.scheduled_delivery_at
      ? new Date(s.delivered_at as string) <= new Date(s.scheduled_delivery_at as string)
      : true;
    stopsByBatch.get(s.batch_id)!.push({ on_time, rating: s.rating as number | null });
  }

  const stats = drivers.map(d => {
    const driverBatches = (batchMap.get(d.id) as Array<{ id: string; created_at: string; delivered_at: string | null; total_distance_km: number | null }>) ?? [];
    let totalStopps = 0;
    let totalKm = 0;
    let totalMinuten = 0;
    let onTimeCount = 0;
    let totalWithSchedule = 0;
    const ratings: number[] = [];

    for (const b of driverBatches) {
      const bStops = stopsByBatch.get(b.id) ?? [];
      totalStopps += bStops.length;
      totalKm += b.total_distance_km ?? 0;
      if (b.delivered_at && b.created_at) {
        totalMinuten += (new Date(b.delivered_at).getTime() - new Date(b.created_at).getTime()) / 60_000;
      }
      for (const s of bStops) {
        if (s.rating != null) ratings.push(s.rating);
        totalWithSchedule++;
        if (s.on_time) onTimeCount++;
      }
    }

    const stunden = totalMinuten / 60;
    const stoppsProH = stunden > 0 ? totalStopps / stunden : 0;
    const kmProStopp = totalStopps > 0 ? totalKm / totalStopps : 0;
    const puenktlichkeitPct = totalWithSchedule > 0 ? (onTimeCount / totalWithSchedule) * 100 : 0;
    const avgBewertung = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;

    return {
      id: d.id,
      name: d.name,
      touren: driverBatches.length,
      stopps: totalStopps,
      stopps_pro_h: Math.round(stoppsProH * 10) / 10,
      km_pro_stopp: Math.round(kmProStopp * 10) / 10,
      puenktlichkeit_pct: Math.round(puenktlichkeitPct),
      avg_bewertung: avgBewertung != null ? Math.round(avgBewertung * 10) / 10 : null,
    };
  }).filter(s => s.touren > 0);

  if (stats.length === 0) {
    return NextResponse.json({ fahrer: [], location_avg: null, generatedAt: new Date().toISOString() });
  }

  // Locations-Durchschnitt
  const avg = {
    stopps_pro_h: stats.reduce((s, f) => s + f.stopps_pro_h, 0) / stats.length,
    km_pro_stopp: stats.reduce((s, f) => s + f.km_pro_stopp, 0) / stats.length,
    puenktlichkeit_pct: stats.reduce((s, f) => s + f.puenktlichkeit_pct, 0) / stats.length,
    avg_bewertung: (() => {
      const withRating = stats.filter(f => f.avg_bewertung != null);
      return withRating.length > 0 ? withRating.reduce((s, f) => s + f.avg_bewertung!, 0) / withRating.length : null;
    })(),
  };

  // Rang basierend auf gewichteter Summe (stopps_pro_h 40%, pünktlichkeit 35%, bewertung 25%)
  const scored = stats.map(f => {
    const score =
      (avg.stopps_pro_h > 0 ? (f.stopps_pro_h / avg.stopps_pro_h) : 1) * 40 +
      (avg.puenktlichkeit_pct > 0 ? (f.puenktlichkeit_pct / avg.puenktlichkeit_pct) : 1) * 35 +
      (avg.avg_bewertung && f.avg_bewertung ? (f.avg_bewertung / avg.avg_bewertung) : 1) * 25;
    const delta_stopps_pct = avg.stopps_pro_h > 0 ? Math.round(((f.stopps_pro_h - avg.stopps_pro_h) / avg.stopps_pro_h) * 100) : 0;
    const delta_puenkt_pct = Math.round(f.puenktlichkeit_pct - avg.puenktlichkeit_pct);
    return { ...f, score: Math.round(score), delta_stopps_pct, delta_puenkt_pct };
  }).sort((a, b) => b.score - a.score).map((f, i) => ({ ...f, rang: i + 1 }));

  return NextResponse.json({
    fahrer: scored,
    location_avg: {
      stopps_pro_h: Math.round(avg.stopps_pro_h * 10) / 10,
      km_pro_stopp: Math.round(avg.km_pro_stopp * 10) / 10,
      puenktlichkeit_pct: Math.round(avg.puenktlichkeit_pct),
      avg_bewertung: avg.avg_bewertung != null ? Math.round(avg.avg_bewertung * 10) / 10 : null,
    },
    generatedAt: new Date().toISOString(),
  });
}
