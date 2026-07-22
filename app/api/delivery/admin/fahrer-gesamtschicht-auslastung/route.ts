import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

// Three shifts: Früh 06–14, Spät 14–22, Nacht 22–06 each 480 min
const SCHICHT_MINUTEN = 8 * 60; // 480 Min per shift
const GESAMT_MINUTEN  = 3 * SCHICHT_MINUTEN; // 1440 Min (24h)

function calcAmpel(pct: number): Ampel {
  if (pct >= 75) return 'gruen';
  if (pct >= 50) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 0.5) return { trend: 'steigend', delta };
  if (delta < -0.5) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerGesamtschichtAuslastung {
  fahrer_id: string;
  fahrer_name: string;
  auslastung_pct: number;
  frueh_pct: number;
  spaet_pct: number;
  nacht_pct: number;
  auslastung_pct_vorwoche: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_gering: boolean;
}

export interface FahrerGesamtschichtAuslastungResponse {
  fahrer: FahrerGesamtschichtAuslastung[];
  team_avg_pct: number;
  team_avg_pct_vorwoche: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   gesamt: 82.1, frueh: 88.0, spaet: 79.0, nacht: 79.3 },
    { id: 'd2', name: 'Sara K.',  gesamt: 71.5, frueh: 74.0, spaet: 73.0, nacht: 67.5 },
    { id: 'd3', name: 'Tim B.',   gesamt: 55.2, frueh: 60.0, spaet: 58.0, nacht: 47.6 },
    { id: 'd4', name: 'Julia F.', gesamt: 90.3, frueh: 92.0, spaet: 88.0, nacht: 90.9 },
  ];

  const fahrer: FahrerGesamtschichtAuslastung[] = drivers.map(d => {
    const pct_vw = Math.max(0, Math.min(100, d.gesamt + (d.gesamt > 70 ? -4 : 4)));
    const { trend, delta } = calcTrend(d.gesamt, pct_vw);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      auslastung_pct: d.gesamt,
      frueh_pct: d.frueh,
      spaet_pct: d.spaet,
      nacht_pct: d.nacht,
      auslastung_pct_vorwoche: Math.round(pct_vw * 10) / 10,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(d.gesamt),
      alert_gering: d.gesamt < 50,
    };
  }).sort((a, b) => b.auslastung_pct - a.auslastung_pct);

  const team_avg    = Math.round((fahrer.reduce((s, f) => s + f.auslastung_pct, 0)          / fahrer.length) * 10) / 10;
  const team_avg_vw = Math.round((fahrer.reduce((s, f) => s + f.auslastung_pct_vorwoche, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_gering).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_pct: team_avg };
  }

  return { fahrer, team_avg_pct: team_avg, team_avg_pct_vorwoche: team_avg_vw, alert_count, generiert_am: new Date().toISOString() };
}

