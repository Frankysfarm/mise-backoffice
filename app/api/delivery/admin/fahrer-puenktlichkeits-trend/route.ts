/**
 * GET /api/delivery/admin/fahrer-puenktlichkeits-trend?location_id=<uuid>
 *
 * Phase 1502 - Fahrer-Puenktlichkeits-Trend-API
 * Puenktlichkeits-Score je Fahrer (heute vs. 7-Tage-Schnitt) + Trend-Richtung + Top-3/Flop-3.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerPuenktlichkeitsEintrag {
  fahrer_id: string;
  fahrer_name: string;
  score_heute: number;
  score_7tage: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  puenktliche_lieferungen_heute: number;
  gesamt_lieferungen_heute: number;
}

export interface FahrerPuenktlichkeitsTrendResponse {
  fahrer: FahrerPuenktlichkeitsEintrag[];
  top3: FahrerPuenktlichkeitsEintrag[];
  flop3: FahrerPuenktlichkeitsEintrag[];
  team_schnitt_heute: number;
  team_schnitt_7tage: number;
  location_id: string;
  generiert_am: string;
}

function calcTrend(heute: number, schnitt7: number): 'besser' | 'gleich' | 'schlechter' {
  if (heute > schnitt7 + 5) return 'besser';
  if (heute < schnitt7 - 5) return 'schlechter';
  return 'gleich';
}

function buildMock(): FahrerPuenktlichkeitsTrendResponse {
  const fahrer: FahrerPuenktlichkeitsEintrag[] = [
    { fahrer_id: 'mock-1', fahrer_name: 'Max Mueller', score_heute: 92, score_7tage: 88, trend: 'besser', puenktliche_lieferungen_heute: 11, gesamt_lieferungen_heute: 12 },
    { fahrer_id: 'mock-2', fahrer_name: 'Anna Schmidt', score_heute: 85, score_7tage: 87, trend: 'gleich', puenktliche_lieferungen_heute: 9, gesamt_lieferungen_heute: 11 },
    { fahrer_id: 'mock-3', fahrer_name: 'Klaus Weber', score_heute: 78, score_7tage: 82, trend: 'schlechter', puenktliche_lieferungen_heute: 7, gesamt_lieferungen_heute: 9 },
    { fahrer_id: 'mock-4', fahrer_name: 'Lisa Braun', score_heute: 95, score_7tage: 90, trend: 'besser', puenktliche_lieferungen_heute: 19, gesamt_lieferungen_heute: 20 },
    { fahrer_id: 'mock-5', fahrer_name: 'Tom Fischer', score_heute: 60, score_7tage: 75, trend: 'schlechter', puenktliche_lieferungen_heute: 3, gesamt_lieferungen_heute: 5 },
  ];
  const sorted = [...fahrer].sort((a, b) => b.score_heute - a.score_heute);
  return {
    fahrer: sorted,
    top3: sorted.slice(0, 3),
    flop3: [...sorted].reverse().slice(0, 3),
    team_schnitt_heute: Math.round(fahrer.reduce((s, f) => s + f.score_heute, 0) / fahrer.length),
    team_schnitt_7tage: Math.round(fahrer.reduce((s, f) => s + f.score_7tage, 0) / fahrer.length),
    location_id: 'mock',
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const { data: drivers } = await (sb as any)
      .from('mise_drivers')
      .select('id, name, vorname, nachname')
      .eq('location_id', locationId);

    if (!drivers || (drivers as unknown[]).length === 0) {
      return NextResponse.json({ ...buildMock(), location_id: locationId });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const { data: tagesStopps } = await (sb as any)
      .from('mise_delivery_stops')
      .select('batch_id, geliefert_am, versucht_um, soll_zeit')
      .gte('created_at', todayStart.toISOString())
      .not('geliefert_am', 'is', null);

    const { data: wocheStopps } = await (sb as any)
      .from('mise_delivery_stops')
      .select('batch_id, geliefert_am, versucht_um, soll_zeit')
      .gte('created_at', sevenDaysAgo.toISOString())
      .not('geliefert_am', 'is', null);

    const { data: tagesBatches } = await (sb as any)
      .from('mise_delivery_batches')
      .select('id, driver_id')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString());

    const { data: wocheBatches } = await (sb as any)
      .from('mise_delivery_batches')
      .select('id, driver_id')
      .eq('location_id', locationId)
      .gte('created_at', sevenDaysAgo.toISOString());

    type StoppRow = { batch_id: string; geliefert_am: string; versucht_um?: string; soll_zeit?: string };
    type BatchRow = { id: string; driver_id: string };

    const tagesBatchMap = new Map<string, string>();
    (tagesBatches as BatchRow[] ?? []).forEach(b => tagesBatchMap.set(b.id, b.driver_id));

    const wocheBatchMap = new Map<string, string>();
    (wocheBatches as BatchRow[] ?? []).forEach(b => wocheBatchMap.set(b.id, b.driver_id));

    const SLA_MIN = 45;

    function isPuenktlich(stopp: StoppRow): boolean {
      if (!stopp.geliefert_am) return false;
      if (stopp.soll_zeit) {
        const soll = new Date(stopp.soll_zeit).getTime();
        const geliefert = new Date(stopp.geliefert_am).getTime();
        return geliefert <= soll + 2 * 60 * 1000;
      }
      if (stopp.versucht_um) {
        const start = new Date(stopp.versucht_um).getTime();
        const end = new Date(stopp.geliefert_am).getTime();
        return (end - start) / 60_000 <= SLA_MIN;
      }
      return true;
    }

    type DriverRow = { id: string; name?: string; vorname?: string; nachname?: string };

    const fahrerList: FahrerPuenktlichkeitsEintrag[] = (drivers as DriverRow[]).map(d => {
      const meineTagesBatches = new Set<string>();
      tagesBatchMap.forEach((driverId, batchId) => { if (driverId === d.id) meineTagesBatches.add(batchId); });
      const myTagesStopps = (tagesStopps as StoppRow[] ?? []).filter(s => meineTagesBatches.has(s.batch_id));

      const meineWocheBatches = new Set<string>();
      wocheBatchMap.forEach((driverId, batchId) => { if (driverId === d.id) meineWocheBatches.add(batchId); });
      const myWocheStopps = (wocheStopps as StoppRow[] ?? []).filter(s => meineWocheBatches.has(s.batch_id));

      const pHeuteTotal = myTagesStopps.length;
      const pHeutePuenktlich = myTagesStopps.filter(isPuenktlich).length;
      const scoreHeute = pHeuteTotal > 0 ? Math.round((pHeutePuenktlich / pHeuteTotal) * 100) : 0;

      const pWocheTotal = myWocheStopps.length;
      const pWochePuenktlich = myWocheStopps.filter(isPuenktlich).length;
      const score7Tage = pWocheTotal > 0 ? Math.round((pWochePuenktlich / pWocheTotal) * 100) : 0;

      const nameParts = `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim();
      const name = d.name ?? (nameParts || 'Fahrer');

      return {
        fahrer_id: d.id,
        fahrer_name: name,
        score_heute: scoreHeute,
        score_7tage: score7Tage,
        trend: calcTrend(scoreHeute, score7Tage),
        puenktliche_lieferungen_heute: pHeutePuenktlich,
        gesamt_lieferungen_heute: pHeuteTotal,
      };
    }).filter(f => f.gesamt_lieferungen_heute > 0);

    if (fahrerList.length === 0) {
      return NextResponse.json({ ...buildMock(), location_id: locationId });
    }

    const sorted = [...fahrerList].sort((a, b) => b.score_heute - a.score_heute);
    const teamHeute = Math.round(fahrerList.reduce((s, f) => s + f.score_heute, 0) / fahrerList.length);
    const team7Tage = Math.round(fahrerList.reduce((s, f) => s + f.score_7tage, 0) / fahrerList.length);

    const response: FahrerPuenktlichkeitsTrendResponse = {
      fahrer: sorted,
      top3: sorted.slice(0, 3),
      flop3: [...sorted].reverse().slice(0, 3),
      team_schnitt_heute: teamHeute,
      team_schnitt_7tage: team7Tage,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ ...buildMock(), location_id: locationId });
  }
}
