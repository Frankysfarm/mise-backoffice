import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  schichten_pro_woche: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_wenig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  fleissigster_name: string;
  wenigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, schichten_pro_woche: 5.8, rank_delta:  1, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, schichten_pro_woche: 4.5, rank_delta:  0, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, schichten_pro_woche: 3.2, rank_delta: -1, ampel: 'gelb',  alert_wenig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, schichten_pro_woche: 1.8, rank_delta:  0, ampel: 'rot',   alert_wenig: true  },
  ],
  team_avg: 3.83,
  fleissigster_name: 'Julia F.',
  wenigste_name: 'Tim B.',
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
    const cur30 = new Date(now.getTime() - 30 * 86400000).toISOString();
    const prev30 = new Date(now.getTime() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_shifts')
        .select('driver_id, driver_name, started_at')
        .eq('location_id', locationId)
        .gte('started_at', cur30)
        .not('driver_id', 'is', null),
      supabase
        .from('delivery_shifts')
        .select('driver_id, started_at')
        .eq('location_id', locationId)
        .gte('started_at', prev30)
        .lt('started_at', cur30)
        .not('driver_id', 'is', null),
    ]);

    const curRows = curRes.data ?? [];
    if (!curRows.length) return NextResponse.json(MOCK_DATA);

    type DriverAcc = { name: string; count: number };
    const groupCur = new Map<string, DriverAcc>();
    for (const s of curRows) {
      if (!groupCur.has(s.driver_id)) groupCur.set(s.driver_id, { name: s.driver_name ?? s.driver_id, count: 0 });
      groupCur.get(s.driver_id)!.count += 1;
    }

    const groupPrev = new Map<string, number>();
    for (const s of (prevRes.data ?? []) as { driver_id: string }[]) {
      groupPrev.set(s.driver_id, (groupPrev.get(s.driver_id) ?? 0) + 1);
    }

    // 30 days ≈ 4.286 weeks
    const WEEKS = 30 / 7;

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name,
      schichten_pro_woche: Math.round((v.count / WEEKS) * 10) / 10,
      prev_schichten: Math.round(((groupPrev.get(id) ?? v.count) / WEEKS) * 10) / 10,
    }));

    const sorted = [...unsorted].sort((a, b) => b.schichten_pro_woche - a.schichten_pro_woche);
    const prevSorted = [...unsorted].sort((a, b) => b.prev_schichten - a.prev_schichten);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const total = sorted.length;
    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        schichten_pro_woche: f.schichten_pro_woche,
        rank_delta: rang - prevRang,
        ampel,
        alert_wenig: f.schichten_pro_woche < 3,
      };
    });

    const team_avg = Math.round((fahrer.reduce((s, f) => s + f.schichten_pro_woche, 0) / total) * 10) / 10;

    return NextResponse.json({
      fahrer,
      team_avg,
      fleissigster_name: fahrer[0]?.fahrer_name ?? '',
      wenigste_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_wenig).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