function activeMinutesInWindow(
  stops: { driver_id: string; created_at: string; delivered_at: string | null }[] | null,
  dId: string,
  windowStart: Date,
  windowEnd: Date,
): number {
  const ds = (stops ?? []).filter(s => s.driver_id === dId && s.created_at);
  let totalMs = 0;
  for (const s of ds) {
    const start = new Date(s.created_at);
    const end   = s.delivered_at ? new Date(s.delivered_at) : new Date(start.getTime() + 20 * 60000);
    const cs = start < windowStart ? windowStart : start;
    const ce = end   > windowEnd   ? windowEnd   : end;
    const diff = ce.getTime() - cs.getTime();
    if (diff > 0) totalMs += diff;
  }
  return Math.round(totalMs / 60000);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();

    const { data: drivers, error: dErr } = await supabase
      .from('drivers')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Shift windows for today
    const fruehStart  = new Date(today); fruehStart.setHours(6, 0, 0, 0);
    const fruehEnd    = new Date(today); fruehEnd.setHours(14, 0, 0, 0);
    const spaetStart  = new Date(today); spaetStart.setHours(14, 0, 0, 0);
    const spaetEnd    = new Date(today); spaetEnd.setHours(22, 0, 0, 0);
    // Night: yesterday 22:00 to today 06:00
    const nachtStart  = new Date(today); nachtStart.setDate(nachtStart.getDate() - 1); nachtStart.setHours(22, 0, 0, 0);
    const nachtEnd    = new Date(today); nachtEnd.setHours(6, 0, 0, 0);

    // Previous week windows
    const fruehStartVw  = new Date(fruehStart); fruehStartVw.setDate(fruehStartVw.getDate() - 7);
    const fruehEndVw    = new Date(fruehEnd);   fruehEndVw.setDate(fruehEndVw.getDate()     - 7);
    const spaetStartVw  = new Date(spaetStart); spaetStartVw.setDate(spaetStartVw.getDate() - 7);
    const spaetEndVw    = new Date(spaetEnd);   spaetEndVw.setDate(spaetEndVw.getDate()     - 7);
    const nachtStartVw  = new Date(nachtStart); nachtStartVw.setDate(nachtStartVw.getDate() - 7);
    const nachtEndVw    = new Date(nachtEnd);   nachtEndVw.setDate(nachtEndVw.getDate()     - 7);

    const dayStart = new Date(nachtStart);
    const dayEnd   = spaetEnd;
    const dayStartVw = new Date(nachtStartVw);
    const dayEndVw   = spaetEndVw;

    const { data: todayStops } = await supabase
      .from('batch_stops')
      .select('driver_id, created_at, delivered_at')
      .eq('location_id', locationId)
      .in('status', ['completed', 'delivered', 'active', 'in_transit'])
      .not('created_at', 'is', null)
      .gte('created_at', dayStart.toISOString())
      .lte('created_at', dayEnd.toISOString());

    const { data: vwStops } = await supabase
      .from('batch_stops')
      .select('driver_id, created_at, delivered_at')
      .eq('location_id', locationId)
      .in('status', ['completed', 'delivered'])
      .not('created_at', 'is', null)
      .gte('created_at', dayStartVw.toISOString())
      .lte('created_at', dayEndVw.toISOString());

    const stopsTyped = todayStops as { driver_id: string; created_at: string; delivered_at: string | null }[] | null;
    const stopsVwTyped = vwStops as { driver_id: string; created_at: string; delivered_at: string | null }[] | null;

    const fahrerList: FahrerGesamtschichtAuslastung[] = drivers.map(d => {
      const fruehMin  = activeMinutesInWindow(stopsTyped, d.id, fruehStart, fruehEnd);
      const spaetMin  = activeMinutesInWindow(stopsTyped, d.id, spaetStart, spaetEnd);
      const nachtMin  = activeMinutesInWindow(stopsTyped, d.id, nachtStart, nachtEnd);

      const fruehMinVw = activeMinutesInWindow(stopsVwTyped, d.id, fruehStartVw, fruehEndVw);
      const spaetMinVw = activeMinutesInWindow(stopsVwTyped, d.id, spaetStartVw, spaetEndVw);
      const nachtMinVw = activeMinutesInWindow(stopsVwTyped, d.id, nachtStartVw, nachtEndVw);

      const totalMin   = fruehMin + spaetMin + nachtMin;
      const totalMinVw = fruehMinVw + spaetMinVw + nachtMinVw;

      const pct   = Math.min(100, Math.round((totalMin   / GESAMT_MINUTEN) * 1000) / 10);
      const pctVw = Math.min(100, Math.round((totalMinVw / GESAMT_MINUTEN) * 1000) / 10);

      const fruehPct = Math.min(100, Math.round((fruehMin  / SCHICHT_MINUTEN) * 1000) / 10);
      const spaetPct = Math.min(100, Math.round((spaetMin  / SCHICHT_MINUTEN) * 1000) / 10);
      const nachtPct = Math.min(100, Math.round((nachtMin  / SCHICHT_MINUTEN) * 1000) / 10);

      const { trend, delta } = calcTrend(pct, pctVw);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        auslastung_pct: pct,
        frueh_pct: fruehPct,
        spaet_pct: spaetPct,
        nacht_pct: nachtPct,
        auslastung_pct_vorwoche: pctVw,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(pct),
        alert_gering: pct < 50,
      };
    }).sort((a, b) => b.auslastung_pct - a.auslastung_pct);

    const team_avg    = fahrerList.length ? Math.round((fahrerList.reduce((s, f) => s + f.auslastung_pct, 0)          / fahrerList.length) * 10) / 10 : 0;
    const team_avg_vw = fahrerList.length ? Math.round((fahrerList.reduce((s, f) => s + f.auslastung_pct_vorwoche, 0) / fahrerList.length) * 10) / 10 : 0;
    const alert_count = fahrerList.filter(f => f.alert_gering).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_pct: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_pct: team_avg,
      team_avg_pct_vorwoche: team_avg_vw,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
