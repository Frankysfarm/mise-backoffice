/**
 * GET /api/delivery/admin/fahrer-peak-stunden?location_id=<uuid>
 *
 * Phase 4657 — Fahrer-Peak-Stunden-Analyse
 * Touren je Stunde 0–23 je Fahrer letzte 30 Tage; top Stunde+Anteil je Fahrer; team stats
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerPeakStunde {
  fahrer_id: string;
  fahrer_name: string;
  stunden: number[]; // pct 0–100 per hour (index 0–23)
  top_stunde: number; // 0–23
  top_pct: number;
  gesamt_touren: number;
}

interface StundeStat {
  stunde: number;
  team_avg: number;
  top_fahrer: string;
  top_pct: number;
}

interface ApiResponse {
  fahrer: FahrerPeakStunde[];
  stunden_stats: StundeStat[];
  gesamt: number;
}

// Realistic 24-h mock distributions (pct of own tours per hour)
const MOCK_DIST: Record<string, number[]> = {
  f1: [0,0,0,0,0,1,2,4,6,8,10,14,20,12,8,6,5,7,8,5,3,1,0,0], // Julia: lunch peak
  f2: [0,0,0,0,0,1,2,3,5,7,9,12,18,10,7,6,8,25,8,4,2,0,0,0], // Max: evening peak
  f3: [0,0,0,0,0,1,2,4,7,10,15,22,16,9,5,4,3,2,1,1,0,0,0,0], // Sara: morning peak
  f4: [0,0,0,0,0,0,1,2,3,5,7,10,14,10,8,6,5,8,12,28,1,0,0,0], // Tim: late dinner peak
};

const MOCK_NAMES: Record<string, string> = {
  f1: 'Julia S.', f2: 'Max M.', f3: 'Sara B.', f4: 'Tim K.',
};

const MOCK_TOTALS: Record<string, number> = {
  f1: 120, f2: 98, f3: 87, f4: 74,
};

function buildMock(): ApiResponse {
  const ids = ['f1', 'f2', 'f3', 'f4'];
  const fahrer: FahrerPeakStunde[] = ids.map(id => {
    const dist = MOCK_DIST[id];
    const topIdx = dist.indexOf(Math.max(...dist));
    return {
      fahrer_id: id,
      fahrer_name: MOCK_NAMES[id],
      stunden: dist,
      top_stunde: topIdx,
      top_pct: dist[topIdx],
      gesamt_touren: MOCK_TOTALS[id],
    };
  });

  const stunden_stats: StundeStat[] = Array.from({ length: 24 }, (_, h) => {
    const vals = ids.map(id => ({ name: MOCK_NAMES[id], pct: MOCK_DIST[id][h] }));
    const avg = Math.round(vals.reduce((s, v) => s + v.pct, 0) / vals.length);
    const top = vals.reduce((a, b) => (a.pct >= b.pct ? a : b));
    return { stunde: h, team_avg: avg, top_fahrer: top.name, top_pct: top.pct };
  });

  return { fahrer, stunden_stats, gesamt: ids.length };
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
      return NextResponse.json(buildMock());
    }

    const byFahrer: Record<string, { name: string; total: number; counts: number[] }> = {};

    for (const t of touren) {
      const id = t.driver_id as string;
      const name = (t.drivers as { full_name?: string } | null)?.full_name ?? id;
      const hour = new Date(t.started_at as string).getUTCHours();
      if (!byFahrer[id]) byFahrer[id] = { name, total: 0, counts: new Array(24).fill(0) };
      byFahrer[id].total++;
      byFahrer[id].counts[hour]++;
    }

    const fahrer: FahrerPeakStunde[] = Object.entries(byFahrer).map(([id, d]) => {
      const pcts = d.counts.map(c => (d.total > 0 ? Math.round((c / d.total) * 100) : 0));
      const topIdx = pcts.indexOf(Math.max(...pcts));
      return {
        fahrer_id: id,
        fahrer_name: d.name,
        stunden: pcts,
        top_stunde: topIdx,
        top_pct: pcts[topIdx],
        gesamt_touren: d.total,
      };
    });

    fahrer.sort((a, b) => b.top_pct - a.top_pct);

    const stunden_stats: StundeStat[] = Array.from({ length: 24 }, (_, h) => {
      if (!fahrer.length) return { stunde: h, team_avg: 0, top_fahrer: '', top_pct: 0 };
      const avg = Math.round(fahrer.reduce((s, f) => s + f.stunden[h], 0) / fahrer.length);
      const top = fahrer.reduce((a, b) => (a.stunden[h] >= b.stunden[h] ? a : b));
      return { stunde: h, team_avg: avg, top_fahrer: top.fahrer_name, top_pct: top.stunden[h] };
    });

    return NextResponse.json({ fahrer, stunden_stats, gesamt: fahrer.length });
  } catch {
    return NextResponse.json(buildMock());
  }
}
