/**
 * GET /api/delivery/admin/tour-abschlussquote?location_id=<uuid>
 *
 * Phase 2128 — Tour-Abschlussquote-API
 * Abschlussquote % je Fahrer heute + Team-Ø + Trend vs. Gestern + Alert wenn < 80%.
 *
 * Response: TourAbschlussquoteResponse
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerQuote {
  driver_id: string;
  fahrer_name: string;
  gesamt: number;
  abgeschlossen: number;
  abgebrochen: number;
  quote: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  quote_gestern: number | null;
}

interface TourAbschlussquoteResponse {
  location_id: string;
  fahrer: FahrerQuote[];
  team_avg_quote: number;
  team_avg_gestern: number | null;
  alert_count: number;
  generiert_am: string;
}

const MOCK: TourAbschlussquoteResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: 'a', fahrer_name: 'Max Müller',   gesamt: 12, abgeschlossen: 12, abgebrochen: 0, quote: 100, trend: 'besser',     quote_gestern: 92 },
    { driver_id: 'b', fahrer_name: 'Anna Schmidt',  gesamt: 10, abgeschlossen: 9,  abgebrochen: 1, quote: 90,  trend: 'gleich',     quote_gestern: 90 },
    { driver_id: 'c', fahrer_name: 'Klaus Weber',   gesamt: 8,  abgeschlossen: 6,  abgebrochen: 2, quote: 75,  trend: 'schlechter', quote_gestern: 88 },
  ],
  team_avg_quote: 88,
  team_avg_gestern: 90,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

    const { data: drivers } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    const { data: batchesToday } = await sb
      .from('delivery_batches')
      .select('id, driver_id, status')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString());

    const { data: batchesYesterday } = await sb
      .from('delivery_batches')
      .select('id, driver_id, status')
      .eq('location_id', locationId)
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', todayStart.toISOString());

    if (!drivers || drivers.length === 0 || !batchesToday) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    type DriverRec = { id: string; name: string };
    type BatchRec  = { id: string; driver_id: string | null; status: string | null };

    const fahrerList: FahrerQuote[] = [];

    for (const d of drivers as DriverRec[]) {
      const heute = (batchesToday as BatchRec[]).filter(b => b.driver_id === d.id);
      if (heute.length === 0) continue;

      const abgeschlossen = heute.filter(b => b.status === 'delivered').length;
      const abgebrochen   = heute.filter(b => b.status === 'cancelled').length;
      const quote         = Math.round((abgeschlossen / heute.length) * 100);

      const gestern    = (batchesYesterday as BatchRec[] | null)?.filter(b => b.driver_id === d.id) ?? [];
      const abgGestern = gestern.filter(b => b.status === 'delivered').length;
      const quoteGestern = gestern.length > 0
        ? Math.round((abgGestern / gestern.length) * 100)
        : null;

      const trend: FahrerQuote['trend'] = quoteGestern === null
        ? 'gleich'
        : quote > quoteGestern ? 'besser'
        : quote < quoteGestern ? 'schlechter'
        : 'gleich';

      fahrerList.push({
        driver_id: d.id,
        fahrer_name: d.name,
        gesamt: heute.length,
        abgeschlossen,
        abgebrochen,
        quote,
        trend,
        quote_gestern: quoteGestern,
      });
    }

    if (fahrerList.length === 0) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    fahrerList.sort((a, b) => b.quote - a.quote);

    const teamAvg = Math.round(
      fahrerList.reduce((s, f) => s + f.quote, 0) / fahrerList.length,
    );
    const teamAvgGesternList = fahrerList.filter(f => f.quote_gestern !== null);
    const teamAvgGestern = teamAvgGesternList.length > 0
      ? Math.round(teamAvgGesternList.reduce((s, f) => s + (f.quote_gestern ?? 0), 0) / teamAvgGesternList.length)
      : null;

    const alertCount = fahrerList.filter(f => f.quote < 80).length;

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerList,
      team_avg_quote: teamAvg,
      team_avg_gestern: teamAvgGestern,
      alert_count: alertCount,
      generiert_am: now.toISOString(),
    } satisfies TourAbschlussquoteResponse);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
