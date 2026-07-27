import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MOCK_DATA = {
  order_id:    'mock-order-1',
  status:      'in_delivery',
  phase:       3,
  eta_min:     12,
  customer_name: 'Max Mustermann',
  adresse:     'Musterstraße 1, 52062 Aachen',
  fahrer_name: 'Julia F.',
  phases: [
    { label: 'Bestellt',      done: true  },
    { label: 'In Zubereitung', done: true  },
    { label: 'Unterwegs',     done: false },
    { label: 'Geliefert',     done: false },
  ],
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const order_id    = searchParams.get('order_id');
  const location_id = searchParams.get('location_id');

  if (!order_id || !location_id) return NextResponse.json(MOCK_DATA);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  );

  try {
    const { data: order } = await supabase
      .from('orders')
      .select('id, status, customer_name, adresse, eta')
      .eq('id', order_id)
      .eq('location_id', location_id)
      .single();

    if (!order) return NextResponse.json(MOCK_DATA);

    const status: string = order.status ?? 'pending';
    const phaseMap: Record<string, number> = {
      pending:      1,
      confirmed:    1,
      preparing:    2,
      ready:        2,
      in_delivery:  3,
      delivered:    4,
    };
    const phase = phaseMap[status] ?? 1;

    const etaMin = order.eta
      ? Math.max(0, Math.round((new Date(order.eta).getTime() - Date.now()) / 60000))
      : null;

    return NextResponse.json({
      order_id:     order.id,
      status,
      phase,
      eta_min:      etaMin,
      customer_name: order.customer_name ?? '—',
      adresse:      order.adresse ?? '—',
      fahrer_name:  MOCK_DATA.fahrer_name,
      phases: [
        { label: 'Bestellt',       done: phase >= 1 },
        { label: 'In Zubereitung', done: phase >= 2 },
        { label: 'Unterwegs',      done: phase >= 3 },
        { label: 'Geliefert',      done: phase >= 4 },
      ],
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
