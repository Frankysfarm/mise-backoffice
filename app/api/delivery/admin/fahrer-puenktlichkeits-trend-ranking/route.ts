/**
 * GET /api/delivery/admin/fahrer-puenktlichkeits-trend-ranking?location_id=<uuid>
 *
 * Phase 5602–5605 — Fahrer-Pünktlichkeits-Trend-Ranking
 * Vergleich On-time-Rate Monat-1 vs. Monat-2 (letzten 30 vs. vorherigen 30 Tage).
 * ABSTEIGEND: Rang 1 = größte positive Verbesserung = bester Trend.
 * alert_rueckfall wenn trend_delta_pct < -5.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  trend_delta_pct: number;
  aktuell_pct: number;
  vorher_pct: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_trend: number;
  bester_name: string;
  schwaechster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, trend_delta_pct: 12, aktuell_pct: 94, vorher_pct: 82, rank_delta:  2, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, trend_delta_pct:  5, aktuell_pct: 90, vorher_pct: 85, rank_delta: -1, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, trend_delta_pct: -2, aktuell_pct: 76, vorher_pct: 78, rank_delta:  0, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, trend_delta_pct:-11, aktuell_pct: 58, vorher_pct: 69, rank_delta: -1, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_trend: 1.0,
  bester_name: 'Max M.',
  schwaechster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelVon(rang: number, gesamt: number): Ampel {
  const pct = rang / gesamt;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

function calcPct(onTime: number, total: number): number {
  return total > 0 ? Math.round((onTime / total) * 100) : 0;
}

type OrderRow = { driver_id: string | null; status: string; created_at: string; actual_delivery_time: string | null };

function aggregate(rows: OrderRow[]): Map<string, { onTime: number; total: number }> {
  const m = new Map<string, { onTime: number; total: number }>();
  for (const o of rows) {
    if (!o.driver_id || o.status !== 'delivered' || !o.actual_delivery_time) continue;
    const min = (new Date(o.actual_delivery_time).getTime() - new Date(o.created_at).getTime()) / 60_000;
    if (min < 0 || min > 180) continue;
    const acc = m.get(o.driver_id) ?? { onTime: 0, total: 0 };
    acc.total++;
    if (min <= 30) acc.onTime++;
    m.set(o.driver_id, acc);
  }
  return m;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(MOCK);

  try {
    const sb  = await createClient();
    const now = new Date();

    const curEnd   = now.toISOString();
    const curStart = new Date(now);
    curStart.setUTCDate(curStart.getUTCDate() - 30);
    const prevEnd   = curStart.toISOString();
    const prevStart = new Date(curStart);
    prevStart.setUTCDate(prevStart.getUTCDate() - 30);

    const [{ data: curOrders }, { data: prevOrders }] = await Promise.all([
      sb.from('customer_orders')
        .select('driver_id, status, created_at, actual_delivery_time')
        .eq('location_id', locationId)
        .gte('created_at', curStart.toISOString())
        .lte('created_at', curEnd)
        .not('driver_id', 'is', null),
      sb.from('customer_orders')
        .select('driver_id, status, created_at, actual_delivery_time')
        .eq('location_id', locationId)
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', prevEnd)
        .not('driver_id', 'is', null),
    ]);

    if (!curOrders || curOrders.length === 0) return NextResponse.json({ ...MOCK });

    const { data: drivers } = await sb
      .from('mise_drivers')
      .select('id, first_name, last_name')
      .eq('location_id', locationId);

    const nameMap = new Map<string, string>();
    for (const d of (drivers ?? []) as { id: string; first_name: string | null; last_name: string | null }[]) {
      nameMap.set(d.id, [d.first_name, d.last_name ? d.last_name[0] + '.' : ''].filter(Boolean).join(' ') || 'Fahrer');
    }

    const curMap  = aggregate(curOrders as OrderRow[]);
    const prevMap = aggregate((prevOrders ?? []) as OrderRow[]);

    if (curMap.size === 0) return NextResponse.json(MOCK);

    const unsorted = Array.from(curMap.entries()).map(([id, acc]) => {
      const prev    = prevMap.get(id) ?? { onTime: 0, total: 0 };
      const aktuell = calcPct(acc.onTime, acc.total);
      const vorher  = prev.total > 0 ? calcPct(prev.onTime, prev.total) : aktuell;
      return { fahrer_id: id, fahrer_name: nameMap.get(id) ?? 'Fahrer', aktuell_pct: aktuell, vorher_pct: vorher, trend_delta_pct: aktuell - vorher };
    });

    const sorted = [...unsorted].sort((a, b) => b.trend_delta_pct - a.trend_delta_pct);
    const gesamt = sorted.length;
    const teamAvg = gesamt > 0 ? Math.round((sorted.reduce((s, f) => s + f.trend_delta_pct, 0) / gesamt) * 10) / 10 : 0;

    const prevUnsorted = Array.from(prevMap.entries()).map(([id, acc]) => ({ fahrer_id: id, val: calcPct(acc.onTime, acc.total) }));
    const prevSorted   = [...prevUnsorted].sort((a, b) => b.val - a.val);
    const prevRanks    = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      return {
        fahrer_id:       f.fahrer_id,
        fahrer_name:     f.fahrer_name,
        rang,
        trend_delta_pct: f.trend_delta_pct,
        aktuell_pct:     f.aktuell_pct,
        vorher_pct:      f.vorher_pct,
        rank_delta:      prevRang - rang,
        ampel:           ampelVon(rang, gesamt),
        alert_rueckfall: f.trend_delta_pct < -5,
      };
    });

    return NextResponse.json({
      fahrer,
      team_avg_trend:    teamAvg,
      bester_name:       sorted[0]?.fahrer_name ?? '',
      schwaechster_name: sorted[gesamt - 1]?.fahrer_name ?? '',
      alert_count:       fahrer.filter(f => f.alert_rueckfall).length,
      gesamt,
    } satisfies ApiResponse);
  } catch (err) {
    console.error('[fahrer-puenktlichkeits-trend-ranking]', err);
    return NextResponse.json(MOCK);
  }
}
