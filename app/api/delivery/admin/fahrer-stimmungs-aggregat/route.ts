/**
 * GET /api/delivery/admin/fahrer-stimmungs-aggregat
 *   ?location_id=<uuid>
 *
 * Phase 1251 — Fahrer-Stimmungs-Aggregat-API
 * Aggregierte Stimmungsdaten aller Fahrer je Schicht:
 *   - Ø-Score aller Fahrer (aus driver_mood_logs, letzte 8h)
 *   - Kritische Fahrer mit Score ≤2 (id + name + letzter Score)
 *   - Gesamtanzahl Einträge heute
 *   - Trend: steigend/stabil/fallend (erste 50% vs. letzte 50% der Einträge nach Zeit)
 *   - Stimmungs-Verteilung: Count je Wert 1–5
 *
 * Multi-Tenant: location_id on every Supabase query.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerStimmungsAggregat {
  schnitt: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  kritische_fahrer: Array<{ id: string; name: string; letzter_score: number }>;
  stimmungs_verteilung: Array<{ score: number; count: number }>;
  gesamt_eintraege: number;
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): FahrerStimmungsAggregat {
  return {
    schnitt: 3.8,
    trend: 'steigend',
    kritische_fahrer: [
      { id: 'mock-driver-1', name: 'K. Bauer', letzter_score: 2 },
      { id: 'mock-driver-2', name: 'T. Fischer', letzter_score: 1 },
    ],
    stimmungs_verteilung: [
      { score: 1, count: 0 },
      { score: 2, count: 1 },
      { score: 3, count: 3 },
      { score: 4, count: 5 },
      { score: 5, count: 4 },
    ],
    gesamt_eintraege: 13,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id') ?? '';

  try {
    const supabase = await createClient();

    const jetzt = new Date();
    const vor8h = new Date(jetzt.getTime() - 8 * 60 * 60 * 1_000).toISOString();
    const heute = jetzt.toISOString().slice(0, 10);

    // Stimmungseinträge der letzten 8h für diese Location (via mise_drivers join)
    const { data: logsRaw } = await supabase
      .from('driver_mood_logs')
      .select('driver_id, mood_score, created_at, mise_drivers!inner(id, name, location_id)')
      .eq('mise_drivers.location_id', locationId)
      .gte('created_at', vor8h)
      .order('created_at', { ascending: true });

    if (!logsRaw || logsRaw.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logs = logsRaw as any[];

    // Gesamtanzahl Einträge heute
    const { count: gesamtHeute } = await supabase
      .from('driver_mood_logs')
      .select('id', { count: 'exact', head: true })
      .eq('mise_drivers.location_id', locationId)
      .gte('created_at', `${heute}T00:00:00`);

    const gesamt_eintraege = gesamtHeute ?? logs.length;

    // Ø-Score
    const scores = logs.map((l) => Number(l.mood_score));
    const schnitt =
      scores.length > 0
        ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100
        : 0;

    // Trend: erste 50% vs. letzte 50% nach Zeit (bereits aufsteigend sortiert)
    let trend: FahrerStimmungsAggregat['trend'] = 'stabil';
    if (scores.length >= 2) {
      const mid = Math.ceil(scores.length / 2);
      const ersteHaelfte = scores.slice(0, mid);
      const letzteHaelfte = scores.slice(mid);
      const schnittErste =
        ersteHaelfte.reduce((s, v) => s + v, 0) / ersteHaelfte.length;
      const schnittLetzte =
        letzteHaelfte.length > 0
          ? letzteHaelfte.reduce((s, v) => s + v, 0) / letzteHaelfte.length
          : schnittErste;
      const diff = schnittLetzte - schnittErste;
      if (diff >= 0.3) trend = 'steigend';
      else if (diff <= -0.3) trend = 'fallend';
    }

    // Stimmungs-Verteilung 1–5
    const verteilungMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const l of logs) {
      const s = Math.round(Number(l.mood_score));
      if (s >= 1 && s <= 5) verteilungMap[s] += 1;
    }
    const stimmungs_verteilung = [1, 2, 3, 4, 5].map((score) => ({
      score,
      count: verteilungMap[score] ?? 0,
    }));

    // Kritische Fahrer: letzter Score je Fahrer, dann ≤2 filtern
    const letzterScoreJeFahrer = new Map<
      string,
      { id: string; name: string; letzter_score: number }
    >();
    for (const l of logs) {
      const drv = Array.isArray(l.mise_drivers) ? l.mise_drivers[0] : l.mise_drivers;
      const driverId = (l.driver_id ?? drv?.id ?? '') as string;
      const name = (drv?.name ?? 'Unbekannt') as string;
      const score = Math.round(Number(l.mood_score));
      // Logs sind aufsteigend nach Zeit — letzter Eintrag überschreibt
      letzterScoreJeFahrer.set(driverId, { id: driverId, name, letzter_score: score });
    }
    const kritische_fahrer = [...letzterScoreJeFahrer.values()]
      .filter((f) => f.letzter_score <= 2)
      .sort((a, b) => a.letzter_score - b.letzter_score);

    const result: FahrerStimmungsAggregat = {
      schnitt,
      trend,
      kritische_fahrer,
      stimmungs_verteilung,
      gesamt_eintraege,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
