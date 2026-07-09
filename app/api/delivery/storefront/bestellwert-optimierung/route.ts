import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Empfehlung = {
  id: string;
  name: string;
  preis: number;
  kategorie: string;
  bestellungen: number;
  bild_url?: string | null;
};

type Response = {
  empfehlungen: Empfehlung[];
  mindestbestellwert: number;
  schwelle: number;
  location_id: string | null;
  generiert_am: string;
};

const MOCK_EMPFEHLUNGEN: Empfehlung[] = [
  { id: 'mock-1', name: 'Cola 0,5L', preis: 2.5, kategorie: 'Getränke', bestellungen: 312 },
  { id: 'mock-2', name: 'Mineralwasser', preis: 1.9, kategorie: 'Getränke', bestellungen: 289 },
  { id: 'mock-3', name: 'Tiramisu', preis: 4.5, kategorie: 'Dessert', bestellungen: 198 },
  { id: 'mock-4', name: 'Brownie', preis: 3.5, kategorie: 'Dessert', bestellungen: 176 },
  { id: 'mock-5', name: 'Knoblauchbrot', preis: 2.9, kategorie: 'Beilagen', bestellungen: 245 },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const cartTotal = parseFloat(searchParams.get('cart_total') ?? '0');
  const minOrder = parseFloat(searchParams.get('min_order') ?? '12');
  const schwelle = minOrder * 1.2;

  const result: Response = {
    empfehlungen: [],
    mindestbestellwert: minOrder,
    schwelle,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };

  try {
    const supabase = await createClient();

    const query = supabase
      .from('customer_orders')
      .select('items')
      .eq('status', 'geliefert')
      .order('created_at', { ascending: false })
      .limit(200);

    if (locationId) query.eq('location_id', locationId);

    const { data: orders, error } = await query;

    if (error || !orders?.length) throw new Error('no data');

    const counts: Record<string, { name: string; preis: number; kategorie: string; count: number }> = {};

    for (const order of orders) {
      const items: Array<{ id?: string; name?: string; preis?: number; kategorie?: string }> =
        Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        if (!item.name) continue;
        const k = item.id ?? item.name;
        if (!counts[k]) {
          counts[k] = { name: item.name, preis: item.preis ?? 0, kategorie: item.kategorie ?? 'Sonstiges', count: 0 };
        }
        counts[k].count++;
      }
    }

    const sorted = Object.entries(counts)
      .filter(([, v]) => v.preis > 0 && (v.kategorie?.toLowerCase().includes('geträn') || v.kategorie?.toLowerCase().includes('dessert') || v.kategorie?.toLowerCase().includes('beilage')))
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5);

    result.empfehlungen = sorted.map(([id, v]) => ({
      id,
      name: v.name,
      preis: v.preis,
      kategorie: v.kategorie,
      bestellungen: v.count,
    }));

    if (!result.empfehlungen.length) throw new Error('empty');
  } catch {
    result.empfehlungen = MOCK_EMPFEHLUNGEN.slice(0, 5);
  }

  return NextResponse.json(result);
}
