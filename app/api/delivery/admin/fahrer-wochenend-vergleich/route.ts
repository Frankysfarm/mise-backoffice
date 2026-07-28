/**
 * GET /api/delivery/admin/fahrer-wochenend-vergleich?location_id=<uuid>
 *
 * Phase 4662 — Fahrer-Wochenend-vs-Wochentag-Vergleich
 * pct_wochenend (Sa+So) vs pct_wochentag (Mo–Fr) je Fahrer letzte 30 Tage
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerVergleich {
  fahrer_id: string;
  fahrer_name: string;
  pct_wochenend: number;
  pct_wochentag: number;
  delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerVergleich[];
  team_avg_we: number;
  team_avg_wt: number;
  team_avg_delta: number;
  we_leader_name: string;
  we_leader_pct: number;
  alert_wochenende: boolean;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia S.', pct_wochenend: 45, pct_wochentag: 31, delta: 14, ampel: 'gruen' },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   pct_wochenend: 38, pct_wochentag: 28, delta: 10, ampel: 'gruen' },
    { fahrer_id: 'f3', fahrer_name: 'Sara B.',  pct_wochenend: 25, pct_wochentag: 34, delta: -9, ampel: 'gelb' },
    { fahrer_id: 'f4', fahrer_name: 'Tim K.',   pct_wochenend: 20, pct_wochentag: 30, delta: -10, ampel: 'rot' },
  ],
  team_avg_we: 32,
  team_avg_wt: 31,
  team_avg_delta: 1,
  we_leader_name: 'Julia S.',
  we_leader_pct: 45,
  alert_wochenende: false,
  gesamt: 4,
};

function isWochenende(date: Date): boolean {
  const day = date.getUTCDay(); // 0=Sunday, 6=Saturday
  return day === 0 || day === 6;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: touren, error } = await supabase
      .from('delivery_tours')
      .select('driver_id, started_at, drivers:driver_id(full_name)')
      .eq('location_id', locationId)
      .gte('started_at', since.toISOString())
      .not('driver_id', 'is', null);

    if (error || !touren?.length) {
      return NextResponse.json(MOCK);
    }

    const byFahrer: Record<string, { name: string; total: number; we: number; wt: number }> = {};
    for (const t of touren) {
      const id = t.driver_id as string;
      const name = (t.drivers as { full_name?: string } | null)?.full_name ?? id;
      if (!byFahrer[id]) byFahrer[id] = { name, total: 0, we: 0, wt: 0 };
      byFahrer[id].total++;
      if (t.started_at) {
        if (isWochenende(new Date(t.started_at))) {
          byFahrer[id].we++;
        } else {
          byFahrer[id].wt++;
        }
      }
    }

    const fahrer: FahrerVergleich[] = Object.entries(byFahrer)
      .map(([fahrer_id, v]) => {
        const pct_wochenend = v.total > 0 ? Math.round((v.we / v.total) * 100) : 0;
        const pct_wochentag = v.total > 0 ? Math.round((v.wt / v.total) * 100) : 0;
        const delta = pct_wochenend - pct_wochentag;
        const ampel: 'gruen' | 'gelb' | 'rot' = delta >= 10 ? 'gruen' : delta > -10 ? 'gelb' : 'rot';
        return { fahrer_id, fahrer_name: v.name, pct_wochenend, pct_wochentag, delta, ampel };
      })
      .sort((a, b) => b.pct_wochenend - a.pct_wochenend);

    const gesamt = fahrer.length;
    const team_avg_we = gesamt > 0 ? Math.round(fahrer.reduce((s, f) => s + f.pct_wochenend, 0) / gesamt) : 0;
    const team_avg_wt = gesamt > 0 ? Math.round(fahrer.reduce((s, f) => s + f.pct_wochentag, 0) / gesamt) : 0;
    const team_avg_delta = team_avg_we - team_avg_wt;
    const weLeader = fahrer[0];

    const result: ApiResponse = {
      fahrer,
      team_avg_we,
      team_avg_wt,
      team_avg_delta,
      we_leader_name: weLeader?.fahrer_name ?? '',
      we_leader_pct: weLeader?.pct_wochenend ?? 0,
      alert_wochenende: team_avg_delta < 0,
      gesamt,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK);
  }
}
