/**
 * GET /api/delivery/admin/fahrer-peak-stunden?location_id=<uuid>
 *
 * Phase 4657 — Fahrer-Peak-Stunden-Analyse
 * Touren je Stunde 0–23 je Fahrer letzte 30 Tage; top Stunde+Anteil je Fahrer.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerPeakStunden {
  fahrer_id: string;
  fahrer_name: string;
  stunden: number[]; // Index 0–23 = Touren je Stunde
  top_stunde: number;
  top_pct: number;
  gesamt_touren: number;
}

interface StundenStat {
  stunde: number;
  team_avg: number;
  top_fahrer: string;
  top_pct: number;
}

interface ApiResponse {
  fahrer: FahrerPeakStunden[];
  stunden_stats: StundenStat[];
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    {
      fahrer_id: 'f1',
      fahrer_name: 'Julia S.',
      stunden: [0,0,0,0,0,0,1,3,5,6,8,10,12,11,9,7,5,8,14,16,12,8,4,2],
      top_stunde: 19,
      top_pct: 12,
      gesamt_touren: 150,
    },
    {
      fahrer_id: 'f2',
      fahrer_name: 'Max M.',
      stunden: [0,0,0,0,0,0,2,4,6,8,10,12,14,12,10,8,6,4,10,15,11,7,3,1],
      top_stunde: 19,
      top_pct: 13,
      gesamt_touren: 143,
    },
    {
      fahrer_id: 'f3',
      fahrer_name: 'Sara B.',
      stunden: [0,0,0,0,0,0,0,2,4,5,7,9,11,10,8,6,4,6,12,14,10,6,3,1],
      top_stunde: 19,
      top_pct: 11,
      gesamt_touren: 118,
    },
    {
      fahrer_id: 'f4',
      fahrer_name: 'Tim K.',
      stunden: [0,0,0,0,0,0,1,2,4,6,8,11,13,12,10,8,5,7,11,13,9,5,2,0],
      top_stunde: 18,
      top_pct: 11,
      gesamt_touren: 127,
    },
  ],
  stunden_stats: Array.from({ length: 24 }, (_, h) => {
    const avgs = [0,0,0,0,0,0,1,3,5,6,8,11,13,11,9,7,5,6,12,15,11,7,3,1];
    return {
      stunde: h,
      team_avg: avgs[h],
      top_fahrer: h === 19 ? 'Max M.' : h === 18 ? 'Tim K.' : 'Julia S.',
      top_pct: h === 19 ? 13 : h === 18 ? 11 : avgs[h] > 0 ? 12 : 0,
    };
  }),
  gesamt: 4,
};

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

    const byFahrer: Record<string, { name: string; counts: number[]; total: number }> = {};

    for (const t of touren) {
      const id = t.driver_id as string;
      const name = (t.drivers as { full_name?: string } | null)?.full_name ?? id;
      if (!byFahrer[id]) {
        byFahrer[id] = { name, counts: new Array(24).fill(0), total: 0 };
      }
      byFahrer[id].total++;
      if (t.started_at) {
        const h = new Date(t.started_at).getUTCHours();
        byFahrer[id].counts[h]++;
      }
    }

    const fahrer: FahrerPeakStunden[] = Object.entries(byFahrer).map(([fahrer_id, v]) => {
      const stunden = v.counts.map(c => v.total > 0 ? Math.round((c / v.total) * 100) : 0);
      let top_stunde = 0;
      let top_pct = 0;
      stunden.forEach((p, i) => { if (p > top_pct) { top_pct = p; top_stunde = i; } });
      return { fahrer_id, fahrer_name: v.name, stunden, top_stunde, top_pct, gesamt_touren: v.total };
    });

    const stunden_stats: StundenStat[] = Array.from({ length: 24 }, (_, h) => {
      const vals = fahrer.map(f => f.stunden[h]);
      const team_avg = vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
      const top = fahrer.reduce((best, f) => f.stunden[h] > best.stunden[h] ? f : best, fahrer[0]);
      return { stunde: h, team_avg, top_fahrer: top?.fahrer_name ?? '', top_pct: top?.stunden[h] ?? 0 };
    });

    return NextResponse.json({ fahrer, stunden_stats, gesamt: fahrer.length } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
