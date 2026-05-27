import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEV_DRIVER_ID = 'aa00482a-9567-48df-90aa-2303dc23cc3c';

/**
 * GET /api/driver-app/me/orders
 * Liefert alle aktiven Orders die dem Driver gerade zugewiesen sind
 * (status in [bestätigt, in_zubereitung, fertig, unterwegs]).
 */
export async function GET(_req: NextRequest) {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('customer_orders')
    .select(`
      id, bestellnummer, status, gesamt_summe, zahlungsart,
      kunde_name, kunde_telefon, lieferadresse_strasse, lieferadresse_hausnr,
      lieferadresse_plz, lieferadresse_ort, lieferadresse_lat, lieferadresse_lng,
      geschaetzte_zubereitung_min, bestaetigt_am, fertig_am, abgeholt_am,
      tenants(name, logo_url),
      customer_order_items(id, name, quantity, einzelpreis)
    `)
    .eq('mise_driver_id', DEV_DRIVER_ID)
    .in('status', ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'])
    .order('bestaetigt_am', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orders = (data ?? []).map((o: any) => ({
    id: o.id,
    bestellnummer: o.bestellnummer,
    restaurantName: o.tenants?.name ?? '—',
    restaurantAddress: '',
    customerName: o.kunde_name ?? '—',
    customerAddress: [o.lieferadresse_strasse, o.lieferadresse_hausnr, '·', o.lieferadresse_plz, o.lieferadresse_ort].filter(Boolean).join(' '),
    customerPhone: o.kunde_telefon ?? '',
    customerLat: Number(o.lieferadresse_lat) || 50.7754,
    customerLng: Number(o.lieferadresse_lng) || 6.0838,
    items: (o.customer_order_items ?? []).map((i: any) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      price: Number(i.einzelpreis ?? 0),
      checked: false,
    })),
    distance: '~',
    estimatedTime: o.geschaetzte_zubereitung_min ? `${o.geschaetzte_zubereitung_min} Min.` : '~',
    payout: 0,
    tip: 0,
    totalAmount: Number(o.gesamt_summe ?? 0),
    paymentMethod: (o.zahlungsart === 'bar' ? 'cash' : 'card') as 'cash' | 'card',
    status: o.status === 'fertig' ? 'picked' :
            o.status === 'unterwegs' ? 'delivering' : 'accepted',
    createdAt: new Date(o.bestaetigt_am ?? Date.now()),
  }));

  return NextResponse.json({ orders });
}
