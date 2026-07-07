import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ ok: false, error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, status, created_at, confirmed_at, prep_started_at')
      .eq('location_id', locationId)
      .in('status', ['bestätigt', 'in_zubereitung', 'fertig'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    const aktive = orders ?? [];
    const offeneBestellungen = aktive.filter((o) =>
      ['bestätigt', 'in_zubereitung'].includes(o.status),
    ).length;
    const inZubereitung = aktive.filter((o) => o.status === 'in_zubereitung').length;
    const fertigWartend = aktive.filter((o) => o.status === 'fertig').length;

    const now = Date.now();
    const avgPrepMinPerOrder = 8;
    let prognoseWarteMin = 0;
    if (inZubereitung > 0) {
      const inPrepOrders = aktive.filter((o) => o.status === 'in_zubereitung');
      const avgElapsedMin =
        inPrepOrders.reduce((sum, o) => {
          const ref = o.prep_started_at ?? o.confirmed_at ?? o.created_at;
          return sum + (now - new Date(ref).getTime()) / 60000;
        }, 0) / inPrepOrders.length;
      const remainingCurrent = Math.max(0, avgPrepMinPerOrder - avgElapsedMin);
      prognoseWarteMin = Math.round(remainingCurrent + offeneBestellungen * 2);
    } else {
      prognoseWarteMin = Math.round(offeneBestellungen * avgPrepMinPerOrder);
    }

    const signal: 'grün' | 'gelb' | 'rot' =
      offeneBestellungen <= 4 ? 'grün' : offeneBestellungen <= 9 ? 'gelb' : 'rot';

    return NextResponse.json({
      ok: true,
      signal,
      offeneBestellungen,
      inZubereitung,
      fertigWartend,
      prognoseWarteMin,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('kuechen-kapazitaets-warnsignal error:', err);
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}
