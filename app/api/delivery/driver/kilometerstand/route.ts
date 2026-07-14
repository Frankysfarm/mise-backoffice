/**
 * GET /api/delivery/driver/kilometerstand?driver_id=<uuid>
 *
 * Phase 1510 - Kilometerstand-Tracker-API (Fahrer)
 * Heutige km + laufender Durchschnitt je Tour + Wochentrend (letzte 7 Tage).
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface KilometerstandData {
  km_heute: number;
  km_je_tour_schnitt: number;
  touren_heute: number;
  wochentrend: { tag: string; km: number }[];
  woche_gesamt_km: number;
}

function buildMock(driverId: string): KilometerstandData {
  const seed = (driverId.charCodeAt(0) ?? 77) % 7;
  const wochentrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
    const tag = d.toLocaleDateString('de-DE', { weekday: 'short' });
    return { tag, km: 15 + ((seed + i) % 5) * 4 };
  });
  const kmHeute = wochentrend[6]?.km ?? 22;
  const wocheGesamt = wochentrend.reduce((s, d) => s + d.km, 0);
  return {
    km_heute: kmHeute,
    km_je_tour_schnitt: parseFloat((kmHeute / (2 + seed % 3)).toFixed(1)),
    touren_heute: 2 + seed % 3,
    wochentrend,
    woche_gesamt_km: wocheGesamt,
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const { data: batches } = await (sb as any)
      .from('mise_delivery_batches')
      .select('id, gesamt_km, created_at')
      .eq('driver_id', driverId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .not('gesamt_km', 'is', null);

    if (!batches || (batches as unknown[]).length === 0) {
      return NextResponse.json(buildMock(driverId));
    }

    type BatchRow = { id: string; gesamt_km: number; created_at: string };
    const rows = batches as BatchRow[];

    const tagesRows = rows.filter(b => new Date(b.created_at) >= todayStart);
    const kmHeute = tagesRows.reduce((s, b) => s + (b.gesamt_km ?? 0), 0);
    const tourenHeute = tagesRows.length;
    const kmJeTour = tourenHeute > 0 ? parseFloat((kmHeute / tourenHeute).toFixed(1)) : 0;

    const wocheGesamt = rows.reduce((s, b) => s + (b.gesamt_km ?? 0), 0);

    const dayMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toLocaleDateString('de-DE', { weekday: 'short' });
      dayMap.set(key, 0);
    }
    rows.forEach(b => {
      const key = new Date(b.created_at).toLocaleDateString('de-DE', { weekday: 'short' });
      if (dayMap.has(key)) {
        dayMap.set(key, (dayMap.get(key) ?? 0) + (b.gesamt_km ?? 0));
      }
    });
    const wochentrend = Array.from(dayMap.entries()).map(([tag, km]) => ({ tag, km: parseFloat(km.toFixed(1)) }));

    return NextResponse.json({
      km_heute: parseFloat(kmHeute.toFixed(1)),
      km_je_tour_schnitt: kmJeTour,
      touren_heute: tourenHeute,
      wochentrend,
      woche_gesamt_km: parseFloat(wocheGesamt.toFixed(1)),
    } satisfies KilometerstandData);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
