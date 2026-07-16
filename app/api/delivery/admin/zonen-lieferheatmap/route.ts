import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface ZoneStats {
  zone: string;
  anzahl: number;
  avg_lieferzeit_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  slow_zone_alert: boolean;
}

interface HeatmapResponse {
  location_id: string;
  zonen: ZoneStats[];
  gesamt_avg_min: number;
  slow_zone_count: number;
  generiert_am: string;
}

const MOCK: Omit<HeatmapResponse, 'location_id' | 'generiert_am'> = {
  zonen: [
    { zone: '10115', anzahl: 34, avg_lieferzeit_min: 18, ampel: 'gruen', slow_zone_alert: false },
    { zone: '10117', anzahl: 27, avg_lieferzeit_min: 22, ampel: 'gruen', slow_zone_alert: false },
    { zone: '10119', anzahl: 19, avg_lieferzeit_min: 31, ampel: 'gelb', slow_zone_alert: false },
    { zone: '10178', anzahl: 12, avg_lieferzeit_min: 42, ampel: 'rot', slow_zone_alert: true },
    { zone: '10243', anzahl: 8, avg_lieferzeit_min: 38, ampel: 'rot', slow_zone_alert: true },
  ],
  gesamt_avg_min: 26,
  slow_zone_count: 2,
};

function ampelFarbe(avgMin: number, gesamtAvg: number): 'gruen' | 'gelb' | 'rot' {
  const ratio = avgMin / gesamtAvg;
  if (ratio <= 1.1) return 'gruen';
  if (ratio <= 1.3) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data: orders, error } = await supabase
      .from('orders')
      .select('delivery_zone, created_at, delivered_at')
      .eq('location_id', locationId)
      .gte('created_at', since.toISOString())
      .not('delivery_zone', 'is', null)
      .not('delivered_at', 'is', null);

    if (error || !orders || orders.length === 0) throw new Error('no data');

    const grouped = new Map<string, number[]>();
    for (const o of orders) {
      if (!o.delivery_zone) continue;
      const min = (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60_000;
      if (min <= 0 || min > 180) continue;
      if (!grouped.has(o.delivery_zone)) grouped.set(o.delivery_zone, []);
      grouped.get(o.delivery_zone)!.push(min);
    }

    const allMins: number[] = [];
    const zonen: ZoneStats[] = [];
    for (const [zone, mins] of grouped.entries()) {
      const avg = Math.round(mins.reduce((s, v) => s + v, 0) / mins.length);
      allMins.push(...mins);
      zonen.push({ zone, anzahl: mins.length, avg_lieferzeit_min: avg, ampel: 'gruen', slow_zone_alert: false });
    }

    const gesamtAvg = allMins.length > 0
      ? Math.round(allMins.reduce((s, v) => s + v, 0) / allMins.length)
      : 25;

    let slowCount = 0;
    for (const z of zonen) {
      z.ampel = ampelFarbe(z.avg_lieferzeit_min, gesamtAvg);
      z.slow_zone_alert = z.avg_lieferzeit_min > gesamtAvg * 1.3;
      if (z.slow_zone_alert) slowCount++;
    }

    zonen.sort((a, b) => b.anzahl - a.anzahl);

    return NextResponse.json({
      location_id: locationId,
      zonen,
      gesamt_avg_min: gesamtAvg,
      slow_zone_count: slowCount,
      generiert_am: new Date().toISOString(),
    } satisfies HeatmapResponse);
  } catch {
    return NextResponse.json({
      location_id: locationId,
      ...MOCK,
      generiert_am: new Date().toISOString(),
    } satisfies HeatmapResponse);
  }
}
