/**
 * GET /api/delivery/public/beliebte-gerichte?location_id=<uuid>&stunden=1
 *
 * Phase 1318 — Beliebte-Gerichte-API (Public)
 * Top-3 Gerichte der letzten N Stunden mit Bestellzähler.
 * Supabase customer_orders + Mock-Fallback. Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface BeliebtesGericht {
  rang: number;
  artikel_name: string;
  anzahl_bestellungen: number;
}

export interface BeliebtGerichte {
  gerichte: BeliebtesGericht[];
  zeitraum_stunden: number;
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string, stunden: number): BeliebtGerichte {
  return {
    gerichte: [
      { rang: 1, artikel_name: 'Classic Burger', anzahl_bestellungen: 14 },
      { rang: 2, artikel_name: 'Margherita Pizza', anzahl_bestellungen: 11 },
      { rang: 3, artikel_name: 'Caesar Salat', anzahl_bestellungen: 8 },
    ],
    zeitraum_stunden: stunden,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';
  const stunden = Math.min(24, Math.max(1, Number(req.nextUrl.searchParams.get('stunden') ?? '1')));

  if (!locationId) return NextResponse.json(buildMock('', stunden));

  try {
    const sb = await createClient();
    const seit = new Date(Date.now() - stunden * 3600_000).toISOString();

    const { data: orders, error } = await (sb as any)
      .from('customer_orders')
      .select('items')
      .eq('location_id', locationId)
      .gte('created_at', seit)
      .in('status', ['pending', 'preparing', 'ready', 'delivered', 'picked_up']);

    if (error || !orders?.length) return NextResponse.json(buildMock(locationId, stunden));

    const zähler: Record<string, number> = {};
    for (const order of orders as { items?: unknown }[]) {
      if (!Array.isArray(order.items)) continue;
      for (const item of order.items as { name?: string; quantity?: number }[]) {
        const name = item.name ?? 'Unbekannt';
        zähler[name] = (zähler[name] ?? 0) + Math.max(1, item.quantity ?? 1);
      }
    }

    const sorted = Object.entries(zähler)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, count], i) => ({ rang: i + 1, artikel_name: name, anzahl_bestellungen: count }));

    if (!sorted.length) return NextResponse.json(buildMock(locationId, stunden));

    return NextResponse.json({
      gerichte: sorted,
      zeitraum_stunden: stunden,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies BeliebtGerichte);
  } catch {
    return NextResponse.json(buildMock(locationId, stunden));
  }
}
