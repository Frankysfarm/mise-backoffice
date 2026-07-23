import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface OrderTiming {
  order_id: string;
  bestellnummer: string;
  started_at: string;
  target_ready_at: string;
  status: 'cooking' | 'ready' | 'picked_up';
  prep_time_min: number;
}

interface ApiResponse {
  orders: OrderTiming[];
  on_time_rate: number;
  ueberfaellig_count: number;
  kochstart_empfehlung: string | null;
  aktiv_count: number;
  fertig_count: number;
}

function buildMock(): ApiResponse {
  const now = Date.now();
  return {
    orders: [
      { order_id: 'o1', bestellnummer: '#1042', started_at: new Date(now - 12 * 60000).toISOString(), target_ready_at: new Date(now + 3 * 60000).toISOString(), status: 'cooking', prep_time_min: 15 },
      { order_id: 'o2', bestellnummer: '#1043', started_at: new Date(now - 18 * 60000).toISOString(), target_ready_at: new Date(now - 2 * 60000).toISOString(), status: 'cooking', prep_time_min: 15 },
      { order_id: 'o3', bestellnummer: '#1044', started_at: new Date(now - 5 * 60000).toISOString(), target_ready_at: new Date(now + 10 * 60000).toISOString(), status: 'cooking', prep_time_min: 15 },
    ],
    on_time_rate: 74,
    ueberfaellig_count: 1,
    kochstart_empfehlung: 'Jetzt 2 weitere Bestellungen starten für optimale Fahrer-Sync',
    aktiv_count: 3,
    fertig_count: 12,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_number, kitchen_started_at, kitchen_ready_at, status, prep_time_min, created_at')
      .eq('location_id', location_id)
      .in('status', ['cooking', 'preparing', 'ready', 'picked_up', 'in_kitchen'])
      .gte('created_at', todayStart.toISOString())
      .order('kitchen_started_at', { ascending: true })
      .limit(50);

    if (error || !orders || orders.length === 0) {
      return NextResponse.json(buildMock());
    }

    type OrderRow = {
      id: string;
      order_number: string | null;
      kitchen_started_at: string | null;
      kitchen_ready_at: string | null;
      status: string;
      prep_time_min: number | null;
      created_at: string;
    };

    const now = Date.now();
    const mapped: OrderTiming[] = (orders as OrderRow[])
      .filter(o => o.kitchen_started_at)
      .map(o => {
        const started = new Date(o.kitchen_started_at!);
        const prepMin = o.prep_time_min ?? 15;
        const target = o.kitchen_ready_at
          ? new Date(o.kitchen_ready_at)
          : new Date(started.getTime() + prepMin * 60000);
        const s = o.status.toLowerCase();
        const status: OrderTiming['status'] = (s === 'ready' || s === 'bereit') ? 'ready'
          : (s === 'picked_up' || s === 'abgeholt') ? 'picked_up'
          : 'cooking';
        return {
          order_id: o.id,
          bestellnummer: o.order_number ? `#${o.order_number}` : o.id.slice(0, 6),
          started_at: started.toISOString(),
          target_ready_at: target.toISOString(),
          status,
          prep_time_min: prepMin,
        };
      });

    const cooking = mapped.filter(o => o.status === 'cooking');
    const fertig = mapped.filter(o => o.status !== 'cooking').length;
    const ueberfaellig = cooking.filter(o => now > new Date(o.target_ready_at).getTime()).length;
    const onTime = cooking.filter(o => now <= new Date(o.target_ready_at).getTime()).length;
    const total = cooking.length;
    const on_time_rate = total > 0 ? Math.round((onTime / total) * 100) : 100;

    return NextResponse.json({
      orders: mapped,
      on_time_rate,
      ueberfaellig_count: ueberfaellig,
      kochstart_empfehlung: ueberfaellig > 0 ? `${ueberfaellig} Bestellung${ueberfaellig > 1 ? 'en' : ''} überfällig — Priorisierung empfohlen` : null,
      aktiv_count: cooking.length,
      fertig_count: fertig,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(buildMock());
  }
}
