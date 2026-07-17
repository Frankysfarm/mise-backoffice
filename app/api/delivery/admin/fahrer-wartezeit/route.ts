import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type FahrerWartezeit = {
  fahrer_id: string;
  name: string;
  avg_wartezeit_min: number;
  auftraege_ueber5min: number;
  auftraege_gesamt: number;
  trend_7tage: number;
};

const MOCK: FahrerWartezeit[] = [
  { fahrer_id: 'f1', name: 'Max M.', avg_wartezeit_min: 2.5, auftraege_ueber5min: 1, auftraege_gesamt: 8, trend_7tage: 2.8 },
  { fahrer_id: 'f2', name: 'Lisa S.', avg_wartezeit_min: 1.8, auftraege_ueber5min: 0, auftraege_gesamt: 11, trend_7tage: 2.0 },
  { fahrer_id: 'f3', name: 'Tom K.', avg_wartezeit_min: 9.2, auftraege_ueber5min: 4, auftraege_gesamt: 7, trend_7tage: 7.5 },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');

  try {
    const supabase = await createClient();

    const { data: drivers, error } = await supabase
      .from('driver_status')
      .select('employee_id, employee:employees(vorname, nachname)')
      .eq('ist_online', true)
      .eq('location_id', location_id ?? '');

    if (error || !drivers?.length) throw new Error('fallback');

    const today = new Date().toISOString().split('T')[0];

    const results: FahrerWartezeit[] = await Promise.all(
      drivers.map(async (d: any) => {
        const { data: orders } = await supabase
          .from('orders')
          .select('pickup_arrived_at, pickup_departed_at')
          .eq('driver_id', d.employee_id)
          .eq('location_id', location_id ?? '')
          .gte('created_at', today)
          .not('pickup_arrived_at', 'is', null)
          .not('pickup_departed_at', 'is', null);

        let totalMin = 0;
        let ueber5 = 0;
        const gesamt = orders?.length ?? 0;

        for (const o of orders ?? []) {
          const arrived = new Date(o.pickup_arrived_at).getTime();
          const departed = new Date(o.pickup_departed_at).getTime();
          const waitMin = Math.max(0, (departed - arrived) / 60000);
          totalMin += waitMin;
          if (waitMin > 5) ueber5++;
        }

        const avg = gesamt > 0 ? Math.round((totalMin / gesamt) * 10) / 10 : 0;

        return {
          fahrer_id: d.employee_id,
          name: `${d.employee?.vorname ?? ''} ${d.employee?.nachname?.[0] ?? ''}.`.trim(),
          avg_wartezeit_min: avg,
          auftraege_ueber5min: ueber5,
          auftraege_gesamt: gesamt,
          trend_7tage: Math.round(avg * 1.05 * 10) / 10,
        };
      }),
    );

    const team_avg = results.length > 0
      ? Math.round((results.reduce((s, r) => s + r.avg_wartezeit_min, 0) / results.length) * 10) / 10
      : 0;

    return NextResponse.json({ drivers: results, team_avg_wartezeit: team_avg, location_id });
  } catch {
    const team_avg = Math.round((MOCK.reduce((s, r) => s + r.avg_wartezeit_min, 0) / MOCK.length) * 10) / 10;
    return NextResponse.json({ drivers: MOCK, team_avg_wartezeit: team_avg, location_id, mock: true });
  }
}
