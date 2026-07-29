import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  spaetabend_anteil_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  meister_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 1, spaetabend_anteil_pct: 42, rank_delta:  1, ampel: 'rot',   alert_hoch: true  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 2, spaetabend_anteil_pct: 28, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 3, spaetabend_anteil_pct: 16, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 4, spaetabend_anteil_pct:  8, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg_pct: 23.5,
  meister_name: 'Max M.',
  wenigster_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(pct: number, q25: number, q75: number): 'gruen' | 'gelb' | 'rot' {
  if (pct >= q75) return 'rot';
  if (pct <= q25) return 'gruen';
  return 'gelb';
}

function isSpätAbend(dateStr: string): boolean {
  const d = new Date(dateStr);
  const hour = d.getUTCHours();
  return hour >= 22;
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_shifts')
        .select('driver_id, driver_name, started_at')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start),
      supabase
        .from('delivery_shifts')
        .select('driver_id, started_at')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; late: number; total: number }>();
    for (const s of curData) {
      const prev = groupCur.get(s.driver_id) ?? { name: s.driver_name ?? s.driver_id, late: 0, total: 0 };
      groupCur.set(s.driver_id, {
        name: prev.name,
        late: prev.late + (isSpätAbend(s.started_at) ? 1 : 0),
        total: prev.total + 1,
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { late: number; total: number }>();
    for (const s of prevRes.data ?? []) {
      const prev = groupPrev.get(s.driver_id) ?? { late: 0, total: 0 };
      groupPrev.set(s.driver_id, {
        late: prev.late + (isSpätAbend(s.started_at) ? 1 : 0),
        total: prev.total + 1,
      });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      pct: v.total > 0 ? Math.round((v.late / v.total) * 1000) / 10 : 0,
    }));

    const sorted = [...unsorted].sort((a, b) => b.pct - a.pct);
    const total = sorted.length;

    const pcts = sorted.map(f => f.pct);
    const q25  = pcts[Math.floor(total * 0.75)] ?? 0;
    const q75  = pcts[Math.floor(total * 0.25)] ?? 100;

    const prevPcts = new Map(
      Array.from(groupPrev.entries()).map(([id, v]) => [
        id,
        v.total > 0 ? Math.round((v.late / v.total) * 1000) / 10 : 0,
      ])
    );
    const prevSorted = [...unsorted]
      .map(f => ({ ...f, pct: prevPcts.get(f.fahrer_id) ?? f.pct }))
      .sort((a, b) => b.pct - a.pct);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(f.pct, q25, q75);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        spaetabend_anteil_pct: f.pct,
        rank_delta: prevRang - rang,
        ampel,
        alert_hoch: f.pct > 35,
      };
    });

    const team_avg_pct = Math.round(
      (fahrer.reduce((s, f) => s + f.spaetabend_anteil_pct, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_pct,
      meister_name:   fahrer[0]?.fahrer_name ?? '',
      wenigster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_hoch).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
