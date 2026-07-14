/**
 * GET /api/delivery/admin/fahrer-bewertungen?location_id=<uuid>
 *
 * Phase 1547 — Fahrer-Bewertungs-Aggregat-API
 * Ø Kundenbewertung je Fahrer heute + 7-Tage-Trend + Top-3/Flop-3
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerBewertung {
  driver_id: string;
  name: string;
  avg_heute: number;
  avg_7tage: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  anzahl_heute: number;
  anzahl_7tage: number;
}

function mockData(): { fahrer: FahrerBewertung[]; top3: FahrerBewertung[]; flop3: FahrerBewertung[] } {
  const fahrer: FahrerBewertung[] = [
    { driver_id: 'd1', name: 'Ali Yilmaz',     avg_heute: 4.9, avg_7tage: 4.7, trend: 'steigend', anzahl_heute: 8,  anzahl_7tage: 52 },
    { driver_id: 'd2', name: 'Max Müller',      avg_heute: 4.7, avg_7tage: 4.6, trend: 'stabil',   anzahl_heute: 6,  anzahl_7tage: 41 },
    { driver_id: 'd3', name: 'Sara Hassan',     avg_heute: 4.5, avg_7tage: 4.5, trend: 'stabil',   anzahl_heute: 9,  anzahl_7tage: 63 },
    { driver_id: 'd4', name: 'Jonas Weber',     avg_heute: 3.8, avg_7tage: 4.1, trend: 'fallend',  anzahl_heute: 5,  anzahl_7tage: 34 },
    { driver_id: 'd5', name: 'Leila Khoury',   avg_heute: 3.5, avg_7tage: 3.7, trend: 'fallend',  anzahl_heute: 4,  anzahl_7tage: 27 },
    { driver_id: 'd6', name: 'Tom Fischer',     avg_heute: 2.9, avg_7tage: 3.2, trend: 'fallend',  anzahl_heute: 3,  anzahl_7tage: 19 },
  ];
  const sorted = [...fahrer].sort((a, b) => b.avg_heute - a.avg_heute);
  return { fahrer: sorted, top3: sorted.slice(0, 3), flop3: sorted.slice(-3).reverse() };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const { data: feedbacks } = await sb
      .from('delivery_feedback')
      .select('driver_id, rating, created_at, employees!inner(vorname, nachname)')
      .eq('location_id', locationId)
      .gte('created_at', sevenDaysAgo)
      .not('rating', 'is', null);

    if (!feedbacks || feedbacks.length === 0) {
      return NextResponse.json(mockData());
    }

    const todayStr = todayStart.toISOString().slice(0, 10);
    const fahrerMap = new Map<string, {
      name: string;
      ratingsHeute: number[];
      ratings7Tage: number[];
      ratingsVorwoche: number[];
    }>();

    for (const f of feedbacks) {
      const emps = f.employees as unknown as { vorname: string; nachname: string }[] | null;
      const emp = Array.isArray(emps) ? emps[0] : null;
      const name = emp ? `${emp.vorname} ${emp.nachname}` : 'Fahrer';
      const rating = Number(f.rating);
      const dayStr = (f.created_at as string).slice(0, 10);

      if (!fahrerMap.has(f.driver_id)) {
        fahrerMap.set(f.driver_id, { name, ratingsHeute: [], ratings7Tage: [], ratingsVorwoche: [] });
      }
      const entry = fahrerMap.get(f.driver_id)!;
      entry.ratings7Tage.push(rating);
      if (dayStr === todayStr) entry.ratingsHeute.push(rating);
      else entry.ratingsVorwoche.push(rating);
    }

    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, r) => s + r, 0) / arr.length * 10) / 10 : 0;

    const fahrer: FahrerBewertung[] = Array.from(fahrerMap.entries()).map(([id, e]) => {
      const avgHeute = avg(e.ratingsHeute);
      const avgVorwoche = avg(e.ratingsVorwoche);
      const avg7Tage = avg(e.ratings7Tage);
      let trend: FahrerBewertung['trend'] = 'stabil';
      if (avgHeute > avgVorwoche + 0.2) trend = 'steigend';
      else if (avgHeute < avgVorwoche - 0.2) trend = 'fallend';
      return {
        driver_id: id,
        name: e.name,
        avg_heute: avgHeute,
        avg_7tage: avg7Tage,
        trend,
        anzahl_heute: e.ratingsHeute.length,
        anzahl_7tage: e.ratings7Tage.length,
      };
    }).sort((a, b) => b.avg_heute - a.avg_heute);

    const top3 = fahrer.slice(0, 3);
    const flop3 = fahrer.slice(-3).reverse();
    return NextResponse.json({ fahrer, top3, flop3 });
  } catch {
    return NextResponse.json(mockData());
  }
}
