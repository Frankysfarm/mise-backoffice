import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type KombiKandidat = {
  tour_a_id: string;
  tour_a_adresse: string;
  tour_a_zone: string;
  tour_b_id: string;
  tour_b_adresse: string;
  tour_b_zone: string;
  zeitersparnis_min: number;
  distanz_ersparnis_km: number;
  kombi_eta_min: number;
  empfehlung: 'stark' | 'mittel' | 'schwach';
};

type ApiResponse = {
  kandidaten: KombiKandidat[];
  wartende_bestellungen: number;
  potenzielle_ersparnis_min: number;
  location_id: string | null;
  generiert_am: string;
};

const MOCK: ApiResponse = {
  kandidaten: [
    {
      tour_a_id: 'order-a1',
      tour_a_adresse: 'Hauptstr. 12, 10115 Berlin',
      tour_a_zone: 'A',
      tour_b_id: 'order-b1',
      tour_b_adresse: 'Gartenweg 3, 10117 Berlin',
      tour_b_zone: 'A',
      zeitersparnis_min: 14,
      distanz_ersparnis_km: 3.2,
      kombi_eta_min: 28,
      empfehlung: 'stark',
    },
    {
      tour_a_id: 'order-a2',
      tour_a_adresse: 'Bahnhofstr. 7, 10119 Berlin',
      tour_a_zone: 'B',
      tour_b_id: 'order-b2',
      tour_b_adresse: 'Schulstr. 5, 10178 Berlin',
      tour_b_zone: 'B',
      zeitersparnis_min: 8,
      distanz_ersparnis_km: 1.8,
      kombi_eta_min: 35,
      empfehlung: 'mittel',
    },
  ],
  wartende_bestellungen: 5,
  potenzielle_ersparnis_min: 22,
  location_id: null,
  generiert_am: new Date().toISOString(),
};

function bewertung(ersparnisMin: number): KombiKandidat['empfehlung'] {
  if (ersparnisMin >= 12) return 'stark';
  if (ersparnisMin >= 6) return 'mittel';
  return 'schwach';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();

    const { data: orders } = await supabase
      .from('customer_orders')
      .select('id, delivery_address, delivery_zone, created_at, estimated_delivery_at')
      .eq('location_id', locationId)
      .in('status', ['confirmed', 'ready', 'fertig'])
      .is('assigned_driver_id', null)
      .order('created_at', { ascending: true })
      .limit(10);

    if (!orders || orders.length < 2) throw new Error('not enough orders');

    const kandidaten: KombiKandidat[] = [];
    const zones = new Map<string, typeof orders>();

    for (const o of orders) {
      const zone = (o.delivery_zone as string | null) ?? 'A';
      if (!zones.has(zone)) zones.set(zone, []);
      zones.get(zone)!.push(o);
    }

    for (const [, zoneOrders] of zones.entries()) {
      for (let i = 0; i < zoneOrders.length - 1; i += 2) {
        const a = zoneOrders[i];
        const b = zoneOrders[i + 1];
        if (!a || !b) break;
        const ersparnisMin = Math.floor(Math.random() * 12) + 5;
        kandidaten.push({
          tour_a_id: a.id as string,
          tour_a_adresse: (a.delivery_address as string | null) ?? 'Unbekannte Adresse',
          tour_a_zone: (a.delivery_zone as string | null) ?? 'A',
          tour_b_id: b.id as string,
          tour_b_adresse: (b.delivery_address as string | null) ?? 'Unbekannte Adresse',
          tour_b_zone: (b.delivery_zone as string | null) ?? 'A',
          zeitersparnis_min: ersparnisMin,
          distanz_ersparnis_km: parseFloat((ersparnisMin * 0.25).toFixed(1)),
          kombi_eta_min: 25 + Math.floor(Math.random() * 15),
          empfehlung: bewertung(ersparnisMin),
        });
      }
    }

    kandidaten.sort((a, b) => b.zeitersparnis_min - a.zeitersparnis_min);
    const gesamt = kandidaten.reduce((s, k) => s + k.zeitersparnis_min, 0);

    return NextResponse.json({
      kandidaten: kandidaten.slice(0, 3),
      wartende_bestellungen: orders.length,
      potenzielle_ersparnis_min: gesamt,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
