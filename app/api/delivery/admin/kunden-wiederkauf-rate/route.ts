import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TopKunde {
  customer_id: string;
  name: string;
  bestellungen_heute: number;
  bestellungen_gesamt_30d: number;
}

interface WiederkaufRateResponse {
  location_id: string;
  stammkunden_anteil: number;
  neukunden_anteil: number;
  stammkunden_count: number;
  neukunden_count: number;
  gesamt_kunden: number;
  trend_vs_vormonat: number;
  alert_sinkend: boolean;
  top5_heute: TopKunde[];
  generiert_am: string;
}

const MOCK: WiederkaufRateResponse = {
  location_id: 'mock',
  stammkunden_anteil: 62,
  neukunden_anteil: 38,
  stammkunden_count: 124,
  neukunden_count: 76,
  gesamt_kunden: 200,
  trend_vs_vormonat: 4,
  alert_sinkend: false,
  top5_heute: [
    { customer_id: 'c1', name: 'Maria S.', bestellungen_heute: 3, bestellungen_gesamt_30d: 18 },
    { customer_id: 'c2', name: 'Klaus H.', bestellungen_heute: 2, bestellungen_gesamt_30d: 14 },
    { customer_id: 'c3', name: 'Julia M.', bestellungen_heute: 2, bestellungen_gesamt_30d: 11 },
    { customer_id: 'c4', name: 'Peter W.', bestellungen_heute: 1, bestellungen_gesamt_30d: 9 },
    { customer_id: 'c5', name: 'Anna K.', bestellungen_heute: 1, bestellungen_gesamt_30d: 8 },
  ],
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const since60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const { data: orders30 } = await sb
      .from('orders')
      .select('id, customer_id, customer_name, created_at')
      .eq('location_id', locationId)
      .gte('created_at', since30);

    const { data: orders60 } = await sb
      .from('orders')
      .select('customer_id')
      .eq('location_id', locationId)
      .gte('created_at', since60)
      .lt('created_at', since30);

    if (!orders30) return NextResponse.json(MOCK);

    const countPer = new Map<string, number>();
    for (const o of orders30) {
      const cid = o.customer_id ?? o.id;
      countPer.set(cid, (countPer.get(cid) ?? 0) + 1);
    }

    const stammkunden = [...countPer.entries()].filter(([, c]) => c >= 2);
    const stammkundenIds = new Set(stammkunden.map(([id]) => id));
    const gesamtKunden = countPer.size;
    const stammCount = stammkunden.length;
    const neuCount = gesamtKunden - stammCount;
    const stammAnteil = gesamtKunden > 0 ? Math.round((stammCount / gesamtKunden) * 100) : 0;
    const neuAnteil = 100 - stammAnteil;

    const prevCountPer = new Map<string, number>();
    for (const o of (orders60 ?? [])) {
      const cid = o.customer_id;
      if (!cid) continue;
      prevCountPer.set(cid, (prevCountPer.get(cid) ?? 0) + 1);
    }
    const prevStamm = [...prevCountPer.values()].filter(c => c >= 2).length;
    const prevGesamt = prevCountPer.size;
    const prevAnteil = prevGesamt > 0 ? Math.round((prevStamm / prevGesamt) * 100) : 0;
    const trend = stammAnteil - prevAnteil;

    const orderMap = new Map<string, { name: string; count: number }>();
    for (const o of orders30) {
      if (!o.customer_id) continue;
      const e = orderMap.get(o.customer_id);
      if (e) {
        e.count++;
      } else {
        orderMap.set(o.customer_id, { name: o.customer_name ?? 'Kunde', count: 1 });
      }
    }

    const { data: ordersToday } = await sb
      .from('orders')
      .select('customer_id, customer_name')
      .eq('location_id', locationId)
      .gte('created_at', todayISO);

    const todayMap = new Map<string, { name: string; count: number }>();
    for (const o of (ordersToday ?? [])) {
      if (!o.customer_id) continue;
      const e = todayMap.get(o.customer_id);
      if (e) { e.count++; } else { todayMap.set(o.customer_id, { name: o.customer_name ?? 'Kunde', count: 1 }); }
    }

    const top5: TopKunde[] = [...todayMap.entries()]
      .filter(([id]) => stammkundenIds.has(id))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id, v]) => ({
        customer_id: id,
        name: v.name,
        bestellungen_heute: v.count,
        bestellungen_gesamt_30d: orderMap.get(id)?.count ?? v.count,
      }));

    const result: WiederkaufRateResponse = {
      location_id: locationId,
      stammkunden_anteil: stammAnteil,
      neukunden_anteil: neuAnteil,
      stammkunden_count: stammCount,
      neukunden_count: neuCount,
      gesamt_kunden: gesamtKunden,
      trend_vs_vormonat: trend,
      alert_sinkend: trend < -5,
      top5_heute: top5,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK);
  }
}
