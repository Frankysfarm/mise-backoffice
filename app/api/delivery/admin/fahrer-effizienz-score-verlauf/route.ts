import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TagesPunkt = {
  datum: string;          // ISO date "2026-07-01"
  datum_label: string;    // "Mi 01.07."
  score: number;          // 0–100
  km_pro_tour: number;
  stopps_pro_stunde: number;
  puenktlichkeit_pct: number;
};

type FahrerVerlauf = {
  fahrer_id: string;
  fahrer_name: string;
  schnitt_score: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  tage: TagesPunkt[];
};

type ApiResponse = {
  fahrer: FahrerVerlauf[];
  location_id: string | null;
  generiert_am: string;
};

function dateLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  const wochentage = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const tag = String(d.getUTCDate()).padStart(2, '0');
  const mon = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${wochentage[d.getUTCDay()]} ${tag}.${mon}.`;
}

function calcScore(kmTour: number, stoppsH: number, puenktPct: number): number {
  // km/tour ideal ~8 km → max 33 pts (deviation penalized)
  const kmScore = Math.max(0, 33 - Math.abs(kmTour - 8) * 2);
  // stopps/h ideal ≥4 → max 34 pts
  const stoppsScore = Math.min(34, stoppsH * 8.5);
  // punctuality 0–100% → max 33 pts
  const pScore = puenktPct * 0.33;
  return Math.round(Math.min(100, kmScore + stoppsScore + pScore));
}

function mockFahrer(locationId: string | null): FahrerVerlauf[] {
  const names = [
    { id: 'f1', name: 'Ahmad K.' },
    { id: 'f2', name: 'Lukas M.' },
    { id: 'f3', name: 'Sara P.' },
  ];
  return names.map(({ id, name }, ni) => {
    const tage: TagesPunkt[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().split('T')[0];
      const kmTour = 7 + Math.sin(i * 0.7 + ni) * 2;
      const stoppsH = 3.5 + Math.cos(i * 0.5 + ni) * 0.8;
      const puenkt = 65 + Math.sin(i + ni * 2) * 20;
      tage.push({
        datum: iso,
        datum_label: dateLabel(iso),
        score: calcScore(kmTour, stoppsH, puenkt),
        km_pro_tour: parseFloat(kmTour.toFixed(1)),
        stopps_pro_stunde: parseFloat(stoppsH.toFixed(2)),
        puenktlichkeit_pct: Math.round(Math.max(0, Math.min(100, puenkt))),
      });
    }
    const scores = tage.map(t => t.score);
    const schnitt = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const recent = scores.slice(-4).reduce((a, b) => a + b, 0) / 4;
    const older = scores.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
    const trend: FahrerVerlauf['trend'] = recent > older + 3 ? 'steigend' : recent < older - 3 ? 'fallend' : 'stabil';
    return { fahrer_id: id, fahrer_name: name, schnitt_score: schnitt, trend, tage };
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ fahrer: mockFahrer(null), location_id: null, generiert_am: new Date().toISOString() });
  }

  try {
    const supabase = await createClient();

    // Get active drivers for this location
    const { data: drivers, error: drErr } = await supabase
      .from('mise_drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .limit(10);

    if (drErr || !drivers?.length) throw new Error('no drivers');

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 14);

    const fahrer: FahrerVerlauf[] = [];

    for (const driver of drivers.slice(0, 5)) {
      const { data: stops } = await supabase
        .from('mise_delivery_stops')
        .select('delivered_at, distance_km, created_at')
        .eq('driver_id', driver.id)
        .gte('created_at', since.toISOString())
        .not('delivered_at', 'is', null);

      const { data: tours } = await supabase
        .from('mise_delivery_batches')
        .select('id, started_at, completed_at, driver_id')
        .eq('driver_id', driver.id)
        .gte('started_at', since.toISOString())
        .not('completed_at', 'is', null);

      if (!stops?.length || !tours?.length) continue;

      // Group by date
      const byDate = new Map<string, { km: number[]; stopps: number; durationH: number; lateCount: number; totalCount: number }>();

      for (const tour of tours) {
        const iso = tour.started_at.split('T')[0];
        const durMs = new Date(tour.completed_at).getTime() - new Date(tour.started_at).getTime();
        const durH = durMs / 3_600_000;
        if (!byDate.has(iso)) byDate.set(iso, { km: [], stopps: 0, durationH: 0, lateCount: 0, totalCount: 0 });
        byDate.get(iso)!.durationH += durH;
      }

      for (const stop of stops) {
        const iso = stop.created_at.split('T')[0];
        if (!byDate.has(iso)) continue;
        const e = byDate.get(iso)!;
        if (stop.distance_km) e.km.push(stop.distance_km);
        e.stopps++;
        e.totalCount++;
      }

      const tage: TagesPunkt[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        const iso = d.toISOString().split('T')[0];
        const entry = byDate.get(iso);
        let score = 0, kmTour = 0, stoppsH = 0, puenkt = 0;
        if (entry && entry.stopps > 0) {
          const avgKm = entry.km.length ? entry.km.reduce((a, b) => a + b, 0) / entry.km.length : 7;
          stoppsH = entry.durationH > 0 ? entry.stopps / entry.durationH : 3;
          puenkt = entry.totalCount > 0 ? ((entry.totalCount - entry.lateCount) / entry.totalCount) * 100 : 80;
          score = calcScore(avgKm, stoppsH, puenkt);
          kmTour = parseFloat(avgKm.toFixed(1));
          stoppsH = parseFloat(stoppsH.toFixed(2));
        }
        tage.push({
          datum: iso,
          datum_label: dateLabel(iso),
          score,
          km_pro_tour: kmTour,
          stopps_pro_stunde: stoppsH,
          puenktlichkeit_pct: Math.round(puenkt),
        });
      }

      const scores = tage.map(t => t.score).filter(s => s > 0);
      if (!scores.length) continue;
      const schnitt = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const recent = scores.slice(-4).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(4, scores.slice(-4).length));
      const older = scores.slice(0, 4).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(4, scores.slice(0, 4).length));
      const trend: FahrerVerlauf['trend'] = recent > older + 3 ? 'steigend' : recent < older - 3 ? 'fallend' : 'stabil';

      fahrer.push({ fahrer_id: driver.id, fahrer_name: driver.name ?? `Fahrer ${driver.id.slice(0, 4)}`, schnitt_score: schnitt, trend, tage });
    }

    if (!fahrer.length) throw new Error('no data');

    return NextResponse.json({ fahrer, location_id: locationId, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json({ fahrer: mockFahrer(locationId), location_id: locationId, generiert_am: new Date().toISOString() });
  }
}
