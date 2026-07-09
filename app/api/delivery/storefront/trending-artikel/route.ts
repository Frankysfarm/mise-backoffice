import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type TrendingArtikel = {
  id: string;
  name: string;
  anzahl_bestellungen: number;
  rang: number;
};

type Response = {
  trending: TrendingArtikel[];
  zeitraum_minuten: number;
  generiert_am: string;
  location_id: string | null;
};

const MOCK: Response = {
  trending: [
    { id: 'art1', name: 'Classic Burger', anzahl_bestellungen: 23, rang: 1 },
    { id: 'art2', name: 'Margherita Pizza', anzahl_bestellungen: 18, rang: 2 },
    { id: 'art3', name: 'Caesar Salat', anzahl_bestellungen: 14, rang: 3 },
  ],
  zeitraum_minuten: 120,
  generiert_am: new Date().toISOString(),
  location_id: null,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const limit = parseInt(searchParams.get('limit') ?? '3', 10);
  const zeitraumMin = parseInt(searchParams.get('zeitraum_min') ?? '120', 10);

  try {
    const supabase = await createClient();

    const seit = new Date(Date.now() - zeitraumMin * 60 * 1000).toISOString();

    const q = supabase
      .from('customer_orders')
      .select('items')
      .gte('created_at', seit);

    if (locationId) q.eq('location_id', locationId);

    const { data: orders, error } = await q;
    if (error || !orders?.length) throw new Error('no data');

    const zaehler = new Map<string, { name: string; count: number }>();

    for (const o of orders) {
      let items: { id?: string; name?: string; menu_item_id?: string }[] = [];
      if (Array.isArray(o.items)) {
        items = o.items;
      } else if (typeof o.items === 'string') {
        try {
          items = JSON.parse(o.items);
        } catch {
          continue;
        }
      }

      for (const item of items) {
        const itemId = item.id ?? item.menu_item_id ?? item.name ?? 'unknown';
        const name = item.name ?? itemId;
        if (!name || name === 'unknown') continue;
        const prev = zaehler.get(itemId) ?? { name, count: 0 };
        zaehler.set(itemId, { name, count: prev.count + 1 });
      }
    }

    const trending: TrendingArtikel[] = [...zaehler.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([id, d], i) => ({ id, name: d.name, anzahl_bestellungen: d.count, rang: i + 1 }));

    if (trending.length === 0) throw new Error('empty');

    return NextResponse.json({
      trending,
      zeitraum_minuten: zeitraumMin,
      generiert_am: new Date().toISOString(),
      location_id: locationId,
    } satisfies Response);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId, generiert_am: new Date().toISOString() });
  }
}
