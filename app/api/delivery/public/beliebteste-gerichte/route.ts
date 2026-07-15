/**
 * GET /api/delivery/public/beliebteste-gerichte?location_id=<uuid>
 *
 * Phase 1716 — Beliebteste-Gerichte-API (Public)
 * Top-3 meistbestellte Gerichte heute je Location.
 * Kein Auth. Supabase + Mock-Fallback. Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface GerichtEntry {
  rang: number;
  name: string;
  bestellungen: number;
  kategorie: string | null;
}

interface BeliebtsteGerichteResponse {
  location_id: string;
  gerichte: GerichtEntry[];
  zeitraum_label: string;
  generiert_am: string;
}

function buildMock(locationId: string): BeliebtsteGerichteResponse {
  const seed = locationId.charCodeAt(0) || 65;
  const base = (seed % 20) + 20;
  return {
    location_id: locationId,
    gerichte: [
      { rang: 1, name: 'Margherita', bestellungen: base + 14, kategorie: 'Pizza' },
      { rang: 2, name: 'Pasta Bolognese', bestellungen: base + 7, kategorie: 'Pasta' },
      { rang: 3, name: 'Caesar Salad', bestellungen: base - 1, kategorie: 'Salat' },
    ],
    zeitraum_label: 'heute',
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? 'all';

  try {
    const sb = await createClient();

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    let q = (sb as any)
      .from('order_items')
      .select('product_name, product_category, quantity')
      .gte('created_at', todayStart.toISOString())
      .not('product_name', 'is', null);

    if (locationId !== 'all') q = q.eq('location_id', locationId);

    const { data, error } = await q;
    if (error || !data || data.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    const counter: Record<string, { anzahl: number; kategorie: string | null }> = {};
    for (const item of data as Array<{ product_name: string; product_category: string | null; quantity: number | null }>) {
      const n = item.product_name;
      if (!counter[n]) counter[n] = { anzahl: 0, kategorie: item.product_category ?? null };
      counter[n].anzahl += item.quantity ?? 1;
    }

    const gerichte: GerichtEntry[] = Object.entries(counter)
      .sort((a, b) => b[1].anzahl - a[1].anzahl)
      .slice(0, 3)
      .map(([name, v], i) => ({
        rang: i + 1,
        name,
        bestellungen: v.anzahl,
        kategorie: v.kategorie,
      }));

    return NextResponse.json({
      location_id: locationId,
      gerichte,
      zeitraum_label: 'heute',
      generiert_am: new Date().toISOString(),
    } satisfies BeliebtsteGerichteResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
