import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Peak hours: 11:00–14:00 and 17:00–21:00 UTC
const PEAK_HOURS = new Set([11, 12, 13, 17, 18, 19, 20]);

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  peak_anteil_pct: number;
  peak_touren: number;
  total_touren: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_peak_pct: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Sara K.',  rang: 1, peak_anteil_pct: 78, peak_touren: 33, total_touren: 42, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, peak_anteil_pct: 65, peak_touren: 25, total_touren: 38, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Julia F.', rang: 3, peak_anteil_pct: 52, peak_touren: 32, total_touren: 61, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, peak_anteil_pct: 31, peak_touren: 17, total_touren: 55, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_peak_pct: 56,
  bester_name: 'Sara K.',
  niedrigster_name: 'Tim B.',
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
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const now = new Date();
    const cur30  = new Date(now); cur30.setDate(cur30.getDate() - 30);
    const prev30 = new Date(now); prev30.setDate(prev30.getDate() - 60);

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, started_at')
        .eq('location_id', locationId)
        .gte('started_at', cur30.toISOString())
        .not('started_at', 'is', null),
      supabase
        .from('delivery_tours')
        .select('driver_id, started_at')
        .eq('location_id', locationId)
        .gte('started_at', prev30.toISOString())
        .lt('started_at', cur30.toISOString())
        .not('started_at', 'is', null),
    ]);

    const curData  = curRes.data ?? [];
    const prevData = prevRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type Acc = { name: string; peak: number; total: number };
    const groupCur = new Map<string, Acc>();
    for (const t of curData) {
      const id   = t.driver_id as string;
      if (!id) continue;
      const hour = new Date(t.started_at as string).getUTCHours();
      const isPeak = PEAK_HOURS.has(hour);
      const entry = groupCur.get(id) ?? { name: (t.driver_name as string) ?? id, peak: 0, total: 0 };
      entry.total += 1;
      if (isPeak) entry.peak += 1;
      groupCur.set(id, entry);
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:   id,
      fahrer_name: v.name || id.slice(0, 8),
      peakPct:     v.total > 0 ? Math.round((v.peak / v.total) * 100) : 0,
      peak:        v.peak,
      total:       v.total,
    }));

    // ABSTEIGEND: Rang 1 = höchster Peak-Anteil = bester Peak-Coverage
    const sorted = [...unsorted].sort((a, b) => b.peakPct - a.peakPct);
    const gesamt = sorted.length;

    // Previous period for rank delta
    const groupPrev = new Map<string, { peak: number; total: number }>();
    for (const t of prevData) {
      const id   = t.driver_id as string;
      if (!id) continue;
      const hour = new Date(t.started_at as string).getUTCHours();
      const entry = groupPrev.get(id) ?? { peak: 0, total: 0 };
      entry.total += 1;
      if (PEAK_HOURS.has(hour)) entry.peak += 1;
      groupPrev.set(id, entry);
    }
    const prevUnsorted = unsorted.map(f => {
      const p = groupPrev.get(f.fahrer_id);
      const peakPct = p && p.total > 0 ? Math.round((p.peak / p.total) * 100) : f.peakPct;
      return { fahrer_id: f.fahrer_id, peakPct };
    });
    const prevSorted = [...prevUnsorted].sort((a, b) => b.peakPct - a.peakPct);
    const prevRanks  = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, gesamt);
      return {
        fahrer_id:       f.fahrer_id,
        fahrer_name:     f.fahrer_name,
        rang,
        peak_anteil_pct: f.peakPct,
        peak_touren:     f.peak,
        total_touren:    f.total,
        rank_delta:      prevRang - rang,
        ampel,
        alert_niedrig:   ampel === 'rot',
      };
    });

    const team_avg_peak_pct = Math.round(
      fahrer.reduce((s, f) => s + f.peak_anteil_pct, 0) / gesamt,
    );

    let out = fahrer;
    if (driverId) out = fahrer.filter(f => f.fahrer_id === driverId);
    if (!out.length) return NextResponse.json(MOCK_DATA);

    return NextResponse.json({
      fahrer:            out,
      team_avg_peak_pct,
      bester_name:       fahrer[0]?.fahrer_name ?? '',
      niedrigster_name:  fahrer[gesamt - 1]?.fahrer_name ?? '',
      alert_count:       fahrer.filter(f => f.alert_niedrig).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
