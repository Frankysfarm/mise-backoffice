import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  fenster_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, fenster_pct: 94.0, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, fenster_pct: 87.0, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, fenster_pct: 79.0, rank_delta: -1, ampel: 'gelb',  alert_niedrig: true  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, fenster_pct: 67.0, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_pct: 81.75,
  beste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  alert_count: 2,
  gesamt: 4,
};

function ampelVon(rank: number, total: number): 'gruen' | 'gelb' | 'rot' {
  const pct = rank / total;
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

    const cur30Start  = new Date(Date.now() - 30 * 86400000).toISOString();
    const prev30Start = new Date(Date.now() - 60 * 86400000).toISOString();

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('orders')
        .select('driver_id, driver_name, delivered_at, promised_delivery_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', cur30Start)
        .not('driver_id', 'is', null)
        .not('delivered_at', 'is', null)
        .not('promised_delivery_at', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, delivered_at, promised_delivery_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('driver_id', 'is', null)
        .not('delivered_at', 'is', null)
        .not('promised_delivery_at', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type DriverAcc = { name: string; onTime: number; total: number };
    const groupCur = new Map<string, DriverAcc>();

    for (const o of curData) {
      const isOnTime = new Date(o.delivered_at).getTime() <= new Date(o.promised_delivery_at).getTime();
      const existing = groupCur.get(o.driver_id);
      if (existing) {
        if (isOnTime) existing.onTime++;
        existing.total++;
      } else {
        groupCur.set(o.driver_id, { name: o.driver_name ?? o.driver_id, onTime: isOnTime ? 1 : 0, total: 1 });
      }
    }

    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    type PrevAcc = { onTime: number; total: number };
    const groupPrev = new Map<string, PrevAcc>();
    for (const o of (prevRes.data ?? [])) {
      const isOnTime = new Date(o.delivered_at).getTime() <= new Date(o.promised_delivery_at).getTime();
      const existing = groupPrev.get(o.driver_id);
      if (existing) { if (isOnTime) existing.onTime++; existing.total++; }
      else groupPrev.set(o.driver_id, { onTime: isOnTime ? 1 : 0, total: 1 });
    }

    const entries = Array.from(groupCur.entries()).map(([id, acc]) => ({
      fahrer_id: id,
      fahrer_name: acc.name,
      pct: acc.total > 0 ? (acc.onTime / acc.total) * 100 : 0,
    }));

    entries.sort((a, b) => b.pct - a.pct);

    const total = entries.length;

    const prevRanks = new Map<string, number>();
    const prevEntries = Array.from(groupPrev.entries())
      .map(([id, acc]) => ({ id, pct: acc.total > 0 ? (acc.onTime / acc.total) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct);
    prevEntries.forEach((e, i) => prevRanks.set(e.id, i + 1));

    const fahrer: FahrerRow[] = entries.map((e, i) => {
      const rang = i + 1;
      const prevRang = prevRanks.get(e.fahrer_id) ?? rang;
      const ampel = ampelVon(rang, total);
      return {
        fahrer_id: e.fahrer_id,
        fahrer_name: e.fahrer_name,
        rang,
        fenster_pct: Math.round(e.pct * 10) / 10,
        rank_delta: prevRang - rang,
        ampel,
        alert_niedrig: e.pct < 80,
      };
    });

    const query = driverId ? fahrer.filter(f => f.fahrer_id === driverId) : fahrer;
    const teamAvg = entries.reduce((s, e) => s + e.pct, 0) / entries.length;

    return NextResponse.json({
      fahrer: query.length ? query : fahrer,
      team_avg_pct: Math.round(teamAvg * 10) / 10,
      beste_name: fahrer[0]?.fahrer_name ?? '',
      niedrigste_name: fahrer[total - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt: total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
