import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  mittagsschicht_anteil_pct: number;
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
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 1, mittagsschicht_anteil_pct: 52, rank_delta:  1, ampel: 'rot',   alert_hoch: true  },
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 2, mittagsschicht_anteil_pct: 38, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 3, mittagsschicht_anteil_pct: 22, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 4, mittagsschicht_anteil_pct: 11, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg_pct: 30.8,
  meister_name: 'Sara K.',
  wenigster_name: 'Max M.',
  alert_count: 1,
  gesamt: 4,
};

function isMittagsschicht(startedAt: string): boolean {
  const hour = new Date(startedAt).getUTCHours();
  return hour >= 11 && hour < 14;
}

function ampelVon(pct: number, q25: number, q75: number): 'gruen' | 'gelb' | 'rot' {
  if (pct >= q75) return 'rot';
  if (pct <= q25) return 'gruen';
  return 'gelb';
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
        .select('driver_id, driver_name, started_at')
        .eq('location_id', locationId)
        .gte('started_at', cur30Start),
      supabase
        .from('delivery_tours')
        .select('driver_id, started_at')
        .eq('location_id', locationId)
        .gte('started_at', prev30Start)
        .lt('started_at', cur30Start),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; mittag: number; total: number }>();
    for (const t of curData) {
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, mittag: 0, total: 0 };
      groupCur.set(t.driver_id, {
        name: prev.name,
        mittag: prev.mittag + (t.started_at && isMittagsschicht(t.started_at) ? 1 : 0),
        total: prev.total + 1,
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { mittag: number; total: number }>();
    for (const t of prevRes.data ?? []) {
      const prev = groupPrev.get(t.driver_id) ?? { mittag: 0, total: 0 };
      groupPrev.set(t.driver_id, {
        mittag: prev.mittag + (t.started_at && isMittagsschicht(t.started_at) ? 1 : 0),
        total: prev.total + 1,
      });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      pct: v.total > 0 ? Math.round((v.mittag / v.total) * 1000) / 10 : 0,
    }));

    const sorted = [...unsorted].sort((a, b) => b.pct - a.pct);
    const total = sorted.length;

    const pcts = sorted.map(f => f.pct);
    const q25  = pcts[Math.floor(total * 0.75)] ?? 0;
    const q75  = pcts[Math.floor(total * 0.25)] ?? 100;

    const prevPcts = new Map(
      Array.from(groupPrev.entries()).map(([id, v]) => [
        id,
        v.total > 0 ? Math.round((v.mittag / v.total) * 1000) / 10 : 0,
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
        mittagsschicht_anteil_pct: f.pct,
        rank_delta: prevRang - rang,
        ampel,
        alert_hoch: f.pct > 45,
      };
    });

    const team_avg_pct = Math.round(
      (fahrer.reduce((s, f) => s + f.mittagsschicht_anteil_pct, 0) / total) * 10
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
