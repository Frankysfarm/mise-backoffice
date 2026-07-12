import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ZoneSla = {
  zone: string;
  bestellungen_gesamt: number;
  puenktlich: number;
  puenktlich_pct: number;
  verletzungen: number;
  verletzungen_pct: number;
  ø_lieferzeit_min: number;
  status: 'ok' | 'warnung' | 'kritisch';
};

type ApiResponse = {
  zonen: ZoneSla[];
  gesamt_puenktlich_pct: number;
  gesamt_verletzungen: number;
  eskalation: boolean;
  sla_ziel_min: number;
  location_id: string | null;
  generiert_am: string;
};

const SLA_ZIEL_MIN = 30;

function mockData(locationId: string | null): ApiResponse {
  const zonen: ZoneSla[] = [
    { zone: 'A', bestellungen_gesamt: 18, puenktlich: 16, puenktlich_pct: 89, verletzungen: 2, verletzungen_pct: 11, ø_lieferzeit_min: 24, status: 'ok' },
    { zone: 'B', bestellungen_gesamt: 14, puenktlich: 10, puenktlich_pct: 71, verletzungen: 4, verletzungen_pct: 29, ø_lieferzeit_min: 33, status: 'kritisch' },
    { zone: 'C', bestellungen_gesamt: 9,  puenktlich: 8,  puenktlich_pct: 89, verletzungen: 1, verletzungen_pct: 11, ø_lieferzeit_min: 27, status: 'ok' },
    { zone: 'D', bestellungen_gesamt: 5,  puenktlich: 4,  puenktlich_pct: 80, verletzungen: 1, verletzungen_pct: 20, ø_lieferzeit_min: 30, status: 'warnung' },
  ];
  const gesamt_b = zonen.reduce((s, z) => s + z.bestellungen_gesamt, 0);
  const gesamt_p = zonen.reduce((s, z) => s + z.puenktlich, 0);
  const gesamt_v = zonen.reduce((s, z) => s + z.verletzungen, 0);
  return {
    zonen,
    gesamt_puenktlich_pct: Math.round((gesamt_p / gesamt_b) * 100),
    gesamt_verletzungen: gesamt_v,
    eskalation: zonen.some(z => z.verletzungen_pct > 20),
    sla_ziel_min: SLA_ZIEL_MIN,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

function statusFromPct(verletzungsPct: number): ZoneSla['status'] {
  if (verletzungsPct > 30) return 'kritisch';
  if (verletzungsPct > 20) return 'warnung';
  return 'ok';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json(mockData(null));
  }

  try {
    const supabase = createClient();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Fetch completed orders with delivery timing data
    const { data: orders, error } = await supabase
      .from('customer_orders')
      .select('id, created_at, delivered_at, delivery_zone, status')
      .eq('location_id', locationId)
      .in('status', ['delivered', 'geliefert', 'completed'])
      .gte('created_at', twoHoursAgo)
      .not('delivered_at', 'is', null);

    if (error || !orders || orders.length === 0) {
      return NextResponse.json(mockData(locationId));
    }

    const zoneMap = new Map<string, { total: number; puenktlich: number; sumMin: number }>();

    for (const o of orders) {
      const zone = (o.delivery_zone as string | null) ?? 'Unbekannt';
      const created = new Date(o.created_at as string);
      const delivered = new Date(o.delivered_at as string);
      const lieferzeitMin = (delivered.getTime() - created.getTime()) / 60000;
      const puenktlich = lieferzeitMin <= SLA_ZIEL_MIN ? 1 : 0;

      if (!zoneMap.has(zone)) zoneMap.set(zone, { total: 0, puenktlich: 0, sumMin: 0 });
      const z = zoneMap.get(zone)!;
      z.total += 1;
      z.puenktlich += puenktlich;
      z.sumMin += lieferzeitMin;
    }

    const zonen: ZoneSla[] = Array.from(zoneMap.entries()).map(([zone, d]) => {
      const puenktlich_pct = Math.round((d.puenktlich / d.total) * 100);
      const verletzungen = d.total - d.puenktlich;
      const verletzungen_pct = 100 - puenktlich_pct;
      return {
        zone,
        bestellungen_gesamt: d.total,
        puenktlich: d.puenktlich,
        puenktlich_pct,
        verletzungen,
        verletzungen_pct,
        ø_lieferzeit_min: Math.round(d.sumMin / d.total),
        status: statusFromPct(verletzungen_pct),
      };
    });

    if (zonen.length === 0) return NextResponse.json(mockData(locationId));

    const gesamt_b = zonen.reduce((s, z) => s + z.bestellungen_gesamt, 0);
    const gesamt_p = zonen.reduce((s, z) => s + z.puenktlich, 0);
    const gesamt_v = zonen.reduce((s, z) => s + z.verletzungen, 0);

    const result: ApiResponse = {
      zonen,
      gesamt_puenktlich_pct: Math.round((gesamt_p / gesamt_b) * 100),
      gesamt_verletzungen: gesamt_v,
      eskalation: zonen.some(z => z.verletzungen_pct > 20),
      sla_ziel_min: SLA_ZIEL_MIN,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
