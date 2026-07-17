import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MOCK: FahrerKmData[] = [
  { fahrer_id: 'f1', name: 'Max M.', km_heute: 87, km_ziel: 120, trend_7tage: 95, fahrzeug: 'bike' },
  { fahrer_id: 'f2', name: 'Lisa S.', km_heute: 134, km_ziel: 120, trend_7tage: 118, fahrzeug: 'car' },
  { fahrer_id: 'f3', name: 'Tom K.', km_heute: 42, km_ziel: 100, trend_7tage: 88, fahrzeug: 'bike' },
];

type FahrerKmData = {
  fahrer_id: string;
  name: string;
  km_heute: number;
  km_ziel: number;
  trend_7tage: number;
  fahrzeug: string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');

  try {
    const supabase = await createClient();

    const { data: drivers, error } = await supabase
      .from('driver_status')
      .select('employee_id, fahrzeug, employee:employees(vorname, nachname)')
      .eq('ist_online', true)
      .eq('location_id', location_id ?? '');

    if (error || !drivers?.length) throw new Error('fallback');

    const today = new Date().toISOString().split('T')[0];

    const results: FahrerKmData[] = await Promise.all(
      drivers.map(async (d: any) => {
        const { data: stops } = await supabase
          .from('tour_stops')
          .select('distanz_km')
          .eq('driver_id', d.employee_id)
          .gte('created_at', today);

        const km_heute = (stops ?? []).reduce((s: number, st: any) => s + (st.distanz_km ?? 0), 0);
        const km_ziel = d.fahrzeug === 'car' ? 120 : 100;
        return {
          fahrer_id: d.employee_id,
          name: `${d.employee?.vorname ?? ''} ${d.employee?.nachname?.[0] ?? ''}.`.trim(),
          km_heute: Math.round(km_heute * 10) / 10,
          km_ziel,
          trend_7tage: km_heute * 0.9,
          fahrzeug: d.fahrzeug ?? 'bike',
        };
      })
    );

    return NextResponse.json({ drivers: results, location_id });
  } catch {
    return NextResponse.json({ drivers: MOCK, location_id, mock: true });
  }
}
