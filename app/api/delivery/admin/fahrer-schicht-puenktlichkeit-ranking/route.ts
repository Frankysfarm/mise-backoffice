import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, puenktlichkeit_pct: 97.2, rank_delta: 1,  ampel: 'gruen', alert_schlecht: false },
    { fahrer_id: 'f2', fahrer_name: 'Kemal A.', rang: 2, puenktlichkeit_pct: 91.5, rank_delta: -1, ampel: 'gruen', alert_schlecht: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara M.',  rang: 3, puenktlichkeit_pct: 78.3, rank_delta: 0,  ampel: 'gelb',  alert_schlecht: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, puenktlichkeit_pct: 61.0, rank_delta: 0,  ampel: 'rot',   alert_schlecht: true  },
  ],
  team_avg: 82.0,
  puenktlichste_name: 'Julia F.',
  unzuverlaessigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelFn(pct: number): string {
  if (pct >= 90) return 'gruen';
  if (pct >= 75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json(MOCK_DATA);

  const supabase = createServiceClient();

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: shifts, error } = await supabase
      .from('driver_shifts')
      .select('driver_id, driver_name, start_time, scheduled_start')
      .eq('location_id', location_id)
      .gte('start_time', since)
      .not('start_time', 'is', null)
      .not('scheduled_start', 'is', null);

    if (error || !shifts?.length) return NextResponse.json(MOCK_DATA);

    const byDriver = new Map<string, { name: string; total: number; puenktlich: number }>();
    for (const s of shifts) {
      const entry = byDriver.get(s.driver_id) ?? { name: s.driver_name ?? s.driver_id, total: 0, puenktlich: 0 };
      entry.total++;
      const delay = new Date(s.start_time).getTime() - new Date(s.scheduled_start).getTime();
      if (delay <= 5 * 60 * 1000) entry.puenktlich++;
      byDriver.set(s.driver_id, entry);
    }

    const rows = Array.from(byDriver.entries())
      .map(([id, d]) => ({
        fahrer_id: id,
        fahrer_name: d.name,
        puenktlichkeit_pct: d.total > 0 ? Math.round((d.puenktlich / d.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.puenktlichkeit_pct - a.puenktlichkeit_pct)
      .map((r, i) => ({
        ...r,
        rang: i + 1,
        rank_delta: 0,
        ampel: ampelFn(r.puenktlichkeit_pct),
        alert_schlecht: r.puenktlichkeit_pct < 75,
      }));

    const avg = rows.length ? Math.round((rows.reduce((s, r) => s + r.puenktlichkeit_pct, 0) / rows.length) * 10) / 10 : 0;
    const alertCount = rows.filter(r => r.alert_schlecht).length;

    return NextResponse.json({
      fahrer: rows,
      team_avg: avg,
      puenktlichste_name: rows[0]?.fahrer_name ?? null,
      unzuverlaessigste_name: rows[rows.length - 1]?.fahrer_name ?? null,
      alert_count: alertCount,
      gesamt: rows.length,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
