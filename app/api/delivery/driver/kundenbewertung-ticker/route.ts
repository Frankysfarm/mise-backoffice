import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');

  const mock = {
    letzteBewertung: {
      orderId: 'mock-1',
      sterne: 5,
      kommentar: 'Sehr schnell und freundlich!',
      zeitpunkt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      trinkgeld: 2.5,
    },
    wochenschnitt: 4.7,
    anzahlWoche: 23,
    trend: 'steigend' as const,
  };

  try {
    const supabase = await createClient();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const q = supabase
      .from('customer_orders')
      .select('id, driver_rating, driver_rating_comment, created_at, tip_eur')
      .gte('driver_rating', 1)
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (driverId) q.eq('driver_id', driverId);

    const { data: rows, error } = await q;
    if (error || !rows?.length) throw new Error('no data');

    const latest = rows[0];
    const scores = rows.map((r) => r.driver_rating as number).filter(Boolean);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    let trend: 'steigend' | 'fallend' | 'stabil' = 'stabil';
    if (scores.length >= 5) {
      const first = scores.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const last = scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      if (last - first > 0.2) trend = 'steigend';
      else if (first - last > 0.2) trend = 'fallend';
    }

    return NextResponse.json({
      letzteBewertung: {
        orderId: latest.id,
        sterne: latest.driver_rating,
        kommentar: latest.driver_rating_comment ?? null,
        zeitpunkt: latest.created_at,
        trinkgeld: latest.tip_eur ?? null,
      },
      wochenschnitt: Math.round(avg * 10) / 10,
      anzahlWoche: rows.length,
      trend,
    });
  } catch {
    return NextResponse.json(mock);
  }
}
