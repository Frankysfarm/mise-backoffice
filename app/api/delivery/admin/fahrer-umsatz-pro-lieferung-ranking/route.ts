import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_euro: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  schlechtester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_euro: 42.50, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_euro: 36.80, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_euro: 28.40, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_euro: 19.90, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg: 31.90,
  bester_name: 'Julia F.',
  schlechtester_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const now = new Date();
    const cur30 = new Date(now); cur30.setDate(cur30.getDate() - 30);
    const prev30 = new Date(now); prev30.setDate(prev30.getDate() - 60);

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_orders')
        .select('driver_id, driver_name, total_amount')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString())
        .not('driver_id', 'is', null),
      supabase
        .from('delivery_orders')
        .select('driver_id, total_amount')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString())
        .not('driver_id', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; sum: number; count: number }>();
    for (const o of curData) {
      const amount = Number(o.total_amount ?? 0);
      if (amount <= 0) continue;
      const prev = groupCur.get(o.driver_id);
      if (prev) {
        prev.sum += amount;
        prev.count += 1;
      } else {
        groupCur.set(o.driver_id, { name: o.driver_name ?? o.driver_id, sum: amount, count: 1 });
      }
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const drivers = Array.from(groupCur.entries()).map(([id, d]) => ({
      fahrer_id: id,
      fahrer_name: d.name,
      avg_euro: Math.round((d.sum / d.count) * 100) / 100,
    }));

    drivers.sort((a, b) => b.avg_euro - a.avg_euro);
    const gesamt = drivers.length;

    const prevByDriver = new Map<string, { sum: number; count: number }>();
    for (const o of prevRes.data ?? []) {
      const amount = Number(o.total_amount ?? 0);
      if (amount <= 0) continue;
      const prev = prevByDriver.get(o.driver_id);
      if (prev) { prev.sum += amount; prev.count += 1; }
      else prevByDriver.set(o.driver_id, { sum: amount, count: 1 });
    }
    const prevRanked = Array.from(prevByDriver.entries())
      .map(([id, d]) => ({ id, avg: d.sum / d.count }))
      .sort((a, b) => b.avg - a.avg);
    const prevMap = new Map<string, number>();
    prevRanked.forEach((f, i) => prevMap.set(f.id, i + 1));

    const teamAvg = drivers.reduce((s, d) => s + d.avg_euro, 0) / gesamt;

    const fahrer: FahrerRow[] = drivers.map((d, i) => {
      const rang = i + 1;
      const prevRang = prevMap.get(d.fahrer_id) ?? rang;
      return {
        ...d,
        rang,
        rank_delta: rang - prevRang,
        ampel: ampelVon(rang, gesamt),
        alert_niedrig: d.avg_euro < 25,
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg: Math.round(teamAvg * 100) / 100,
      bester_name: fahrer[0]?.fahrer_name ?? '',
      schlechtester_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
