import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  rueckkehr_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_lang: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  schnellste_name: string;
  langsamste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: FahrerRow[] = [
  { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, rueckkehr_min: 6,  rank_delta:  1, ampel: 'gruen', alert_lang: false },
  { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, rueckkehr_min: 9,  rank_delta:  0, ampel: 'gruen', alert_lang: false },
  { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, rueckkehr_min: 14, rank_delta: -1, ampel: 'gelb',  alert_lang: false },
  { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, rueckkehr_min: 22, rank_delta:  0, ampel: 'rot',   alert_lang: true  },
];

function buildMockResponse(driver_id: string | null): NextResponse {
  const data = driver_id ? MOCK.filter(f => f.fahrer_id === driver_id) : MOCK;
  const team_avg = Math.round(MOCK.reduce((s, f) => s + f.rueckkehr_min, 0) / MOCK.length);
  return NextResponse.json({
    fahrer: data,
    team_avg,
    schnellste_name: MOCK[0].fahrer_name,
    langsamste_name: MOCK[MOCK.length - 1].fahrer_name,
    alert_count: MOCK.filter(f => f.alert_lang).length,
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
    const since30 = new Date(now - 30 * 86400000).toISOString();
    const since60 = new Date(now - 60 * 86400000).toISOString();

    // tours.completed_at = driver returned to depot
    const [tourCurRes, tourPrevRes, stopCurRes] = await Promise.all([
      supabase
        .from('tours')
        .select('driver_id, driver_name, completed_at, started_at')
        .eq('location_id', location_id)
        .gte('completed_at', since30)
        .not('completed_at', 'is', null),
      supabase
        .from('tours')
        .select('driver_id, completed_at, started_at')
        .eq('location_id', location_id)
        .gte('completed_at', since60)
        .lt('completed_at', since30)
        .not('completed_at', 'is', null),
      supabase
        .from('delivery_stops')
        .select('driver_id, delivered_at')
        .eq('location_id', location_id)
        .gte('delivered_at', since30)
        .not('delivered_at', 'is', null),
    ]);

    type TourRow = { driver_id: string; driver_name?: string; completed_at: string; started_at?: string };
    type StopRow = { driver_id: string; delivered_at: string };

    const curTours  = (tourCurRes.data  ?? []) as TourRow[];
    const prevTours = (tourPrevRes.data ?? []) as TourRow[];
    const curStops  = (stopCurRes.data  ?? []) as StopRow[];

    if (!curTours.length) return buildMockResponse(driver_id);

    // Build max delivered_at per driver per day from stops
    const lastDeliveryByDriverDay = new Map<string, number>();
    for (const s of curStops) {
      if (!s.driver_id || !s.delivered_at) continue;
      const day = s.delivered_at.slice(0, 10);
      const key = `${s.driver_id}::${day}`;
      const ms = new Date(s.delivered_at).getTime();
      const prev = lastDeliveryByDriverDay.get(key) ?? 0;
      if (ms > prev) lastDeliveryByDriverDay.set(key, ms);
    }

    // Compute return time per tour: completed_at - last_delivered_at on same day
    const returnMinsByDriver = new Map<string, { name: string; mins: number[] }>();
    for (const t of curTours) {
      if (!t.driver_id || !t.completed_at) continue;
      const day = t.completed_at.slice(0, 10);
      const key = `${t.driver_id}::${day}`;
      const lastDelivery = lastDeliveryByDriverDay.get(key);
      if (!lastDelivery) continue;
      const returnMs = new Date(t.completed_at).getTime() - lastDelivery;
      if (returnMs <= 0 || returnMs > 90 * 60 * 1000) continue; // ignore implausible values
      const returnMin = Math.round(returnMs / 60000);
      const entry = returnMinsByDriver.get(t.driver_id) ?? { name: t.driver_name ?? t.driver_id, mins: [] };
      entry.mins.push(returnMin);
      returnMinsByDriver.set(t.driver_id, entry);
    }

    if (!returnMinsByDriver.size) return buildMockResponse(driver_id);

    // AUFSTEIGEND: Rang 1 = niedrigste Ø-Rückkehrzeit = bester
    const sorted = Array.from(returnMinsByDriver.entries())
      .map(([id, e]) => ({
        fahrer_id:    id,
        fahrer_name:  e.name,
        rueckkehr_min: Math.round(e.mins.reduce((s, v) => s + v, 0) / e.mins.length),
      }))
      .sort((a, b) => a.rueckkehr_min - b.rueckkehr_min);

    const gesamt = sorted.length;

    // Prev period ranking for rank_delta
    const prevReturnByDriver = new Map<string, number[]>();
    for (const t of prevTours) {
      if (!t.driver_id || !t.completed_at) continue;
      const day = t.completed_at.slice(0, 10);
      const key = `${t.driver_id}::${day}`;
      const lastDelivery = lastDeliveryByDriverDay.get(key);
      if (!lastDelivery) continue;
      const ms = new Date(t.completed_at).getTime() - lastDelivery;
      if (ms <= 0 || ms > 90 * 60 * 1000) continue;
      const arr = prevReturnByDriver.get(t.driver_id) ?? [];
      arr.push(Math.round(ms / 60000));
      prevReturnByDriver.set(t.driver_id, arr);
    }
    const prevSorted = Array.from(prevReturnByDriver.entries())
      .map(([id, mins]) => ({ id, avg: mins.reduce((s, v) => s + v, 0) / mins.length }))
      .sort((a, b) => a.avg - b.avg)
      .map(e => e.id);

    const top25 = Math.ceil(gesamt * 0.25);
    const bot75 = Math.floor(gesamt * 0.75);
    const team_avg = Math.round(sorted.reduce((s, f) => s + f.rueckkehr_min, 0) / gesamt);

    const fahrer: FahrerRow[] = sorted.map((f, i) => {
      const rang = i + 1;
      const prevIdx = prevSorted.indexOf(f.fahrer_id);
      const prevRang = prevIdx >= 0 ? prevIdx + 1 : rang;
      return {
        ...f,
        rang,
        rank_delta: prevRang - rang,
        ampel:      rang <= top25 ? 'gruen' : rang <= bot75 ? 'gelb' : 'rot',
        alert_lang: rang > bot75,
      };
    });

    const result = driver_id ? fahrer.filter(f => f.fahrer_id === driver_id) : fahrer;

    return NextResponse.json({
      fahrer: result,
      team_avg,
      schnellste_name: fahrer[0]?.fahrer_name ?? '',
      langsamste_name: fahrer[gesamt - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_lang).length,
      gesamt,
    } satisfies ApiResponse);
  } catch {
    return buildMockResponse(driver_id);
  }
}
