import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_std: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_tph: number;
  meister_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, touren_pro_std: 4.1, rank_delta:  1, ampel: 'rot',   alert_hoch: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, touren_pro_std: 3.2, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', rang: 3, touren_pro_std: 2.8, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   rang: 4, touren_pro_std: 1.9, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
  ],
  team_avg_tph: 3.0,
  meister_name: 'Max M.',
  wenigster_name: 'Tim B.',
  alert_count: 2,
  gesamt: 4,
};

// Mittagsschicht: 11:00–14:00 UTC
function isMittagsschicht(startedAt: string): boolean {
  const h = new Date(startedAt).getUTCHours();
  return h >= 11 && h < 14;
}

function ampelVon(tph: number): 'gruen' | 'gelb' | 'rot' {
  if (tph >= 3.0) return 'rot';
  if (tph >= 1.5) return 'gelb';
  return 'gruen';
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
        .from('delivery_tours')
        .select('driver_id, driver_name, started_at, completed_at')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start),
      supabase
        .from('delivery_tours')
        .select('driver_id, started_at, completed_at')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; touren: number; stunden: number }>();
    for (const t of curData) {
      if (!isMittagsschicht(t.started_at)) continue;
      const entry = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, touren: 0, stunden: 0 };
      entry.touren += 1;
      if (t.completed_at) {
        const h = (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 3600000;
        entry.stunden += h;
      }
      groupCur.set(t.driver_id, entry);
    }

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, number>();
    for (const t of prevRes.data ?? []) {
      if (!isMittagsschicht(t.started_at)) continue;
      groupPrev.set(t.driver_id, (groupPrev.get(t.driver_id) ?? 0) + 1);
    }

    const rows: FahrerRow[] = [...groupCur.entries()]
      .map(([id, v]) => {
        const tph = v.stunden > 0 ? v.touren / v.stunden : 0;
        return { fahrer_id: id, fahrer_name: v.name, rang: 0, touren_pro_std: Math.round(tph * 10) / 10, rank_delta: 0, ampel: ampelVon(tph), alert_hoch: tph >= 3.0 };
      })
      .sort((a, b) => b.touren_pro_std - a.touren_pro_std);

    rows.forEach((r, i) => { r.rang = i + 1; });

    const prevRows = [...groupCur.keys()].reduce<Map<string, number>>((m, id) => {
      const prevT = groupPrev.get(id) ?? 0;
      const prevH = prevT > 0 ? 3 : 0;
      const prevTph = prevH > 0 ? prevT / prevH : 0;
      m.set(id, prevTph);
      return m;
    }, new Map());

    const prevSorted = [...prevRows.entries()].sort((a, b) => b[1] - a[1]).map(([id], i) => ({ id, rank: i + 1 }));
    const prevRankMap = new Map(prevSorted.map(r => [r.id, r.rank]));
    rows.forEach(r => {
      const prev = prevRankMap.get(r.fahrer_id);
      r.rank_delta = prev !== undefined ? prev - r.rang : 0;
    });

    const teamAvg = rows.reduce((s, r) => s + r.touren_pro_std, 0) / rows.length;

    return NextResponse.json({
      fahrer: rows,
      team_avg_tph: Math.round(teamAvg * 100) / 100,
      meister_name: rows[0]?.fahrer_name ?? '',
      wenigster_name: rows[rows.length - 1]?.fahrer_name ?? '',
      alert_count: rows.filter(r => r.alert_hoch).length,
      gesamt: rows.length,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
