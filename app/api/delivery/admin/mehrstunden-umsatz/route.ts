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
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const { data: orders, error } = await supabase
      .from('orders')
      .select('total_price, created_at, status')
      .eq('location_id', locationId)
      .gte('created_at', startOfDay.toISOString())
      .not('status', 'eq', 'storniert');

    if (error) throw error;

    const hourlyMap: Record<number, { umsatz: number; anzahl: number }> = {};
    for (let h = 0; h <= today.getHours(); h++) {
      hourlyMap[h] = { umsatz: 0, anzahl: 0 };
    }

    for (const o of orders ?? []) {
      const hour = new Date(o.created_at).getHours();
      if (hourlyMap[hour] !== undefined) {
        hourlyMap[hour].umsatz += Number(o.total_price ?? 0);
        hourlyMap[hour].anzahl += 1;
      }
    }

    const durchschnittlichePrognose = 180;

    const hours = Object.entries(hourlyMap).map(([h, val]) => ({
      hour: Number(h),
      label: `${String(h).padStart(2, '0')}:00`,
      umsatz: Math.round(val.umsatz * 100) / 100,
      anzahl: val.anzahl,
      prognose: durchschnittlichePrognose,
    }));

    const totalUmsatz = hours.reduce((s, h) => s + h.umsatz, 0);
    const totalAnzahl = hours.reduce((s, h) => s + h.anzahl, 0);
    const gesamtPrognose = hours.length * durchschnittlichePrognose;
    const abweichungPct =
      gesamtPrognose > 0
        ? Math.round(((totalUmsatz - gesamtPrognose) / gesamtPrognose) * 100)
        : 0;

    return NextResponse.json({
      ok: true,
      hours,
      summary: {
        totalUmsatz: Math.round(totalUmsatz * 100) / 100,
        totalAnzahl,
        gesamtPrognose,
        abweichungPct,
      },
    });
  } catch (err) {
    console.error('mehrstunden-umsatz error:', err);
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}
