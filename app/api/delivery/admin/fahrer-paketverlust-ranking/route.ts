import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  verlust_pct: number;
  verlust_anzahl: number;
  gesamt_stopps: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_verlust_pct: number;
  bester_name: string;
  schlechtester_name: string;
  alert_count: number;
  gesamt: number;
  ziel_pct: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, verlust_pct:  0.5, verlust_anzahl:  1, gesamt_stopps: 200, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, verlust_pct:  1.2, verlust_anzahl:  2, gesamt_stopps: 167, rank_delta:  1, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, verlust_pct:  2.8, verlust_anzahl:  5, gesamt_stopps: 179, rank_delta: -1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, verlust_pct:  5.5, verlust_anzahl:  9, gesamt_stopps: 164, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg_verlust_pct: 2.5,
  bester_name: 'Julia F.',
  schlechtester_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_pct: 1.0,
};

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function yesterdayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start: start.toISOString(), end: end.toISOString() };
}

function ampelVon(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');
  const driver_id   = searchParams.get('driver_id');

  if (!location_id) return NextResponse.json(MOCK_DATA);

  try {
    const supabase  = await createClient();
    const today     = todayRange();
    const yesterday = yesterdayRange();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_stops')
        .select('driver_id, driver_name, status')
        .eq('location_id', location_id)
        .in('status', ['delivered', 'failed', 'damaged', 'lost'])
        .gte('updated_at', today.start)
        .lt('updated_at', today.end),
      supabase
        .from('delivery_stops')
        .select('driver_id, status')
        .eq('location_id', location_id)
        .in('status', ['delivered', 'failed', 'damaged', 'lost'])
        .gte('updated_at', yesterday.start)
        .lt('updated_at', yesterday.end),
    ]);

    const groupCur  = new Map<string, { name: string; total: number; verlust: number }>();
    const groupPrev = new Map<string, { total: number; verlust: number }>();

    for (const s of (curRes.data ?? [])) {
      const isLost = s.status === 'damaged' || s.status === 'lost' || s.status === 'failed';
      const prev = groupCur.get(s.driver_id) ?? { name: s.driver_name ?? s.driver_id, total: 0, verlust: 0 };
      groupCur.set(s.driver_id, { name: prev.name, total: prev.total + 1, verlust: prev.verlust + (isLost ? 1 : 0) });
    }

    for (const s of (prevRes.data ?? [])) {
      const isLost = s.status === 'damaged' || s.status === 'lost' || s.status === 'failed';
      const prev = groupPrev.get(s.driver_id) ?? { total: 0, verlust: 0 };
      groupPrev.set(s.driver_id, { total: prev.total + 1, verlust: prev.verlust + (isLost ? 1 : 0) });
    }

    const entries = Array.from(groupCur.entries())
      .map(([id, v]) => ({
        fahrer_id:    id,
        fahrer_name:  v.name || id.slice(0, 8),
        verlust_pct:  v.total > 0 ? Math.round((v.verlust / v.total) * 100 * 10) / 10 : 0,
        verlust_anzahl: v.verlust,
        gesamt_stopps:  v.total,
      }))
      .sort((a, b) => a.verlust_pct - b.verlust_pct);

    if (!entries.length) return NextResponse.json(MOCK_DATA);

    const total      = entries.length;
    const vals       = entries.map(e => e.verlust_pct);
    const teamAvgPct = Math.round((vals.reduce((s, v) => s + v, 0) / total) * 10) / 10;

    const prevRanks = new Map<string, number>();
    Array.from(groupPrev.entries())
      .map(([id, v]) => ({ id, pct: v.total > 0 ? v.verlust / v.total * 100 : 0 }))
      .sort((a, b) => a.pct - b.pct)
      .forEach(({ id }, i) => prevRanks.set(id, i + 1));

    const fahrer: FahrerRow[] = entries.map((e, i) => {
      const rang       = i + 1;
      const prevRang   = prevRanks.get(e.fahrer_id) ?? rang;
      const rank_delta = rang - prevRang;
      const ampel      = ampelVon(rang, total);
      return {
        fahrer_id:      e.fahrer_id,
        fahrer_name:    e.fahrer_name,
        rang,
        verlust_pct:    e.verlust_pct,
        verlust_anzahl: e.verlust_anzahl,
        gesamt_stopps:  e.gesamt_stopps,
        rank_delta,
        ampel,
        alert_top:      ampel === 'rot',
      };
    });

    if (driver_id) {
      const me = fahrer.find(f => f.fahrer_id === driver_id);
      return NextResponse.json({
        fahrer:              me ? [me] : fahrer,
        team_avg_verlust_pct: teamAvgPct,
        bester_name:         fahrer[0]?.fahrer_name ?? '',
        schlechtester_name:  fahrer[total - 1]?.fahrer_name ?? '',
        alert_count:         fahrer.filter(f => f.alert_top).length,
        gesamt:              total,
        ziel_pct:            1.0,
      } satisfies ApiResponse);
    }

    return NextResponse.json({
      fahrer,
      team_avg_verlust_pct: teamAvgPct,
      bester_name:         fahrer[0]?.fahrer_name ?? '',
      schlechtester_name:  fahrer[total - 1]?.fahrer_name ?? '',
      alert_count:         fahrer.filter(f => f.alert_top).length,
      gesamt:              total,
      ziel_pct:            1.0,
    } satisfies ApiResponse);

  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
