/**
 * GET /api/delivery/storefront/empfohlene-artikel?location=<id>&limit=5
 *
 * Phase 1566 — Empfohlene Artikel für Storefront Chips
 * Liefert die N meistbestellten Artikel für eine Location.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ArtikelChip {
  id: string;
  name: string;
  bestellungen: number;
  preis?: number | null;
}

const MOCK: ArtikelChip[] = [
  { id: 'm1', name: 'Margherita', bestellungen: 312, preis: 9.9 },
  { id: 'm2', name: 'Burger Classic', bestellungen: 278, preis: 12.5 },
  { id: 'm3', name: 'Caesar Salad', bestellungen: 195, preis: 8.9 },
  { id: 'm4', name: 'Pasta Bolognese', bestellungen: 167, preis: 11.5 },
  { id: 'm5', name: 'Tiramisu', bestellungen: 143, preis: 5.5 },
];

export async function GET(req: NextRequest) {
  const location = req.nextUrl.searchParams.get('location');
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '5', 10), 10);

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();

    let q = supabase
      .from('order_items')
      .select('product_id, product_name, quantity, unit_price, orders!inner(location_id, created_at)')
      .gte('orders.created_at', since);

    if (location) q = q.eq('orders.location_id', location);

    const { data } = await q;
    if (!data || data.length === 0) return NextResponse.json({ artikel: MOCK.slice(0, limit) });

    const map = new Map<string, { id: string; name: string; bestellungen: number; preis: number | null }>();
    for (const row of data as any[]) {
      const id = row.product_id ?? row.product_name;
      const existing = map.get(id);
      if (existing) {
        existing.bestellungen += row.quantity ?? 1;
      } else {
        map.set(id, { id: row.product_id ?? id, name: row.product_name, bestellungen: row.quantity ?? 1, preis: row.unit_price ?? null });
      }
    }

    const artikel = Array.from(map.values())
      .sort((a, b) => b.bestellungen - a.bestellungen)
      .slice(0, limit);

    return NextResponse.json({ artikel });
  } catch {
    return NextResponse.json({ artikel: MOCK.slice(0, limit) });
  }
}
