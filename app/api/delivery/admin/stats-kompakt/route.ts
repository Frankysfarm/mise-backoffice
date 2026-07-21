import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'gleich';

interface KpiEntry {
  label: string;
  value: string;
  trend: Trend;
  trend_delta: string;
  ampel: Ampel;
}

function trendDir(curr: number, prev: number): Trend {
  if (curr > prev * 1.02) return 'steigend';
  if (curr < prev * 0.98) return 'fallend';
  return 'gleich';
}

function fmtDelta(curr: number, prev: number, unit = ''): string {
  const d = Math.round((curr - prev) * 10) / 10;
  return d >= 0 ? `+${d}${unit}` : `${d}${unit}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const sb = await createServiceClient();
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

    const [
      { data: todayRows },
      { data: yesterdayRows },
      { data: perfRows },
      { data: perfPrevRows },
      { data: driverRows },
    ] = await Promise.all([
      sb.from('customer_orders')
        .select('id, status, gesamtbetrag')
        .eq('location_id', locationId).eq('typ', 'lieferung')
        .gte('created_at', todayStart.toISOString()),
      sb.from('customer_orders')
        .select('id, status, gesamtbetrag')
        .eq('location_id', locationId).eq('typ', 'lieferung')
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', todayStart.toISOString()),
      sb.from('delivery_performance')
        .select('delivery_time_min, on_time, driver_rating')
        .eq('location_id', locationId)
        .gte('created_at', todayStart.toISOString()),
      sb.from('delivery_performance')
        .select('delivery_time_min, on_time, driver_rating')
        .eq('location_id', locationId)
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', todayStart.toISOString()),
      sb.from('delivery_drivers')
        .select('id, is_online')
        .eq('location_id', locationId),
    ]);

    const today = todayRows ?? [];
    const yesterday = yesterdayRows ?? [];
    const perf = perfRows ?? [];
    const perfPrev = perfPrevRows ?? [];
    const drivers = driverRows ?? [];

    const totalToday = today.length;
    const totalYest = yesterday.length;
    const delivToday = today.filter((o) => o.status === 'geliefert').length;
    const cancelToday = today.filter((o) => o.status === 'storniert').length;
    const cancelYest = yesterday.filter((o) => o.status === 'storniert').length;
    const revenueToday = today.reduce((s, o) => s + (Number(o.gesamtbetrag) || 0), 0);
    const revenueYest = yesterday.reduce((s, o) => s + (Number(o.gesamtbetrag) || 0), 0);
    const avgTime = perf.length ? perf.reduce((s, p) => s + (p.delivery_time_min ?? 0), 0) / perf.length : 0;
    const avgTimePrev = perfPrev.length ? perfPrev.reduce((s, p) => s + (p.delivery_time_min ?? 0), 0) / perfPrev.length : 0;
    const onTimePct = perf.length ? Math.round(perf.filter((p) => p.on_time).length / perf.length * 100) : 0;
    const onTimePrevPct = perfPrev.length ? Math.round(perfPrev.filter((p) => p.on_time).length / perfPrev.length * 100) : 0;
    const avgRating = perf.filter((p) => p.driver_rating).length
      ? perf.filter((p) => p.driver_rating).reduce((s, p) => s + (p.driver_rating ?? 0), 0) / perf.filter((p) => p.driver_rating).length
      : 0;
    const avgRatingPrev = perfPrev.filter((p) => p.driver_rating).length
      ? perfPrev.filter((p) => p.driver_rating).reduce((s, p) => s + (p.driver_rating ?? 0), 0) / perfPrev.filter((p) => p.driver_rating).length
      : 0;
    const activeDrivers = drivers.filter((d) => d.is_online).length;
    const slaPct = delivToday && totalToday ? Math.round(delivToday / totalToday * 100) : 0;
    const cancelPct = totalToday ? Math.round(cancelToday / totalToday * 100) : 0;
    const cancelPctPrev = totalYest ? Math.round(cancelYest / totalYest * 100) : 0;

    const kpis: KpiEntry[] = [
      {
        label: 'Bestellungen',
        value: String(totalToday),
        trend: trendDir(totalToday, totalYest),
        trend_delta: fmtDelta(totalToday, totalYest),
        ampel: totalToday >= totalYest * 0.9 ? 'gruen' : 'gelb',
      },
      {
        label: 'Umsatz',
        value: `${Math.round(revenueToday)} €`,
        trend: trendDir(revenueToday, revenueYest),
        trend_delta: `${fmtDelta(revenueToday, revenueYest)} €`,
        ampel: revenueToday >= revenueYest * 0.9 ? 'gruen' : 'gelb',
      },
      {
        label: 'Lieferzeit',
        value: `${Math.round(avgTime)} Min`,
        trend: trendDir(avgTimePrev, avgTime),
        trend_delta: `${fmtDelta(avgTime, avgTimePrev, ' Min')}`,
        ampel: avgTime <= 30 ? 'gruen' : avgTime <= 45 ? 'gelb' : 'rot',
      },
      {
        label: 'Pünktlichkeit',
        value: `${onTimePct}%`,
        trend: trendDir(onTimePct, onTimePrevPct),
        trend_delta: fmtDelta(onTimePct, onTimePrevPct, '%'),
        ampel: onTimePct >= 85 ? 'gruen' : onTimePct >= 70 ? 'gelb' : 'rot',
      },
      {
        label: 'Bewertung',
        value: avgRating > 0 ? `${avgRating.toFixed(1)} ★` : '— ★',
        trend: trendDir(avgRating, avgRatingPrev),
        trend_delta: fmtDelta(avgRating, avgRatingPrev),
        ampel: avgRating >= 4.0 ? 'gruen' : avgRating >= 3.5 ? 'gelb' : 'rot',
      },
      {
        label: 'Aktive Fahrer',
        value: String(activeDrivers),
        trend: 'gleich',
        trend_delta: '0',
        ampel: activeDrivers >= 2 ? 'gruen' : activeDrivers === 1 ? 'gelb' : 'rot',
      },
      {
        label: 'SLA-Quote',
        value: `${slaPct}%`,
        trend: trendDir(slaPct, 90),
        trend_delta: fmtDelta(slaPct, 90, '%'),
        ampel: slaPct >= 85 ? 'gruen' : slaPct >= 70 ? 'gelb' : 'rot',
      },
      {
        label: 'Storno-Rate',
        value: `${cancelPct}%`,
        trend: trendDir(cancelPctPrev, cancelPct),
        trend_delta: fmtDelta(cancelPct, cancelPctPrev, '%'),
        ampel: cancelPct <= 5 ? 'gruen' : cancelPct <= 10 ? 'gelb' : 'rot',
      },
    ];

    return NextResponse.json({
      kpis,
      letzte_aktualisierung: now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    });
  } catch {
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}
