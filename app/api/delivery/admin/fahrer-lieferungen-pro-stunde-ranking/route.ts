import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  deliveries_pro_h: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pro_h: number;
  produktivste_name: string;
  wenigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK_DATA: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, deliveries_pro_h: 4.8, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, deliveries_pro_h: 4.1, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, deliveries_pro_h: 3.6, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, deliveries_pro_h: 2.2, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_pro_h: 3.675,
  produktivste_name: 'Julia F.',
  wenigste_name: 'Tim B.',
  alert_count: 1,
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
        .select('driver_id, driver_name, created_at, delivered_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', cur30Start)
        .not('driver_id', 'is', null),
      supabase
        .from('orders')
        .select('driver_id, created_at, delivered_at')
        .eq('location_id', locationId)
        .eq('status', 'delivered')
        .gte('created_at', prev30Start)
        .lt('created_at', cur30Start)
        .not('driver_id', 'is', null),
    ]);

    const curData = curRes.data ?? [];
    if (!curData.length) return NextResponse.json(MOCK_DATA);

    type DriverAcc = { name: string; totalDeliveries: number; totalHours: number };
    const groupCur = new Map<string, DriverAcc>();
    for (const o of curData) {
      if (!o.driver_id) continue;
      const prev = groupCur.get(o.driver_id) ?? { name: o.driver_name ?? o.driver_id, totalDeliveries: 0, totalHours: 0 };
      const durationH = o.delivered_at && o.created_at
        ? (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 3600000
        : 0.5;
      groupCur.set(o.driver_id, {
        name:             prev.name,
        totalDeliveries:  prev.totalDeliveries + 1,
        totalHours:       prev.totalHours + Math.max(durationH, 0.05),
      });
    }
    if (!groupCur.size) return NextResponse.json(MOCK_DATA);

    type PrevAcc = { totalDeliveries: number; totalHours: number };
    const groupPrev = new Map<string, PrevAcc>();
    for (const o of prevRes.data ?? []) {
      if (!o.driver_id) continue;
      const prev = groupPrev.get(o.driver_id) ?? { totalDeliveries: 0, totalHours: 0 };
      const durationH = o.delivered_at && o.created_at
        ? (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 3600000
        : 0.5;
      groupPrev.set(o.driver_id, {
        totalDeliveries:  prev.totalDeliveries + 1,
        totalHours:       prev.totalHours + Math.max(durationH, 0.05),
      });
    }

    const unsorted = Array.from(groupCur.entries()).map(([id, v]) => ({
      fahrer_id:       id,
      fahrer_name:     v.name || id.slice(0, 8),
      deliveries_pro_h: v.totalHours > 0 ? Math.round((v.totalDeliveries / v.totalHours) * 10) / 10 : 0,
    }));

    // absteigend — meiste Lieferungen/h = Rang 1 = bester
    const sorted = [...unsorted].sort((a, b) => b.deliveries_pro_h - a.deliveries_pro_h);
    const total  = sorted.length;

    const prevSorted = [...unsorted].map(f => {
      const p = groupPrev.get(f.fahrer_id);
      const pRate = p && p.totalHours > 0 ? Math.round((p.totalDeliveries / p.totalHours) * 10) / 10 : f.deliveries_pro_h;
      return { fahrer_id: f.fahrer_id, deliveries_pro_h: pRate };
    }).sort((a, b) => b.deliveries_pro_h - a.deliveries_pro_h);
    const prevRanks = new Map(prevSorted.map((f, i) => [f.fahrer_id, i + 1]));

    let fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang     = i + 1;
      const prevRang = prevRanks.get(f.fahrer_id) ?? rang;
      const ampel    = ampelVon(rang, total);
      return {
        fahrer_id:        f.fahrer_id,
        fahrer_name:      f.fahrer_name,
        rang,
        deliveries_pro_h: f.deliveries_pro_h,
        rank_delta:       prevRang - rang,
        ampel,
        alert_niedrig:    ampel === 'rot',
      };
    });

    if (driverId) fahrer = fahrer.filter(f => f.fahrer_id === driverId);
    if (!fahrer.length) return NextResponse.json(MOCK_DATA);

    const teamAvg = Math.round(
      (sorted.reduce((s, f) => s + f.deliveries_pro_h, 0) / total) * 10
    ) / 10;

    return NextResponse.json({
      fahrer,
      team_avg_pro_h:    teamAvg,
      produktivste_name: sorted[0]?.fahrer_name ?? '',
      wenigste_name:     sorted[total - 1]?.fahrer_name ?? '',
      alert_count:       fahrer.filter(f => f.alert_niedrig).length,
      gesamt:            total,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
