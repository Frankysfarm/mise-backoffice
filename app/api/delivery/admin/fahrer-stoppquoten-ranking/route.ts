import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  quote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_quote: number;
  beste_name: string;
  schlechteste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: FahrerRow[] = [
  { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, quote_pct: 99, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
  { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, quote_pct: 97, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
  { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, quote_pct: 91, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
  { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, quote_pct: 78, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
];

function buildMockResponse(driver_id: string | null): NextResponse {
  const data = driver_id ? MOCK.filter(f => f.fahrer_id === driver_id) : MOCK;
  const team_avg_quote = Math.round(MOCK.reduce((s, f) => s + f.quote_pct, 0) / MOCK.length);
  return NextResponse.json({
    fahrer: data,
    team_avg_quote,
    beste_name: MOCK[0].fahrer_name,
    schlechteste_name: MOCK[MOCK.length - 1].fahrer_name,
    alert_count: MOCK.filter(f => f.alert_niedrig).length,
    gesamt: MOCK.length,
  } satisfies ApiResponse);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');
  const driver_id   = searchParams.get('driver_id');

  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const now = Date.now();
    const since30  = new Date(now - 30  * 86400000).toISOString();
    const since60  = new Date(now - 60  * 86400000).toISOString();

    // Stop-Vollständigkeit: delivered_at gesetzt = erfolgreich; kein delivered_at = nicht zugestellt
    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('delivery_stops')
        .select('driver_id, driver_name, delivered_at')
        .eq('location_id', location_id)
        .gte('created_at', since30),
      supabase
        .from('delivery_stops')
        .select('driver_id, delivered_at')
        .eq('location_id', location_id)
        .gte('created_at', since60)
        .lt('created_at', since30),
    ]);

    type StopRow = { driver_id: string; driver_name?: string; delivered_at: string | null };

    const curStops  = (curRes.data  ?? []) as StopRow[];
    const prevStops = (prevRes.data ?? []) as StopRow[];

    if (!curStops.length) return buildMockResponse(driver_id);

    // Aggregate: total stops + delivered stops per driver
    const statsMap = new Map<string, { name: string; total: number; delivered: number }>();
    for (const s of curStops) {
      if (!s.driver_id) continue;
      const entry = statsMap.get(s.driver_id) ?? { name: s.driver_name ?? s.driver_id, total: 0, delivered: 0 };
      entry.total += 1;
      if (s.delivered_at) entry.delivered += 1;
      statsMap.set(s.driver_id, entry);
    }

    if (!statsMap.size) return buildMockResponse(driver_id);

    // ABSTEIGEND: Rang 1 = höchste Quote = bester
    const sorted = Array.from(statsMap.entries())
      .map(([id, e]) => ({
        fahrer_id:   id,
        fahrer_name: e.name,
        quote_pct:   Math.round((e.delivered / e.total) * 100),
      }))
      .sort((a, b) => b.quote_pct - a.quote_pct);

    const gesamt = sorted.length;

    // Prev-period ranking for rank_delta
    const prevMap = new Map<string, { total: number; delivered: number }>();
    for (const s of prevStops) {
      if (!s.driver_id) continue;
      const entry = prevMap.get(s.driver_id) ?? { total: 0, delivered: 0 };
      entry.total += 1;
      if (s.delivered_at) entry.delivered += 1;
      prevMap.set(s.driver_id, entry);
    }
    const prevSorted = Array.from(prevMap.entries())
      .map(([id, e]) => ({ id, quote: e.total ? e.delivered / e.total : 0 }))
      .sort((a, b) => b.quote - a.quote)
      .map(e => e.id);

    const top25 = Math.ceil(gesamt * 0.25);
    const bot75 = Math.floor(gesamt * 0.75);
    const team_avg_quote = Math.round(sorted.reduce((s, f) => s + f.quote_pct, 0) / gesamt);

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevIdx = prevSorted.indexOf(f.fahrer_id);
      const prevRang = prevIdx >= 0 ? prevIdx + 1 : rang;
      return {
        ...f,
        rang,
        rank_delta:    prevRang - rang,
        ampel:         rang <= top25 ? 'gruen' : rang <= bot75 ? 'gelb' : 'rot',
        alert_niedrig: f.quote_pct < 90,
      };
    });

    const result = driver_id ? fahrer.filter(f => f.fahrer_id === driver_id) : fahrer;

    return NextResponse.json({
      fahrer: result,
      team_avg_quote,
      beste_name:       fahrer[0]?.fahrer_name ?? '',
      schlechteste_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
      alert_count:      fahrer.filter(f => f.alert_niedrig).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return buildMockResponse(driver_id);
  }
}
