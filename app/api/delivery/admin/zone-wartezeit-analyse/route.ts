import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ZoneWaiting = {
  zone: string;
  avg_wait_min: number;
  order_count: number;
  longest_wait_min: number | null;
  laengste_bestell_nr: string | null;
};

type ApiData = {
  zonen: ZoneWaiting[];
  gesamt_avg_wait_min: number;
  laengste_warte_min: number | null;
  laengste_bestell_nr: string | null;
  generiert_am: string;
};

function mockData(): ApiData {
  return {
    zonen: [
      { zone: 'Nord',  avg_wait_min: 12, order_count: 8,  longest_wait_min: 24, laengste_bestell_nr: 'B-0042' },
      { zone: 'Mitte', avg_wait_min: 7,  order_count: 15, longest_wait_min: 19, laengste_bestell_nr: 'B-0039' },
      { zone: 'Süd',   avg_wait_min: 18, order_count: 5,  longest_wait_min: 31, laengste_bestell_nr: 'B-0035' },
      { zone: 'West',  avg_wait_min: 5,  order_count: 11, longest_wait_min: 9,  laengste_bestell_nr: 'B-0044' },
    ],
    gesamt_avg_wait_min: 11,
    laengste_warte_min: 31,
    laengste_bestell_nr: 'B-0035',
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json(mockData());

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 2 * 3600000).toISOString();

    const { data: rows } = await supabase
      .from('orders')
      .select('id, order_number, delivery_zone, created_at, assigned_at')
      .eq('location_id', locationId)
      .gte('created_at', since)
      .not('assigned_at', 'is', null);

    if (!rows || rows.length === 0) return NextResponse.json(mockData());

    const byZone: Record<string, { waits: number[]; nrs: string[]; maxWait: number; maxNr: string }> = {};
    for (const r of rows) {
      const zone = (r.delivery_zone as string | null) ?? 'Unbekannt';
      const waitMin = Math.round(
        (new Date(r.assigned_at as string).getTime() - new Date(r.created_at as string).getTime()) / 60000,
      );
      if (!byZone[zone]) byZone[zone] = { waits: [], nrs: [], maxWait: 0, maxNr: '' };
      byZone[zone].waits.push(waitMin);
      byZone[zone].nrs.push(r.order_number as string ?? r.id);
      if (waitMin > byZone[zone].maxWait) {
        byZone[zone].maxWait = waitMin;
        byZone[zone].maxNr = r.order_number as string ?? r.id;
      }
    }

    const zonen: ZoneWaiting[] = Object.entries(byZone).map(([zone, v]) => ({
      zone,
      avg_wait_min: Math.round(v.waits.reduce((a, b) => a + b, 0) / v.waits.length),
      order_count: v.waits.length,
      longest_wait_min: v.maxWait || null,
      laengste_bestell_nr: v.maxNr || null,
    })).sort((a, b) => b.avg_wait_min - a.avg_wait_min);

    const allWaits = rows.map(r =>
      Math.round((new Date(r.assigned_at as string).getTime() - new Date(r.created_at as string).getTime()) / 60000),
    );
    const maxEntry = allWaits.reduce((mi, v, i) => v > allWaits[mi] ? i : mi, 0);

    return NextResponse.json({
      zonen,
      gesamt_avg_wait_min: Math.round(allWaits.reduce((a, b) => a + b, 0) / allWaits.length),
      laengste_warte_min: allWaits[maxEntry] ?? null,
      laengste_bestell_nr: rows[maxEntry]?.order_number ?? null,
      generiert_am: new Date().toISOString(),
    } as ApiData);
  } catch {
    return NextResponse.json(mockData());
  }
}
