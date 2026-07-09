import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');

  try {
    const supabase = createClient();
    const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

    let q = supabase
      .from('customer_orders')
      .select('total_price, status, created_at, delivered_at, eta_minutes, items')
      .gte('created_at', startOfDay);
    if (locationId) q = q.eq('location_id', locationId);

    const { data: orders } = await q;
    const all = orders ?? [];

    const delivered = all.filter(o => o.status === 'delivered' || o.status === 'geliefert');
    const cancelled = all.filter(o => o.status === 'cancelled' || o.status === 'storniert');

    const bestellungen_gesamt = all.length;
    const umsatz_gesamt = delivered.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
    const storno_count = cancelled.length;

    const withTime = delivered.filter(o => o.delivered_at && o.created_at);
    const avg_lieferzeit_min = withTime.length > 0
      ? Math.round(withTime.reduce((s, o) => s + (new Date(o.delivered_at!).getTime() - new Date(o.created_at).getTime()) / 60000, 0) / withTime.length)
      : 0;

    const withEta = delivered.filter(o => o.eta_minutes && o.delivered_at);
    const puenktlich = withEta.filter(o => {
      const actualMin = (new Date(o.delivered_at!).getTime() - new Date(o.created_at).getTime()) / 60000;
      return actualMin <= (o.eta_minutes ?? 30);
    }).length;
    const puenktlichkeit_pct = withEta.length > 0 ? Math.round((puenktlich / withEta.length) * 100) : 0;

    const stundenMap: Record<number, { bestellungen: number; umsatz: number }> = {};
    for (const o of all) {
      const h = new Date(o.created_at).getHours();
      if (!stundenMap[h]) stundenMap[h] = { bestellungen: 0, umsatz: 0 };
      stundenMap[h].bestellungen++;
      stundenMap[h].umsatz += Number(o.total_price) || 0;
    }
    const stunden = Object.entries(stundenMap)
      .map(([h, v]) => ({ stunde: Number(h), bestellungen: v.bestellungen, umsatz: Math.round(v.umsatz * 100) / 100 }))
      .sort((a, b) => a.stunde - b.stunde);

    const artikelCount: Record<string, number> = {};
    for (const o of all) {
      const items = o.items as Array<{ name?: string; quantity?: number }> | null;
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.name) {
            artikelCount[item.name] = (artikelCount[item.name] ?? 0) + (item.quantity ?? 1);
          }
        }
      }
    }
    const top_artikel = Object.entries(artikelCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      bestellungen_gesamt,
      umsatz_gesamt: Math.round(umsatz_gesamt * 100) / 100,
      avg_lieferzeit_min,
      puenktlichkeit_pct,
      storno_count,
      top_artikel,
      stunden,
    });
  } catch {
    return NextResponse.json({
      bestellungen_gesamt: 0,
      umsatz_gesamt: 0,
      avg_lieferzeit_min: 0,
      puenktlichkeit_pct: 0,
      storno_count: 0,
      top_artikel: [],
      stunden: [],
    });
  }
}
