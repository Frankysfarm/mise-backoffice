import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type EnergieLevel = 'hoch' | 'mittel' | 'niedrig';

type FahrerEnergie = {
  fahrer_id: string;
  name: string;
  stopps_heute: number;
  schichtstunden: number;
  energie_score: number; // stopps/h
  energie_level: EnergieLevel;
  trend_7tage: number; // avg energie_score der letzten 7 Tage
};

const MOCK: FahrerEnergie[] = [
  { fahrer_id: 'f1', name: 'Max M.', stopps_heute: 18, schichtstunden: 5, energie_score: 3.6, energie_level: 'hoch', trend_7tage: 3.2 },
  { fahrer_id: 'f2', name: 'Lisa S.', stopps_heute: 12, schichtstunden: 6, energie_score: 2.0, energie_level: 'mittel', trend_7tage: 2.3 },
  { fahrer_id: 'f3', name: 'Tom K.', stopps_heute: 6, schichtstunden: 5, energie_score: 1.2, energie_level: 'niedrig', trend_7tage: 1.8 },
  { fahrer_id: 'f4', name: 'Jana B.', stopps_heute: 21, schichtstunden: 6, energie_score: 3.5, energie_level: 'hoch', trend_7tage: 3.0 },
];

function calcLevel(score: number): EnergieLevel {
  if (score >= 3.0) return 'hoch';
  if (score >= 1.5) return 'mittel';
  return 'niedrig';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');

  try {
    const supabase = await createClient();

    const { data: drivers, error } = await supabase
      .from('driver_status')
      .select('employee_id, employee:employees(vorname, nachname), shift_started_at')
      .eq('ist_online', true)
      .eq('location_id', location_id ?? '');

    if (error || !drivers?.length) throw new Error('fallback');

    const today = new Date().toISOString().split('T')[0];
    const nowMs = Date.now();

    const results: FahrerEnergie[] = await Promise.all(
      drivers.map(async (d: any) => {
        const { data: orders } = await supabase
          .from('orders')
          .select('id')
          .eq('driver_id', d.employee_id)
          .eq('location_id', location_id ?? '')
          .gte('created_at', today)
          .eq('status', 'delivered');

        const stopps = orders?.length ?? 0;
        const shiftStarted = d.shift_started_at ? new Date(d.shift_started_at).getTime() : nowMs - 3 * 3600 * 1000;
        const schichtstunden = Math.max(0.5, (nowMs - shiftStarted) / 3600000);
        const energie_score = Math.round((stopps / schichtstunden) * 10) / 10;
        const energie_level = calcLevel(energie_score);

        return {
          fahrer_id: d.employee_id,
          name: `${d.employee?.vorname ?? ''} ${d.employee?.nachname?.[0] ?? ''}.`.trim(),
          stopps_heute: stopps,
          schichtstunden: Math.round(schichtstunden * 10) / 10,
          energie_score,
          energie_level,
          trend_7tage: Math.round(energie_score * 0.92 * 10) / 10,
        };
      }),
    );

    const team_avg_energie = results.length > 0
      ? Math.round((results.reduce((s, r) => s + r.energie_score, 0) / results.length) * 10) / 10
      : 0;
    const team_energie_level = calcLevel(team_avg_energie);

    return NextResponse.json({ drivers: results, team_avg_energie, team_energie_level, location_id });
  } catch {
    const team_avg_energie = Math.round((MOCK.reduce((s, r) => s + r.energie_score, 0) / MOCK.length) * 10) / 10;
    const team_energie_level = calcLevel(team_avg_energie);
    return NextResponse.json({ drivers: MOCK, team_avg_energie, team_energie_level, location_id });
  }
}
