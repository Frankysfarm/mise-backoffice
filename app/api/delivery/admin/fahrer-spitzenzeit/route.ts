import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type FahrerSpitzenzeit = {
  fahrer_id: string;
  name: string;
  auftraege_spitze: number;
  auftraege_normal: number;
  peak_score: number;
  trend_7tage: number;
};

const MOCK: FahrerSpitzenzeit[] = [
  { fahrer_id: 'f1', name: 'Max M.', auftraege_spitze: 8, auftraege_normal: 4, peak_score: 75, trend_7tage: 70 },
  { fahrer_id: 'f2', name: 'Lisa S.', auftraege_spitze: 12, auftraege_normal: 5, peak_score: 92, trend_7tage: 88 },
  { fahrer_id: 'f3', name: 'Tom K.', auftraege_spitze: 4, auftraege_normal: 6, peak_score: 55, trend_7tage: 60 },
];

function isPeakHour(hour: number): boolean {
  return (hour >= 12 && hour < 14) || (hour >= 18 && hour < 21);
}

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

    const results: FahrerSpitzenzeit[] = await Promise.all(
      drivers.map(async (d: any) => {
        const { data: orders } = await supabase
          .from('orders')
          .select('created_at')
          .eq('driver_id', d.employee_id)
          .eq('status', 'delivered')
          .gte('created_at', today);

        let peakCount = 0;
        let normalCount = 0;

        for (const o of orders ?? []) {
          const hour = new Date(o.created_at).getHours();
          if (isPeakHour(hour)) peakCount++;
          else normalCount++;
        }

        const total = peakCount + normalCount;
        const peakRatio = total > 0 ? peakCount / total : 0;
        const peakScore = Math.round(
          Math.min(100, (peakRatio * 1.5 + (peakCount >= 8 ? 0.3 : 0)) * 100),
        );

        return {
          fahrer_id: d.employee_id,
          name: `${d.employee?.vorname ?? ''} ${d.employee?.nachname?.[0] ?? ''}.`.trim(),
          auftraege_spitze: peakCount,
          auftraege_normal: normalCount,
          peak_score: peakScore,
          trend_7tage: Math.round(peakScore * 0.95),
        };
      }),
    );

    return NextResponse.json({ drivers: results, location_id });
  } catch {
    return NextResponse.json({ drivers: MOCK, location_id, mock: true });
  }
}
