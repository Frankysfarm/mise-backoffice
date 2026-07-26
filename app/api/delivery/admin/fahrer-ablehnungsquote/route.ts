import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  ablehnungsquote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_ablehnungsquote_pct: number;
  alert_count: number;
  ziel_pct: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, ablehnungsquote_pct: 0.5, rank_delta: -0.2, ampel: 'gruen', alert: null },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, ablehnungsquote_pct: 2.1, rank_delta:  0.3, ampel: 'gelb',  alert: null },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, ablehnungsquote_pct: 5.8, rank_delta:  0.8, ampel: 'rot',   alert: 'Hohe Ablehnungsquote!' },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, ablehnungsquote_pct: 11.3, rank_delta: 1.5, ampel: 'rot',   alert: 'Hohe Ablehnungsquote!' },
  ],
  team_avg_ablehnungsquote_pct: 4.9,
  alert_count: 2,
  ziel_pct: 3,
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const driverId = req.nextUrl.searchParams.get('driver_id');

  if (!locationId) {
    return NextResponse.json(MOCK);
  }

  try {
    const supabase = await createClient();
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: tours, error } = await supabase
      .from('delivery_tours')
      .select('driver_id, status')
      .eq('location_id', locationId)
      .gte('created_at', since.toISOString());

    if (error || !tours || tours.length === 0) {
      return NextResponse.json(MOCK);
    }

    const byDriver = new Map<string, { total: number; rejected: number }>();
    for (const t of tours) {
      if (!t.driver_id) continue;
      if (!byDriver.has(t.driver_id)) byDriver.set(t.driver_id, { total: 0, rejected: 0 });
      const d = byDriver.get(t.driver_id)!;
      d.total += 1;
      if (t.status === 'rejected' || t.status === 'cancelled') d.rejected += 1;
    }

    if (byDriver.size === 0) return NextResponse.json(MOCK);

    const driverIds = Array.from(byDriver.keys());
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', driverId ? [driverId] : driverIds);

    const nameMap = new Map((profiles ?? []).map(p => [p.id, p.full_name ?? p.id]));

    const rows = driverIds.map(id => {
      const stats = byDriver.get(id)!;
      const pct = stats.total > 0 ? Math.round((stats.rejected / stats.total) * 1000) / 10 : 0;
      return { fahrer_id: id, fahrer_name: nameMap.get(id) ?? id, pct };
    }).sort((a, b) => a.pct - b.pct);

    const n = rows.length;
    const topThreshold = rows[Math.floor(n * 0.75)]?.pct ?? Infinity;
    const botThreshold = rows[Math.ceil(n * 0.25) - 1]?.pct ?? 0;

    const fahrer: FahrerRow[] = rows.map((r, i) => {
      const ampel: 'gruen' | 'gelb' | 'rot' = r.pct <= botThreshold ? 'gruen' : r.pct >= topThreshold ? 'rot' : 'gelb';
      return {
        fahrer_id: r.fahrer_id,
        fahrer_name: r.fahrer_name,
        rang: i + 1,
        ablehnungsquote_pct: r.pct,
        rank_delta: 0,
        ampel,
        alert: ampel === 'rot' ? 'Hohe Ablehnungsquote!' : null,
      };
    });

    const teamAvg = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.ablehnungsquote_pct, 0) / fahrer.length * 10) / 10
      : 0;

    return NextResponse.json({
      fahrer,
      team_avg_ablehnungsquote_pct: teamAvg,
      alert_count: fahrer.filter(f => f.alert).length,
      ziel_pct: 3,
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
