import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  storno_reaktions_score: number;
  storno_quote: number;
  reaktionszeit_score: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_score: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, storno_reaktions_score: 89, storno_quote: 3,  reaktionszeit_score: 94, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, storno_reaktions_score: 77, storno_quote: 6,  reaktionszeit_score: 83, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, storno_reaktions_score: 65, storno_quote: 9,  reaktionszeit_score: 71, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, storno_reaktions_score: 52, storno_quote: 14, reaktionszeit_score: 58, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_score: 70.75,
  beste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rang: number, gesamt: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / gesamt;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

function calcScore(stornoPct: number, reaktionsscore: number): number {
  return Math.round((1 - stornoPct / 100) * 0.6 * 100 + reaktionsscore * 0.4);
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const driverId   = req.nextUrl.searchParams.get('driver_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('orders')
        .select('driver_id, driver_name, status, accepted_at, assigned_at')
        .eq('location_id', locationId)
        .in('status', ['delivered', 'cancelled'])
        .gte('created_at', cur30Start)
        .not('driver_id', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, status, accepted_at, assigned_at')
        .eq('location_id', locationId)
        .in('status', ['delivered', 'cancelled'])
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('driver_id', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type DriverAcc = {
      name: string;
      total: number;
      cancelled: number;
      reaction_ms_sum: number;
      reaction_count: number;
    };
    const groupCur = new Map<string, DriverAcc>();
    for (const o of curData) {
      if (!o.driver_id) continue;
      const prev = groupCur.get(o.driver_id) ?? { name: o.driver_name ?? o.driver_id, total: 0, cancelled: 0, reaction_ms_sum: 0, reaction_count: 0 };
      const reactionMs = o.accepted_at && o.assigned_at
        ? Math.max(0, new Date(o.accepted_at).getTime() - new Date(o.assigned_at).getTime())
        : null;
      groupCur.set(o.driver_id, {
        name:            prev.name,
        total:           prev.total + 1,
        cancelled:       prev.cancelled + (o.status === 'cancelled' ? 1 : 0),
        reaction_ms_sum: prev.reaction_ms_sum + (reactionMs ?? 0),
        reaction_count:  prev.reaction_count + (reactionMs !== null ? 1 : 0),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    type PrevAcc = { total: number; cancelled: number; reaction_ms_sum: number; reaction_count: number };
    const groupPrev = new Map<string, PrevAcc>();
    for (const o of prevRes.data ?? []) {
      if (!o.driver_id) continue;
      const prev = groupPrev.get(o.driver_id) ?? { total: 0, cancelled: 0, reaction_ms_sum: 0, reaction_count: 0 };
      const reactionMs = o.accepted_at && o.assigned_at
        ? Math.max(0, new Date(o.accepted_at).getTime() - new Date(o.assigned_at).getTime())
        : null;
      groupPrev.set(o.driver_id, {
        total:           prev.total + 1,
        cancelled:       prev.cancelled + (o.status === 'cancelled' ? 1 : 0),
        reaction_ms_sum: prev.reaction_ms_sum + (reactionMs ?? 0),
        reaction_count:  prev.reaction_count + (reactionMs !== null ? 1 : 0),
      });
    }

    const deriveScores = (acc: { total: number; cancelled: number; reaction_ms_sum: number; reaction_count: number }) => {
      const stornoPct        = acc.total > 0 ? Math.round((acc.cancelled / acc.total) * 10000) / 100 : 0;
      const avgReactionMs    = acc.reaction_count > 0 ? acc.reaction_ms_sum / acc.reaction_count : 0;
      const reaktionsScore   = Math.max(0, Math.round(100 - Math.min(avgReactionMs / 1000 / 60, 10) * 10));
      return { stornoPct, reaktionsScore };
    };

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => {
      const { stornoPct, reaktionsScore } = deriveScores(v);
      return {
        fahrer_id:             id,
        fahrer_name:           v.name || id.slice(0, 8),
        storno_quote:          stornoPct,
        reaktionszeit_score:   reaktionsScore,
        storno_reaktions_score: calcScore(stornoPct, reaktionsScore),
      };
    });

    const sorted = [...unsorted].sort((a, b) => b.storno_reaktions_score - a.storno_reaktions_score);
    const gesamt = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p = groupPrev.get(f.fahrer_id);
      if (!p) return { fahrer_id: f.fahrer_id, score: f.storno_reaktions_score };
      const ps = deriveScores(p);
      return { fahrer_id: f.fahrer_id, score: calcScore(ps.stornoPct, ps.reaktionsScore) };
    }).sort((a, b) => b.score - a.score);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:              f.fahrer_id,
        fahrer_name:            f.fahrer_name,
        rang,
        storno_reaktions_score: f.storno_reaktions_score,
        storno_quote:           f.storno_quote,
        reaktionszeit_score:    f.reaktionszeit_score,
        rank_delta:             prevRang - rang,
        ampel:                  ampelVon(rang, gesamt),
        alert_niedrig:          f.storno_reaktions_score < 60,
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.storno_reaktions_score, 0) / gesamt) * 100
    ) / 100;

    return NextResponse.json({
      fahrer,
      team_avg_score:  teamAvg,
      beste_name:      sorted[0]?.fahrer_name ?? '',
      niedrigste_name: sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:     fahrer.filter(f => f.alert_niedrig).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
