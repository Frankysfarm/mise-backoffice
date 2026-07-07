import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const ZONEN = ['A', 'B', 'C', 'D', 'E'] as const;

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = createServiceClient();
    const jetzt = new Date();
    const vor2h = new Date(jetzt.getTime() - 2 * 60 * 60 * 1000);
    const vor1h = new Date(jetzt.getTime() - 60 * 60 * 1000);

    // Bestellungen der letzten 2h mit Zoneninformation
    const { data: bestellungen } = await sb
      .from('customer_orders')
      .select('id, created_at, delivery_zone')
      .eq('location_id', locationId)
      .gte('created_at', vor2h.toISOString())
      .not('delivery_zone', 'is', null);

    const orders = bestellungen ?? [];

    const zonen = ZONEN.map((zone) => {
      const alleInZone = orders.filter((o) => o.delivery_zone === zone);
      const letzteStunde = alleInZone.filter(
        (o) => new Date(o.created_at) >= vor1h,
      ).length;
      const vorherige = alleInZone.length - letzteStunde;
      // Trend-Faktor: letzte Stunde ÷ vorherige Stunde (geglättet)
      const trendFaktor = vorherige > 0 ? letzteStunde / vorherige : letzteStunde > 0 ? 1.2 : 0.8;
      const prognose2h = Math.round(letzteStunde * trendFaktor * 2);

      return {
        zone,
        aktuelleRate: letzteStunde,
        prognose2h,
        trend: trendFaktor > 1.1 ? 'steigend' : trendFaktor < 0.9 ? 'fallend' : 'stabil',
      };
    });

    return NextResponse.json({
      ok: true,
      zonen,
      generatedAt: jetzt.toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unbekannter Fehler' },
      { status: 500 },
    );
  }
}
