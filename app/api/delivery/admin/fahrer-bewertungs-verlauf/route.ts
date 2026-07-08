/**
 * GET /api/delivery/admin/fahrer-bewertungs-verlauf?location_id=<uuid>&tage=14
 *
 * Phase 761 — Fahrer-Bewertungs-Verlauf-API
 * Ø-Bewertung je Fahrer + täglicher Trend der letzten N Tage.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');
  const tage = Math.min(30, Math.max(1, parseInt(url.searchParams.get('tage') ?? '14', 10)));

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const sb = await createClient();
  const seit = new Date(Date.now() - tage * 86_400_000).toISOString();

  const { data: feedbacks } = await sb
    .from('delivery_feedback')
    .select('driver_id, rating, created_at, employees!inner(vorname, nachname)')
    .eq('location_id', locationId)
    .gte('created_at', seit)
    .not('rating', 'is', null);

  const fahrerMap = new Map<string, { name: string; ratings: number[]; tage: Map<string, number[]> }>();

  for (const f of feedbacks ?? []) {
    const emp = f.employees as { vorname: string; nachname: string } | null;
    const name = emp ? `${emp.vorname} ${emp.nachname}` : 'Unbekannt';
    const dayStr = (f.created_at as string).slice(0, 10);
    const rating = Number(f.rating);

    if (!fahrerMap.has(f.driver_id)) {
      fahrerMap.set(f.driver_id, { name, ratings: [], tage: new Map() });
    }
    const entry = fahrerMap.get(f.driver_id)!;
    entry.ratings.push(rating);
    const dayRatings = entry.tage.get(dayStr) ?? [];
    dayRatings.push(rating);
    entry.tage.set(dayStr, dayRatings);
  }

  const fahrer = Array.from(fahrerMap.entries()).map(([id, { name, ratings, tage: tageMap }]) => {
    const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
    const tageVerlauf = Array.from(tageMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([datum, rs]) => ({ datum, avg: Math.round((rs.reduce((s, r) => s + r, 0) / rs.length) * 10) / 10 }));
    return { driver_id: id, name, avg_rating: Math.round(avg * 10) / 10, anzahl: ratings.length, tage_verlauf: tageVerlauf };
  }).sort((a, b) => b.avg_rating - a.avg_rating);

  return NextResponse.json({ fahrer, tage });
}
