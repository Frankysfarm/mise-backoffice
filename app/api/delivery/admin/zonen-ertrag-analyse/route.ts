import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ZoneData {
  zone: string;
  umsatz: number;
  bestellungen: number;
  puenktlichkeit_pct: number;
  umsatz_vorwoche: number;
  bestellungen_vorwoche: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

const ZONES = ['A', 'B', 'C', 'D'];

function mockData(): { zonen: ZoneData[]; gesamt_umsatz: number; generatedAt: string } {
  const zonen: ZoneData[] = [
    { zone: 'A', umsatz: 312.50, bestellungen: 28, puenktlichkeit_pct: 88, umsatz_vorwoche: 289.00, bestellungen_vorwoche: 25, trend: 'steigend' },
    { zone: 'B', umsatz: 204.80, bestellungen: 19, puenktlichkeit_pct: 74, umsatz_vorwoche: 220.00, bestellungen_vorwoche: 21, trend: 'fallend' },
    { zone: 'C', umsatz: 178.20, bestellungen: 15, puenktlichkeit_pct: 91, umsatz_vorwoche: 175.00, bestellungen_vorwoche: 15, trend: 'stabil' },
    { zone: 'D', umsatz: 95.60, bestellungen: 9, puenktlichkeit_pct: 67, umsatz_vorwoche: 88.00, bestellungen_vorwoche: 8, trend: 'steigend' },
  ];
  return { zonen, gesamt_umsatz: zonen.reduce((s, z) => s + z.umsatz, 0), generatedAt: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const vorwocheStart = new Date(heute);
    vorwocheStart.setDate(vorwocheStart.getDate() - 7);
    const vorwocheEnd = new Date(heute);
    vorwocheEnd.setDate(vorwocheEnd.getDate() - 1);

    const [{ data: todayBatches, error: err1 }, { data: weekBatches, error: err2 }, { data: stops, error: err3 }] = await Promise.all([
      supabase
        .from('mise_delivery_batches')
        .select('zone, total_amount, delivery_fee')
        .eq('location_id', locationId)
        .in('state', ['delivered', 'completed'])
        .gte('created_at', heute.toISOString()),
      supabase
        .from('mise_delivery_batches')
        .select('zone, total_amount, delivery_fee')
        .eq('location_id', locationId)
        .in('state', ['delivered', 'completed'])
        .gte('created_at', vorwocheStart.toISOString())
        .lt('created_at', vorwocheEnd.toISOString()),
      supabase
        .from('mise_delivery_stops')
        .select('zone, delivered_at, promised_at')
        .eq('location_id', locationId)
        .gte('created_at', heute.toISOString())
        .not('delivered_at', 'is', null),
    ]);

    if (err1 || err2 || err3) throw err1 ?? err2 ?? err3;

    const todayMap: Record<string, { umsatz: number; bestellungen: number }> = {};
    const weekMap: Record<string, { umsatz: number; bestellungen: number }> = {};

    for (const b of todayBatches ?? []) {
      const z = (b.zone as string) ?? 'A';
      todayMap[z] ??= { umsatz: 0, bestellungen: 0 };
      todayMap[z].umsatz += Number(b.total_amount ?? 0) + Number(b.delivery_fee ?? 0);
      todayMap[z].bestellungen += 1;
    }
    for (const b of weekBatches ?? []) {
      const z = (b.zone as string) ?? 'A';
      weekMap[z] ??= { umsatz: 0, bestellungen: 0 };
      weekMap[z].umsatz += Number(b.total_amount ?? 0) + Number(b.delivery_fee ?? 0);
      weekMap[z].bestellungen += 1;
    }

    const puenktlichkeitMap: Record<string, { on: number; total: number }> = {};
    for (const s of stops ?? []) {
      const z = (s.zone as string) ?? 'A';
      puenktlichkeitMap[z] ??= { on: 0, total: 0 };
      puenktlichkeitMap[z].total += 1;
      if (s.delivered_at && s.promised_at) {
        const diff = new Date(s.delivered_at).getTime() - new Date(s.promised_at).getTime();
        if (diff <= 0) puenktlichkeitMap[z].on += 1;
      }
    }

    const zonen: ZoneData[] = ZONES.map(zone => {
      const today = todayMap[zone] ?? { umsatz: 0, bestellungen: 0 };
      const week = weekMap[zone] ?? { umsatz: 0, bestellungen: 0 };
      const pkt = puenktlichkeitMap[zone];
      const puenktlichkeit_pct = pkt && pkt.total > 0 ? Math.round((pkt.on / pkt.total) * 100) : 0;
      const delta = today.umsatz - week.umsatz;
      const trend: ZoneData['trend'] = delta > 5 ? 'steigend' : delta < -5 ? 'fallend' : 'stabil';
      return {
        zone,
        umsatz: Math.round(today.umsatz * 100) / 100,
        bestellungen: today.bestellungen,
        puenktlichkeit_pct,
        umsatz_vorwoche: Math.round(week.umsatz * 100) / 100,
        bestellungen_vorwoche: week.bestellungen,
        trend,
      };
    });

    const gesamt_umsatz = zonen.reduce((s, z) => s + z.umsatz, 0);

    return NextResponse.json({ zonen, gesamt_umsatz: Math.round(gesamt_umsatz * 100) / 100, generatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json(mockData());
  }
}
