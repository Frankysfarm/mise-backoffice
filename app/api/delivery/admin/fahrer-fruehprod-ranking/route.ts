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
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 1, touren_pro_std: 3.8, rank_delta:  1, ampel: 'rot',   alert_hoch: true  },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', rang: 2, touren_pro_std: 2.9, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 3, touren_pro_std: 2.1, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   rang: 4, touren_pro_std: 1.4, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg_tph: 2.55,
  meister_name: 'Sara K.',
  wenigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

// Frühschicht-Proxy: 05:00–09:00 UTC
function isFruehschicht(startedAt: string): boolean {
  const h = new Date(startedAt).getUTCHours();
  return h >= 5 && h < 9;
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

    // Group by driver: count Frühschicht tours and total Frühschicht hours worked
    const groupCur = new Map<string, { name: string; touren: number; stunden: number }>();
    for (const t of curData) {
      if (!t.started_at || !isFruehschicht(t.started_at)) continue;
      const durationH = t.completed_at
        ? (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 3600000
        : 0.5;
      const prev = groupCur.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, touren: 0, stunden: 0 };
      groupCur.set(t.driver_id, {
        name: prev.name,
        touren: prev.touren + 1,
        stunden: prev.stunden + durationH,
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id: id,
      fahrer_name: v.name || id.slice(0, 8),
      tph: v.stunden > 0 ? Math.round((v.touren / v.stunden) * 10) / 10 : 0,
    }));

    const sorted = [...unsorted].sort((a, b) => b.tph - a.tph);
    const total = sorted.length;

    // Previous period ranks
    const groupPrev = new Map<string, { touren: number; stunden: number }>();
    for (const t of prevRes.data ?? []) {
      if (!t.started_at || !isFruehschicht(t.started_at)) continue;
      const durationH = t.completed_at
        ? (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 3600000
        : 0.5;
      const prev = groupPrev.get(t.driver_id) ?? { touren: 0, stunden: 0 };
      groupPrev.set(t.driver_id, { touren: prev.touren + 1, stunden: prev.stunden + durationH });
    }
    const prevUnsorted = unsorted.map(f => ({
      fahrer_id: f.fahrer_id,
      tph: (() => { const p = groupPrev.get(f.fahrer_id); return p && p.stunden > 0 ? p.touren / p.stunden : f.tph; })(),
    }));
    const prevSorted = [...prevUnsorted].sort((a, b) => b.tph - a.tph);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(f.tph);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        rang,
        touren_pro_std: f.tph,
        rank_delta: prevRang - rang,
        ampel,
        alert_hoch: f.tph >= 3.0,
      };
    });

    const team_avg_tph = Math.round(
      (fahrer.reduce((s, f) => s + f.touren_pro_std, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_tph,
      meister_name:   fahrer[0]?.fahrer_name ?? '',
      wenigster_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_hoch).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
