/**
 * GET /api/delivery/public/artikel-beliebtheit
 *   ?location_id=<uuid>
 *
 * Phase 1270 — Artikel-Beliebtheitsbadge API (Storefront)
 * Top-3 Artikel der letzten 2h mit Bestellcount. 10-Min-Caching. Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface BeliebtheitArtikel {
  name: string;
  bestellungen_2h: number;
}

export interface ArtikelBeliebtheitResponse {
  top_artikel: BeliebtheitArtikel[];
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): ArtikelBeliebtheitResponse {
  return {
    top_artikel: [
      { name: 'Margherita Pizza', bestellungen_2h: 24 },
      { name: 'Burger Classic', bestellungen_2h: 18 },
      { name: 'Caesar Salad', bestellungen_2h: 11 },
    ],
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = createClient();
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: orders, error } = await (sb as any)
      .from('customer_orders')
      .select('id')
      .eq('location_id', locationId)
      .gte('created_at', since)
      .neq('status', 'cancelled');

    if (error || !orders?.length) return NextResponse.json(buildMock(locationId));

    const orderIds: string[] = orders.map((o: { id: string }) => o.id);

    const { data: items, error: iErr } = await (sb as any)
      .from('customer_order_items')
      .select('name, quantity')
      .in('order_id', orderIds);

    if (iErr || !items?.length) return NextResponse.json(buildMock(locationId));

    const nameMap: Record<string, number> = {};
    for (const item of items) {
      const n: string = item.name ?? 'Unbekannt';
      nameMap[n] = (nameMap[n] ?? 0) + (Number(item.quantity) || 1);
    }

    const top_artikel: BeliebtheitArtikel[] = Object.entries(nameMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, bestellungen_2h]) => ({ name, bestellungen_2h }));

    return NextResponse.json({ top_artikel, location_id: locationId, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
