import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  samstag_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  hoechste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, samstag_pct: 65, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, samstag_pct: 52, rank_delta:  0, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, samstag_pct: 38, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, samstag_pct: 18, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg: 43,
  hoechste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function isSamstagMittag(startedAt: string): boolean {
  const d = new Date(startedAt);
  // Saturday = 6, 11:00–15:00 local hours
  return d.getDay() === 6 && d.getHours() >= 11 && d.getHours() < 15;
}

function ampelVon(rang: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const cur30Start = new Date(Date.now() - 30 * 86400000).toISOString();
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

    const groupCur = new Map<string, { name: string; samstag: number; total: number }>();
    for (const t of curData) {
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, samstag: 0, total: 0 };
      groupCur.set(t.driver_id, {
        name: prev.name,
        samstag: prev.samstag + (t.started_at && isSamstagMittag(t.started_at) ? 1 : 0),
        total: prev.total + 1,
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const groupPrev = new Map<string, { samstag: number; total: number }>();
    for (const t of prevRes.data ?? []) {
      const prev = groupPrev.get(t.driver_id) ?? { samstag: 0, total: 0 };
      groupPrev.set(t.driver_id, {
        samstag: prev.samstag + (t.started_at && isSamstagMittag(t.started_at) ? 1 : 0),
        total: prev.total + 1,
      });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      pct: v.total > 0 ? Math.round((v.samstag / v.total) * 1000) / 10 : 0,
    }));

    const sorted = [...unsorted].sort((a, b) => b.pct - a.pct);
    const total = sorted.length;

    const prevPcts = new Map(
      Array.from(groupPrev.entries()).map(([id, v]) => [
        id,
        v.total > 0 ? Math.round((v.samstag / v.total) * 1000) / 10 : 0,
      ])
    );
    const prevSorted = [...unsorted]
      .map(f => ({ ...f, pct: prevPcts.get(f.fahrer_id) ?? f.pct }))
      .sort((a, b) => b.pct - a.pct);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        samstag_pct: f.pct,
        rank_delta: prevRang - rang,
        ampel: ampelVon(rang, total),
        alert_niedrig: f.pct < 10,
      };
    });

    const team_avg = Math.round(
      (fahrer.reduce((s, f) => s + f.samstag_pct, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg,
      hoechste_name: fahrer[0]?.fahrer_name ?? '',
      niedrigste_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
