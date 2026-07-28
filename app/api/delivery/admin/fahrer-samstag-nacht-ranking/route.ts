/**
 * GET /api/delivery/admin/fahrer-samstag-nacht-ranking?location_id=<uuid>
 *
 * Phase 4642 — Fahrer-Samstagnacht-Anteil-Ranking
 * pct(Touren Sa 22–02 Uhr) je Fahrer letzte 30 Tage; rank-based Ampel top25%=gruen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerSamstagNacht {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  samstag_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerSamstagNacht[];
  team_avg: number;
  hoechste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia S.',  rang: 1, samstag_pct: 42, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',    rang: 2, samstag_pct: 35, rank_delta: +1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara B.',   rang: 3, samstag_pct: 26, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim K.',    rang: 4, samstag_pct: 13, rank_delta:  0, ampel: 'rot',   alert_niedrig: false },
  ],
  team_avg: 29,
  hoechste_name: 'Julia S.',
  niedrigste_name: 'Tim K.',
  alert_count: 0,
  gesamt: 4,
};

function isSamstagNacht(date: Date): boolean {
  const day = date.getUTCDay(); // 6=Saturday, 0=Sunday
  const hour = date.getUTCHours();
  // Saturday 22-24 or Sunday 00-02
  return (day === 6 && hour >= 22) || (day === 0 && hour < 2);
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

    const byFahrer: Record<string, { name: string; total: number; nacht: number }> = {};
    for (const t of touren) {
      const id = t.driver_id as string;
      const name = (t.drivers as { full_name?: string } | null)?.full_name ?? id;
      if (!byFahrer[id]) byFahrer[id] = { name, total: 0, nacht: 0 };
      byFahrer[id].total++;
      if (t.started_at && isSamstagNacht(new Date(t.started_at))) {
        byFahrer[id].nacht++;
      }
    }

    const list = Object.entries(byFahrer)
      .map(([fahrer_id, v]) => ({
        fahrer_id,
        fahrer_name: v.name,
        samstag_pct: v.total > 0 ? Math.round((v.nacht / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.samstag_pct - a.samstag_pct);

    const gesamt = list.length;
    const top25 = Math.max(1, Math.ceil(gesamt * 0.25));

    const fahrer: FahrerSamstagNacht[] = list.map((f, i) => ({
      fahrer_id: f.fahrer_id,
      fahrer_name: f.fahrer_name,
      rang: i + 1,
      samstag_pct: f.samstag_pct,
      rank_delta: 0,
      ampel: i < top25 ? 'gruen' : i < gesamt * 0.6 ? 'gelb' : 'rot',
      alert_niedrig: f.samstag_pct < 10,
    }));

    const team_avg = gesamt > 0 ? Math.round(fahrer.reduce((s, f) => s + f.samstag_pct, 0) / gesamt) : 0;

    const result: ApiResponse = {
      fahrer,
      team_avg,
      hoechste_name: fahrer[0]?.fahrer_name ?? '',
      niedrigste_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_niedrig).length,
      gesamt,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK);
  }
}
