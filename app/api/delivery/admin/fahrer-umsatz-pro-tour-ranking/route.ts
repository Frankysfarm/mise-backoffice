import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_umsatz: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_umsatz: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_umsatz: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_umsatz: 42.5, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, avg_umsatz: 38.2, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_umsatz: 31.7, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_umsatz: 22.3, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_umsatz: 33.7,
  bester_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_umsatz: 35.0,
};

function ampelVon(rang: number, gesamt: number): Ampel {
  const pct = rang / gesamt;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const driverId   = req.nextUrl.searchParams.get('driver_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const now = new Date();
    const cur30  = new Date(now); cur30.setDate(cur30.getDate() - 30);
    const prev30 = new Date(now); prev30.setDate(prev30.getDate() - 60);

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, total_amount')
        .eq('location_id', locationId)
        .gte('created_at', cur30.toISOString())
        .not('driver_id', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, total_amount')
        .eq('location_id', locationId)
        .gte('created_at', prev30.toISOString())
        .lt('created_at', cur30.toISOString())
        .not('driver_id', 'is', null),
    ]);

    const curData  = curRes.data  ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const groupCur = new Map<string, { name: string; sum: number; count: number }>();
    for (const t of curData) {
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id.slice(0, 8), sum: 0, count: 0 };
      groupCur.set(t.driver_id, { name: prev.name, sum: prev.sum + (t.total_amount ?? 0), count: prev.count + 1 });
    }

    const groupPrev = new Map<string, { sum: number; count: number }>();
    for (const t of prevData) {
      const prev = groupPrev.get(t.driver_id) ?? { sum: 0, count: 0 };
      groupPrev.set(t.driver_id, { sum: prev.sum + (t.total_amount ?? 0), count: prev.count + 1 });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name,
      avg: v.count > 0 ? Math.round((v.sum / v.count) * 100) / 100 : 0,
    }));

    const sorted = [...unsorted].sort((a, b) => b.avg - a.avg);
    const total  = sorted.length;

    const prevAvgs = new Map(
      Array.from(groupPrev.entries()).map(([id, v]) => [
        id,
        v.count > 0 ? Math.round((v.sum / v.count) * 100) / 100 : 0,
      ]),
    );
    const prevSorted = [...unsorted]
      .map(f => ({ ...f, avg: prevAvgs.get(f.fahrer_id) ?? f.avg }))
      .sort((a, b) => b.avg - a.avg);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:    f.fahrer_id,
        fahrer_name:  f.fahrer_name,
        rang,
        avg_umsatz:   f.avg,
        rank_delta:   prevRang - rang,
        ampel,
        alert_niedrig: ampel === 'rot',
      };
    });

    const team_avg_umsatz =
      Math.round((fahrer.reduce((s, f) => s + f.avg_umsatz, 0) / total) * 100) / 100;

    const result: ApiResponse = {
      fahrer,
      team_avg_umsatz,
      bester_name:      fahrer[0]?.fahrer_name ?? '',
      niedrigster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count:      fahrer.filter(f => f.alert_niedrig).length,
      gesamt:           total,
      ziel_umsatz:      35.0,
    };

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId);
      return NextResponse.json({ ...result, fahrer_single: me ?? null });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
