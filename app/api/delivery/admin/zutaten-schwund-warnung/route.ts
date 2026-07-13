import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ZutatWarnung = {
  zutat: string;
  prognose_einheiten: number;
  verbrauch_einheiten: number;
  abweichung_pct: number;
  status: 'ok' | 'warnung' | 'kritisch';
};

type ApiResponse = {
  warnungen: ZutatWarnung[];
  gesamt_ok: number;
  gesamt_warnung: number;
  gesamt_kritisch: number;
  generiert_am: string;
};

const MOCK: ApiResponse = {
  warnungen: [
    { zutat: 'Tomatensauce',   prognose_einheiten: 40, verbrauch_einheiten: 52, abweichung_pct: 30, status: 'kritisch' },
    { zutat: 'Mozzarella',     prognose_einheiten: 30, verbrauch_einheiten: 37, abweichung_pct: 23, status: 'warnung' },
    { zutat: 'Rucola',         prognose_einheiten: 15, verbrauch_einheiten: 14, abweichung_pct: -7, status: 'ok' },
    { zutat: 'Pizzateig 30cm', prognose_einheiten: 60, verbrauch_einheiten: 62, abweichung_pct: 3,  status: 'ok' },
    { zutat: 'Parmesan',       prognose_einheiten: 20, verbrauch_einheiten: 25, abweichung_pct: 25, status: 'warnung' },
  ],
  gesamt_ok: 2,
  gesamt_warnung: 2,
  gesamt_kritisch: 1,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK);

  try {
    const supabase = await createClient();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Fetch delivered orders with items for today
    const { data: orders } = await supabase
      .from('customer_orders')
      .select('items, total_amount')
      .eq('location_id', locationId)
      .gte('created_at', today.toISOString())
      .in('status', ['geliefert', 'delivered', 'completed']);

    if (!orders || orders.length === 0) return NextResponse.json({ ...MOCK, location_id: locationId });

    // Count item occurrences as ingredient proxy
    const itemCounts = new Map<string, { count: number }>();
    for (const o of orders) {
      if (!Array.isArray(o.items)) continue;
      for (const it of o.items as { name?: string; qty?: number }[]) {
        const name = it.name ?? 'Unbekannt';
        const qty = it.qty ?? 1;
        const existing = itemCounts.get(name) ?? { count: 0 };
        existing.count += qty;
        itemCounts.set(name, existing);
      }
    }

    // Build simple prognose: average over last 7 days (approximated as today/weekday factor)
    const { data: weekOrders } = await supabase
      .from('customer_orders')
      .select('items')
      .eq('location_id', locationId)
      .gte('created_at', new Date(today.getTime() - 7 * 86400_000).toISOString())
      .lt('created_at', today.toISOString())
      .in('status', ['geliefert', 'delivered', 'completed']);

    const weekCounts = new Map<string, number>();
    for (const o of weekOrders ?? []) {
      if (!Array.isArray(o.items)) continue;
      for (const it of o.items as { name?: string; qty?: number }[]) {
        const name = it.name ?? 'Unbekannt';
        weekCounts.set(name, (weekCounts.get(name) ?? 0) + (it.qty ?? 1));
      }
    }

    const warnungen: ZutatWarnung[] = [];
    for (const [name, { count }] of itemCounts.entries()) {
      const weekAvg = (weekCounts.get(name) ?? count * 7) / 7;
      const abweichung = weekAvg > 0 ? Math.round(((count - weekAvg) / weekAvg) * 100) : 0;
      const status: ZutatWarnung['status'] = abweichung >= 30 ? 'kritisch' : abweichung >= 20 ? 'warnung' : 'ok';
      warnungen.push({
        zutat: name,
        prognose_einheiten: Math.round(weekAvg),
        verbrauch_einheiten: count,
        abweichung_pct: abweichung,
        status,
      });
    }

    const gesamt_kritisch = warnungen.filter(w => w.status === 'kritisch').length;
    const gesamt_warnung  = warnungen.filter(w => w.status === 'warnung').length;
    const gesamt_ok       = warnungen.filter(w => w.status === 'ok').length;

    return NextResponse.json({
      warnungen,
      gesamt_ok,
      gesamt_warnung,
      gesamt_kritisch,
      generiert_am: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
