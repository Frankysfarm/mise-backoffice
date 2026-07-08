/**
 * GET /api/delivery/admin/fahrer-km-bilanz?location_id=<uuid>
 *
 * Phase 746 — Fahrer-km-Bilanz-API
 * Gesamt-km heute vs. gleicher Wochentag letzte Woche pro Fahrer.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const sb = await createClient();
  const now = new Date();

  // Heute: ab 05:00 UTC
  const heuteStart = new Date(now);
  heuteStart.setUTCHours(5, 0, 0, 0);
  if (now.getUTCHours() < 5) heuteStart.setUTCDate(heuteStart.getUTCDate() - 1);

  // Vorwoche: gleicher Wochentag
  const vorwocheStart = new Date(heuteStart);
  vorwocheStart.setUTCDate(vorwocheStart.getUTCDate() - 7);
  const vorwocheEnde = new Date(vorwocheStart);
  vorwocheEnde.setUTCHours(vorwocheEnde.getUTCHours() + 24);

  const [{ data: heuteData }, { data: vorwocheData }] = await Promise.all([
    sb.from('delivery_batches')
      .select('driver_id, distance_km, employees!inner(vorname, nachname)')
      .eq('location_id', locationId)
      .eq('status', 'completed')
      .gte('completed_at', heuteStart.toISOString()),
    sb.from('delivery_batches')
      .select('driver_id, distance_km')
      .eq('location_id', locationId)
      .eq('status', 'completed')
      .gte('completed_at', vorwocheStart.toISOString())
      .lt('completed_at', vorwocheEnde.toISOString()),
  ]);

  const heuteMap = new Map<string, { km: number; name: string }>();
  for (const b of heuteData ?? []) {
    const emp = b.employees as { vorname: string; nachname: string } | null;
    const name = emp ? `${emp.vorname} ${emp.nachname}` : 'Unbekannt';
    const prev = heuteMap.get(b.driver_id) ?? { km: 0, name };
    prev.km += b.distance_km ?? 0;
    heuteMap.set(b.driver_id, prev);
  }

  const vorwocheMap = new Map<string, number>();
  for (const b of vorwocheData ?? []) {
    vorwocheMap.set(b.driver_id, (vorwocheMap.get(b.driver_id) ?? 0) + (b.distance_km ?? 0));
  }

  const fahrer = Array.from(heuteMap.entries()).map(([id, { km, name }]) => {
    const vw = vorwocheMap.get(id) ?? 0;
    const delta = km - vw;
    return {
      driver_id: id,
      name,
      km_heute: Math.round(km * 10) / 10,
      km_vorwoche: Math.round(vw * 10) / 10,
      delta_km: Math.round(delta * 10) / 10,
      trend: delta > 1 ? 'up' : delta < -1 ? 'down' : 'gleich',
    };
  }).sort((a, b) => b.km_heute - a.km_heute);

  return NextResponse.json({ fahrer, gesamt_km_heute: Math.round(fahrer.reduce((s, f) => s + f.km_heute, 0) * 10) / 10 });
}
