import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, km: 48.2, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, km: 38.5, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, km: 27.0, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, km: 14.3, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_km: 32.0,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rang: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rang / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

function todayRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

function yesterdayRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK_DATA);

  try {
    const supabase = await createClient();
    const today     = todayRange();
    const yesterday = yesterdayRange();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_tours')
        .select('driver_id, driver_name, departed_at, distance_km')
        .eq('location_id', locationId)
        .gte('departed_at', today.start)
        .lt('departed_at', today.end),
      supabase
        .from('delivery_tours')
        .select('driver_id, distance_km')
        .eq('location_id', locationId)
        .gte('departed_at', yesterday.start)
        .lt('departed_at', yesterday.end),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    const curAcc = new Map<string, { name: string; km: number }>();
    for (const t of curData) {
      const prev = curAcc.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, km: 0 };
      curAcc.set(t.driver_id, { name: prev.name, km: prev.km + (typeof t.distance_km === 'number' ? t.distance_km : 0) });
    }

    const prevAcc = new Map<string, number>();
    for (const t of (prevRes.data ?? [])) {
      prevAcc.set(t.driver_id, (prevAcc.get(t.driver_id) ?? 0) + (typeof t.distance_km === 'number' ? t.distance_km : 0));
    }

    const entries = [...curAcc.entries()]
      .map(([id, v]) => ({ fahrer_id: id, fahrer_name: v.name, km: Math.round(v.km * 10) / 10 }))
      .sort((a, b) => b.km - a.km);

    const total   = entries.length;
    const teamAvg = Math.round(entries.reduce((s, e) => s + e.km, 0) / total * 10) / 10;

    const prevEntries = [...prevAcc.entries()]
      .map(([id, km]) => ({ id, km }))
      .sort((a, b) => b.km - a.km);
    const prevRankMap = new Map(prevEntries.map((e, i) => [e.id, i + 1]));

    const fahrer: FahrerRow[] = entries.map((e, i) => {
      const rang     = i + 1;
      const ampel    = ampelVon(rang, total);
      const prevRang = prevRankMap.get(e.fahrer_id);
      // INVERTED: prevRang - rang, >0 = verbessert (rang-Nummer gesunken = besser)
      const rank_delta = prevRang != null ? prevRang - rang : 0;
      return {
        fahrer_id:    e.fahrer_id,
        fahrer_name:  e.fahrer_name,
        rang,
        km:           e.km,
        rank_delta,
        ampel,
        alert_bottom: ampel === 'rot',
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_km:  teamAvg,
      bester_name:  fahrer[0]?.fahrer_name ?? '—',
      letzter_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '—',
      alert_count:  fahrer.filter(f => f.alert_bottom).length,
      gesamt:       total,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
