import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MOCK_DATA = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, schichten_pro_woche: 5.8, rank_delta: 1,  ampel: 'gruen', alert_low: false, alert_wenig: false },
    { fahrer_id: 'f2', fahrer_name: 'Kemal A.', rang: 2, schichten_pro_woche: 4.9, rank_delta: -1, ampel: 'gruen', alert_low: false, alert_wenig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara M.',  rang: 3, schichten_pro_woche: 3.2, rank_delta: 0,  ampel: 'gelb',  alert_low: false, alert_wenig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, schichten_pro_woche: 1.5, rank_delta: 0,  ampel: 'rot',   alert_low: true,  alert_wenig: true  },
  ],
  team_avg: 3.85,
  dichteste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  fleissigster_name: 'Julia F.',
  wenigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelFn(v: number): string {
  if (v >= 4) return 'gruen';
  if (v >= 2.5) return 'gelb';
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
      .select('driver_id, driver_name, start_time, end_time')
      .eq('location_id', location_id)
      .gte('start_time', since)
      .not('end_time', 'is', null);

    if (error || !shifts?.length) return NextResponse.json(MOCK_DATA);

    const byDriver = new Map<string, { name: string; count: number }>();
    for (const s of shifts) {
      const entry = byDriver.get(s.driver_id) ?? { name: s.driver_name ?? s.driver_id, count: 0 };
      entry.count++;
      byDriver.set(s.driver_id, entry);
    }

    const WEEKS = 4.28;
    const rows = Array.from(byDriver.entries())
      .map(([id, d]) => ({ fahrer_id: id, fahrer_name: d.name, schichten_pro_woche: Math.round((d.count / WEEKS) * 10) / 10 }))
      .sort((a, b) => b.schichten_pro_woche - a.schichten_pro_woche)
      .map((r, i) => ({
        ...r,
        rang: i + 1,
        rank_delta: 0,
        ampel: ampelFn(r.schichten_pro_woche),
        alert_low: r.schichten_pro_woche < 2,
        alert_wenig: r.schichten_pro_woche < 3,
      }));

    const avg = rows.length ? Math.round((rows.reduce((s, r) => s + r.schichten_pro_woche, 0) / rows.length) * 10) / 10 : 0;
    const alertCount = rows.filter(r => r.alert_low).length;
    const topName = rows[0]?.fahrer_name ?? null;
    const bottomName = rows[rows.length - 1]?.fahrer_name ?? null;

    return NextResponse.json({
      fahrer: rows,
      team_avg: avg,
      dichteste_name: topName,
      niedrigste_name: bottomName,
      fleissigster_name: topName,
      wenigste_name: bottomName,
      alert_count: alertCount,
      gesamt: rows.length,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
