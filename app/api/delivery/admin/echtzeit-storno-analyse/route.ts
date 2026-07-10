import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StornoGrund = {
  grund: string;
  anzahl: number;
  anteil_pct: number;
  tageszeit: string;
  trend: 'steigend' | 'stabil' | 'fallend';
};

type StundeRate = {
  stunde: number;
  label: string;
  storno_rate_pct: number;
  total: number;
  stornos: number;
};

type ApiResponse = {
  gesamt_storno_rate_pct: number;
  alert: boolean;
  alert_message: string | null;
  grunde: StornoGrund[];
  stunden: StundeRate[];
  kritischste_stunde: string | null;
};

function mockData(): ApiResponse {
  return {
    gesamt_storno_rate_pct: 7.4,
    alert: false,
    alert_message: null,
    grunde: [
      { grund: 'Zu lange Wartezeit', anzahl: 12, anteil_pct: 40, tageszeit: '19:00–20:00', trend: 'steigend' },
      { grund: 'Falsche Bestellung', anzahl: 7, anteil_pct: 23, tageszeit: '12:00–13:00', trend: 'stabil' },
      { grund: 'Keine Antwort Fahrer', anzahl: 5, anteil_pct: 17, tageszeit: '18:00–19:00', trend: 'fallend' },
      { grund: 'Technischer Fehler', anzahl: 4, anteil_pct: 13, tageszeit: 'ganztags', trend: 'stabil' },
      { grund: 'Sonstiges', anzahl: 2, anteil_pct: 7, tageszeit: 'ganztags', trend: 'stabil' },
    ],
    stunden: [
      { stunde: 11, label: '11:00', storno_rate_pct: 2.1, total: 48, stornos: 1 },
      { stunde: 12, label: '12:00', storno_rate_pct: 5.3, total: 75, stornos: 4 },
      { stunde: 13, label: '13:00', storno_rate_pct: 6.7, total: 90, stornos: 6 },
      { stunde: 17, label: '17:00', storno_rate_pct: 4.5, total: 66, stornos: 3 },
      { stunde: 18, label: '18:00', storno_rate_pct: 8.2, total: 85, stornos: 7 },
      { stunde: 19, label: '19:00', storno_rate_pct: 9.1, total: 110, stornos: 10 },
      { stunde: 20, label: '20:00', storno_rate_pct: 7.8, total: 77, stornos: 6 },
    ],
    kritischste_stunde: '19:00',
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();
    const since = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();

    const qAll = supabase
      .from('customer_orders')
      .select('id, created_at, status, storno_grund')
      .gte('created_at', since);
    if (locationId) qAll.eq('location_id', locationId);
    const { data: orders, error } = await qAll;
    if (error || !orders || orders.length < 5) throw new Error('insufficient');

    const stornos = orders.filter((o) => o.status === 'storniert' || o.status === 'cancelled');
    const rate = (stornos.length / orders.length) * 100;

    const grundMap: Record<string, number> = {};
    for (const s of stornos) {
      const g = (s.storno_grund as string | null) ?? 'Sonstiges';
      grundMap[g] = (grundMap[g] ?? 0) + 1;
    }
    const grunde: StornoGrund[] = Object.entries(grundMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([grund, anzahl]) => ({
        grund,
        anzahl,
        anteil_pct: parseFloat(((anzahl / stornos.length) * 100).toFixed(1)),
        tageszeit: 'ganztags',
        trend: 'stabil' as const,
      }));

    const hourBuckets: Record<number, { total: number; stornos: number }> = {};
    for (const o of orders) {
      const h = new Date(o.created_at).getHours();
      if (!hourBuckets[h]) hourBuckets[h] = { total: 0, stornos: 0 };
      hourBuckets[h].total++;
      if (o.status === 'storniert' || o.status === 'cancelled') hourBuckets[h].stornos++;
    }

    const stunden: StundeRate[] = Object.entries(hourBuckets)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([h, { total, stornos: s }]) => ({
        stunde: Number(h),
        label: `${String(h).padStart(2, '0')}:00`,
        storno_rate_pct: parseFloat(((s / total) * 100).toFixed(1)),
        total,
        stornos: s,
      }));

    const worst = stunden.length > 0
      ? stunden.reduce((a, b) => (b.storno_rate_pct > a.storno_rate_pct ? b : a))
      : null;

    const alert = rate > 10;
    return NextResponse.json({
      gesamt_storno_rate_pct: parseFloat(rate.toFixed(1)),
      alert,
      alert_message: alert ? `Storno-Rate ${rate.toFixed(1)}% liegt über dem Schwellwert von 10%!` : null,
      grunde,
      stunden,
      kritischste_stunde: worst?.label ?? null,
    });
  } catch {
    return NextResponse.json(mockData());
  }
}
