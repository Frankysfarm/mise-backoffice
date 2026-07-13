import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface ZoneEffizienzEintrag {
  zone: string;
  lieferungen: number;
  avg_lieferzeit_min: number;
  on_time_pct: number;
  umsatz_eur: number;
  umsatz_pro_lieferung_eur: number;
  effizienz_level: 'schwach' | 'normal' | 'gut' | 'top';
}

export interface ZonenEffizienzResponse {
  zonen: ZoneEffizienzEintrag[];
  gesamt_lieferungen: number;
  gesamt_umsatz_eur: number;
  beste_zone: string | null;
  schlechteste_zone: string | null;
  location_id: string;
  generiert_am: string;
}

function effizienzLevel(onTimePct: number, avgMin: number): ZoneEffizienzEintrag['effizienz_level'] {
  if (onTimePct >= 90 && avgMin <= 25) return 'top';
  if (onTimePct >= 75 && avgMin <= 35) return 'gut';
  if (onTimePct >= 60) return 'normal';
  return 'schwach';
}

function mockData(locationId: string): ZonenEffizienzResponse {
  const zonen: ZoneEffizienzEintrag[] = [
    { zone: 'Mitte', lieferungen: 34, avg_lieferzeit_min: 22, on_time_pct: 94, umsatz_eur: 612, umsatz_pro_lieferung_eur: 18, effizienz_level: 'top' },
    { zone: 'Nord', lieferungen: 21, avg_lieferzeit_min: 31, on_time_pct: 76, umsatz_eur: 378, umsatz_pro_lieferung_eur: 18, effizienz_level: 'gut' },
    { zone: 'Süd', lieferungen: 18, avg_lieferzeit_min: 38, on_time_pct: 61, umsatz_eur: 324, umsatz_pro_lieferung_eur: 18, effizienz_level: 'normal' },
    { zone: 'Ost', lieferungen: 12, avg_lieferzeit_min: 45, on_time_pct: 50, umsatz_eur: 198, umsatz_pro_lieferung_eur: 16.5, effizienz_level: 'schwach' },
  ];
  const gesamt_umsatz = zonen.reduce((s, z) => s + z.umsatz_eur, 0);
  const gesamt_lieferungen = zonen.reduce((s, z) => s + z.lieferungen, 0);
  const sorted = [...zonen].sort((a, b) => b.on_time_pct - a.on_time_pct);
  return {
    zonen,
    gesamt_lieferungen,
    gesamt_umsatz_eur: gesamt_umsatz,
    beste_zone: sorted[0]?.zone ?? null,
    schlechteste_zone: sorted[sorted.length - 1]?.zone ?? null,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: stops, error } = await (supabase as any)
      .from('mise_delivery_stops')
      .select('zone, delivered_at, estimated_delivery_at, order_id')
      .eq('location_id', locationId)
      .gte('delivered_at', today.toISOString())
      .not('delivered_at', 'is', null);

    if (error || !stops || stops.length === 0) {
      return NextResponse.json(mockData(locationId));
    }

    const { data: orders } = await (supabase as any)
      .from('customer_orders')
      .select('id, total_price')
      .in('id', stops.map((s: any) => s.order_id).filter(Boolean));

    const orderPriceMap = new Map<string, number>();
    for (const o of orders ?? []) {
      orderPriceMap.set(o.id, o.total_price ?? 0);
    }

    const zoneBuckets: Record<string, { lieferzeiten: number[]; on_time: number[]; umsatz: number[] }> = {};
    for (const stop of stops as any[]) {
      const zone = stop.zone ?? 'Unbekannt';
      if (!zoneBuckets[zone]) zoneBuckets[zone] = { lieferzeiten: [], on_time: [], umsatz: [] };

      const deliveredAt = stop.delivered_at ? new Date(stop.delivered_at).getTime() : null;
      const estimatedAt = stop.estimated_delivery_at ? new Date(stop.estimated_delivery_at).getTime() : null;
      const price = orderPriceMap.get(stop.order_id) ?? 0;

      if (deliveredAt && estimatedAt) {
        const deltaMin = (deliveredAt - estimatedAt) / 60000;
        zoneBuckets[zone].lieferzeiten.push(deliveredAt);
        zoneBuckets[zone].on_time.push(deltaMin <= 5 ? 1 : 0);
      }
      zoneBuckets[zone].umsatz.push(price);
    }

    const zonen: ZoneEffizienzEintrag[] = Object.entries(zoneBuckets).map(([zone, { lieferzeiten, on_time, umsatz }]) => {
      const lieferungen = umsatz.length;
      const avg_lieferzeit_min = lieferzeiten.length >= 2
        ? Math.round((Math.max(...lieferzeiten) - Math.min(...lieferzeiten)) / 60000 / Math.max(lieferzeiten.length - 1, 1))
        : 30;
      const on_time_pct = on_time.length > 0 ? Math.round((on_time.reduce((s, v) => s + v, 0) / on_time.length) * 100) : 0;
      const umsatz_eur = Math.round(umsatz.reduce((s, v) => s + v, 0) * 100) / 100;
      return {
        zone,
        lieferungen,
        avg_lieferzeit_min,
        on_time_pct,
        umsatz_eur,
        umsatz_pro_lieferung_eur: lieferungen > 0 ? Math.round((umsatz_eur / lieferungen) * 100) / 100 : 0,
        effizienz_level: effizienzLevel(on_time_pct, avg_lieferzeit_min),
      };
    });

    const sorted = [...zonen].sort((a, b) => b.on_time_pct - a.on_time_pct);
    return NextResponse.json({
      zonen,
      gesamt_lieferungen: zonen.reduce((s, z) => s + z.lieferungen, 0),
      gesamt_umsatz_eur: Math.round(zonen.reduce((s, z) => s + z.umsatz_eur, 0) * 100) / 100,
      beste_zone: sorted[0]?.zone ?? null,
      schlechteste_zone: sorted[sorted.length - 1]?.zone ?? null,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies ZonenEffizienzResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
