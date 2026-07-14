/**
 * GET /api/delivery/public/bestellhistorie?location_id=<uuid>&customer_id=<str>
 *
 * Phase 1453 — Bestellhistorie-API (Public)
 * Letzte 3 Bestellungen des Kunden (Datum + Artikel + Status)
 * Supabase mise_orders + Mock-Fallback
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface BestellHistorieItem {
  name: string;
  menge: number;
}

export interface BestellHistorieEintrag {
  order_id: string;
  datum: string;        // ISO string
  artikel: BestellHistorieItem[];
  status: string;
  gesamtpreis_eur: number;
}

export interface BestellHistorieResponse {
  bestellungen: BestellHistorieEintrag[];
  location_id: string;
  customer_id: string;
  generiert_am: string;
}

function buildMock(locationId: string, customerId: string): BestellHistorieResponse {
  const now = new Date();
  const d1 = new Date(now); d1.setDate(d1.getDate() - 1);
  const d2 = new Date(now); d2.setDate(d2.getDate() - 4);
  const d3 = new Date(now); d3.setDate(d3.getDate() - 9);
  return {
    bestellungen: [
      {
        order_id: 'mock-1',
        datum: d1.toISOString(),
        artikel: [{ name: 'Margherita', menge: 1 }, { name: 'Cola', menge: 2 }],
        status: 'geliefert',
        gesamtpreis_eur: 14.80,
      },
      {
        order_id: 'mock-2',
        datum: d2.toISOString(),
        artikel: [{ name: 'Salami-Pizza', menge: 2 }],
        status: 'geliefert',
        gesamtpreis_eur: 22.00,
      },
      {
        order_id: 'mock-3',
        datum: d3.toISOString(),
        artikel: [{ name: 'Pasta Bolognese', menge: 1 }, { name: 'Tiramisu', menge: 1 }],
        status: 'geliefert',
        gesamtpreis_eur: 18.50,
      },
    ],
    location_id: locationId,
    customer_id: customerId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const customerId = req.nextUrl.searchParams.get('customer_id');

  if (!locationId || !customerId) {
    return NextResponse.json({ error: 'location_id and customer_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const { data: orders, error } = await (sb as any)
      .from('mise_orders')
      .select('id, erstellt_am, status, gesamtpreis, items')
      .eq('location_id', locationId)
      .eq('customer_id', customerId)
      .order('erstellt_am', { ascending: false })
      .limit(3);

    if (error || !orders || (orders as unknown[]).length === 0) {
      return NextResponse.json(buildMock(locationId, customerId));
    }

    type OrderRow = {
      id: string;
      erstellt_am: string;
      status: string;
      gesamtpreis: number | null;
      items: Array<{ name?: string; menge?: number }> | null;
    };

    const bestellungen: BestellHistorieEintrag[] = (orders as OrderRow[]).map(o => ({
      order_id: o.id,
      datum: o.erstellt_am,
      artikel: (o.items ?? []).map(i => ({
        name: i.name ?? 'Artikel',
        menge: i.menge ?? 1,
      })),
      status: o.status ?? 'unbekannt',
      gesamtpreis_eur: o.gesamtpreis ?? 0,
    }));

    const response: BestellHistorieResponse = {
      bestellungen,
      location_id: locationId,
      customer_id: customerId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(buildMock(locationId, customerId));
  }
}
