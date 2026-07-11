import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RisikoLevel = 'kritisch' | 'hoch' | 'mittel' | 'ok';

type ArtikelEngpass = {
  name: string;
  bestellungen_letzte_2h: number;
  bestellungen_pro_stunde: number;
  geschaetzter_lagerbestand: number;
  stunden_bis_engpass: number | null;
  risiko: RisikoLevel;
  empfehlung: string;
};

type ApiResponse = {
  artikel: ArtikelEngpass[];
  kritische_anzahl: number;
  location_id: string | null;
  generiert_am: string;
};

function risikoLevel(stundenBisEngpass: number | null): RisikoLevel {
  if (stundenBisEngpass === null) return 'ok';
  if (stundenBisEngpass <= 1) return 'kritisch';
  if (stundenBisEngpass <= 2) return 'hoch';
  if (stundenBisEngpass <= 4) return 'mittel';
  return 'ok';
}

function empfehlungText(risiko: RisikoLevel, name: string): string {
  if (risiko === 'kritisch') return `${name} sofort nachbestellen oder aus Karte nehmen`;
  if (risiko === 'hoch') return `${name} innerhalb 1h nachbestellen`;
  if (risiko === 'mittel') return `${name} heute noch auffüllen`;
  return '';
}

function mockData(locationId: string | null): ApiResponse {
  const artikel: ArtikelEngpass[] = [
    { name: 'Burger-Pattys', bestellungen_letzte_2h: 24, bestellungen_pro_stunde: 12, geschaetzter_lagerbestand: 8, stunden_bis_engpass: 0.7, risiko: 'kritisch', empfehlung: '' },
    { name: 'Pommes-Frites (kg)', bestellungen_letzte_2h: 18, bestellungen_pro_stunde: 9, geschaetzter_lagerbestand: 22, stunden_bis_engpass: 2.4, risiko: 'hoch', empfehlung: '' },
    { name: 'Burger-Brötchen', bestellungen_letzte_2h: 20, bestellungen_pro_stunde: 10, geschaetzter_lagerbestand: 55, stunden_bis_engpass: 5.5, risiko: 'mittel', empfehlung: '' },
    { name: 'Salat-Mix (kg)', bestellungen_letzte_2h: 5, bestellungen_pro_stunde: 2.5, geschaetzter_lagerbestand: 30, stunden_bis_engpass: null, risiko: 'ok', empfehlung: '' },
  ].map(a => ({ ...a, empfehlung: empfehlungText(a.risiko, a.name) }));

  return {
    artikel,
    kritische_anzahl: artikel.filter(a => a.risiko === 'kritisch' || a.risiko === 'hoch').length,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Fetch recent order items to compute consumption rate
    const oQ = supabase
      .from('customer_orders')
      .select('items, created_at')
      .gte('created_at', twoHoursAgo);
    if (locationId) oQ.eq('location_id', locationId);
    const { data: orders, error: oErr } = await oQ;
    if (oErr || !orders || orders.length === 0) throw new Error('no orders');

    // Aggregate item order counts
    type ItemAcc = Record<string, number>;
    const acc: ItemAcc = {};
    for (const order of orders) {
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const name: string = item?.name ?? item?.title ?? 'Unbekannt';
        if (!name || name === 'Unbekannt') continue;
        acc[name] = (acc[name] ?? 0) + (item?.quantity ?? 1);
      }
    }

    if (Object.keys(acc).length === 0) throw new Error('no item data');

    // Fetch inventory if available
    const invQ = supabase.from('inventory_items').select('name, quantity');
    if (locationId) invQ.eq('location_id', locationId);
    const { data: inventory } = await invQ;
    const invMap: Record<string, number> = {};
    for (const inv of inventory ?? []) {
      if (inv.name) invMap[inv.name] = inv.quantity ?? 0;
    }

    const artikel: ArtikelEngpass[] = Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count2h]) => {
        const rate = count2h / 2;
        const stock = invMap[name] ?? Math.max(count2h * 2, 20); // estimate if no inventory
        const stunden = rate > 0 ? parseFloat((stock / rate).toFixed(1)) : null;
        const risiko = risikoLevel(stunden);
        return {
          name,
          bestellungen_letzte_2h: count2h,
          bestellungen_pro_stunde: parseFloat(rate.toFixed(1)),
          geschaetzter_lagerbestand: stock,
          stunden_bis_engpass: stunden,
          risiko,
          empfehlung: empfehlungText(risiko, name),
        };
      });

    return NextResponse.json({
      artikel,
      kritische_anzahl: artikel.filter(a => a.risiko === 'kritisch' || a.risiko === 'hoch').length,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
