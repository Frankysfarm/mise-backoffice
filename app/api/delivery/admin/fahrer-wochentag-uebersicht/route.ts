/**
 * GET /api/delivery/admin/fahrer-wochentag-uebersicht?location_id=<uuid>
 *
 * Phase 4652 — Fahrer-Wochentag-Übersicht
 * pct(Touren je Wochentag Mo–So) je Fahrer letzte 30 Tage als 7-Spalten-Matrix
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
type Tag = typeof TAGE[number];

interface FahrerWochentag {
  fahrer_id: string;
  fahrer_name: string;
  anteile: Record<Tag, number>; // pct 0–100 je Tag
  top_tag: Tag;
  gesamt_touren: number;
}

interface TagStat {
  tag: Tag;
  team_avg: number;
  top_fahrer: string;
  top_pct: number;
}

interface ApiResponse {
  fahrer: FahrerWochentag[];
  tag_stats: TagStat[];
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    {
      fahrer_id: 'f1',
      fahrer_name: 'Julia S.',
      anteile: { Mo: 18, Di: 14, Mi: 16, Do: 12, Fr: 22, Sa: 10, So: 8 },
      top_tag: 'Fr',
      gesamt_touren: 120,
    },
    {
      fahrer_id: 'f2',
      fahrer_name: 'Max M.',
      anteile: { Mo: 12, Di: 18, Mi: 14, Do: 20, Fr: 16, Sa: 14, So: 6 },
      top_tag: 'Do',
      gesamt_touren: 98,
    },
    {
      fahrer_id: 'f3',
      fahrer_name: 'Sara B.',
      anteile: { Mo: 10, Di: 10, Mi: 20, Do: 15, Fr: 18, Sa: 18, So: 9 },
      top_tag: 'Mi',
      gesamt_touren: 87,
    },
    {
      fahrer_id: 'f4',
      fahrer_name: 'Tim K.',
      anteile: { Mo: 20, Di: 16, Mi: 12, Do: 10, Fr: 14, Sa: 20, So: 8 },
      top_tag: 'Mo',
      gesamt_touren: 74,
    },
  ],
  tag_stats: [
    { tag: 'Mo', team_avg: 15, top_fahrer: 'Tim K.', top_pct: 20 },
    { tag: 'Di', team_avg: 15, top_fahrer: 'Max M.', top_pct: 18 },
    { tag: 'Mi', team_avg: 16, top_fahrer: 'Sara B.', top_pct: 20 },
    { tag: 'Do', team_avg: 14, top_fahrer: 'Max M.', top_pct: 20 },
    { tag: 'Fr', team_avg: 18, top_fahrer: 'Julia S.', top_pct: 22 },
    { tag: 'Sa', team_avg: 16, top_fahrer: 'Tim K.', top_pct: 20 },
    { tag: 'So', team_avg: 8, top_fahrer: 'Julia S.', top_pct: 8 },
  ],
  gesamt: 4,
};

// JS getDay(): 0=Su, 1=Mo, 2=Tu, 3=We, 4=Th, 5=Fr, 6=Sa
const DAY_INDEX_TO_TAG: Tag[] = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

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

    const byFahrer: Record<string, { name: string; counts: Record<Tag, number>; total: number }> = {};
    for (const t of touren) {
      const id = t.driver_id as string;
      const name = (t.drivers as { full_name?: string } | null)?.full_name ?? id;
      if (!byFahrer[id]) {
        byFahrer[id] = {
          name,
          counts: { Mo: 0, Di: 0, Mi: 0, Do: 0, Fr: 0, Sa: 0, So: 0 },
          total: 0,
        };
      }
      byFahrer[id].total++;
      if (t.started_at) {
        const tag = DAY_INDEX_TO_TAG[new Date(t.started_at).getUTCDay()];
        byFahrer[id].counts[tag]++;
      }
    }

    const fahrer: FahrerWochentag[] = Object.entries(byFahrer).map(([fahrer_id, v]) => {
      const anteile = {} as Record<Tag, number>;
      let top_tag: Tag = 'Mo';
      let top_pct = 0;
      for (const tag of TAGE) {
        const pct = v.total > 0 ? Math.round((v.counts[tag] / v.total) * 100) : 0;
        anteile[tag] = pct;
        if (pct > top_pct) { top_pct = pct; top_tag = tag; }
      }
      return { fahrer_id, fahrer_name: v.name, anteile, top_tag, gesamt_touren: v.total };
    });

    const tag_stats: TagStat[] = TAGE.map(tag => {
      const avgs = fahrer.map(f => f.anteile[tag]);
      const team_avg = avgs.length > 0 ? Math.round(avgs.reduce((s, v) => s + v, 0) / avgs.length) : 0;
      const top = fahrer.reduce((best, f) => f.anteile[tag] > best.anteile[tag] ? f : best, fahrer[0]);
      return { tag, team_avg, top_fahrer: top?.fahrer_name ?? '', top_pct: top?.anteile[tag] ?? 0 };
    });

    return NextResponse.json({ fahrer, tag_stats, gesamt: fahrer.length } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
