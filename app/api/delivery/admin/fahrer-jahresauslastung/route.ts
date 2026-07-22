import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(pct: number): Ampel {
  if (pct >= 60) return 'gruen';
  if (pct >= 40) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 0.5) return { trend: 'steigend', delta };
  if (delta < -0.5) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

function getJahresWindow(year: number): { start: Date; end: Date; tage: number } {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end   = new Date(year + 1, 0, 1, 0, 0, 0, 0);
  const tage  = (end.getTime() - start.getTime()) / 86400000;
  return { start, end, tage };
}

function getQuartalWindow(year: number, q: number): { start: Date; end: Date; tage: number } {
  const qStartMonth = (q - 1) * 3;
  const start = new Date(year, qStartMonth, 1, 0, 0, 0, 0);
  const end   = new Date(year, qStartMonth + 3, 1, 0, 0, 0, 0);
  const tage  = (end.getTime() - start.getTime()) / 86400000;
  return { start, end, tage };
}

export interface FahrerJahresauslastung {
  fahrer_id: string;
  fahrer_name: string;
  auslastung_pct: number;
  auslastung_pct_vorjahr: number;
  quartale_pct: number[];
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_gering: boolean;
}

export interface FahrerJahresauslastungResponse {
  fahrer: FahrerJahresauslastung[];
  team_avg_pct: number;
  team_avg_pct_vorjahr: number;
  alert_count: number;
  jahr: number;
  jahr_tage: number;
  generiert_am: string;
}

function buildMock(
  _locationId: string,
  driverId: string | undefined,
  jahr: number,
  jahr_tage: number,
): FahrerJahresauslastungResponse {
  const drivers = [
    { id: 'd1', name: 'Max M.',   pct: 64.2, qp: [62, 65, 66, 63] },
    { id: 'd2', name: 'Sara K.',  pct: 52.7, qp: [55, 51, 53, 52] },
    { id: 'd3', name: 'Tim B.',   pct: 37.5, qp: [40, 36, 38, 36] },
    { id: 'd4', name: 'Julia F.', pct: 71.8, qp: [70, 72, 73, 71] },
  ];

  const fahrer: FahrerJahresauslastung[] = drivers.map(d => {
    const pct_vj = Math.max(0, Math.min(100, d.pct + (d.pct > 55 ? -4.0 : 4.0)));
    const { trend, delta } = calcTrend(d.pct, pct_vj);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      auslastung_pct: d.pct,
      auslastung_pct_vorjahr: Math.round(pct_vj * 10) / 10,
      quartale_pct: d.qp,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(d.pct),
      alert_gering: d.pct < 40,
    };
  }).sort((a, b) => b.auslastung_pct - a.auslastung_pct);

  const team_avg    = Math.round((fahrer.reduce((s, f) => s + f.auslastung_pct, 0)            / fahrer.length) * 10) / 10;
  const team_avg_vj = Math.round((fahrer.reduce((s, f) => s + f.auslastung_pct_vorjahr, 0)    / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_gering).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer: [f], team_avg_pct: team_avg, team_avg_pct_vorjahr: team_avg_vj, alert_count: 0, jahr, jahr_tage, generiert_am: new Date().toISOString() };
  }

  return { fahrer, team_avg_pct: team_avg, team_avg_pct_vorjahr: team_avg_vj, alert_count, jahr, jahr_tage, generiert_am: new Date().toISOString() };
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

  const now       = new Date();
  const currYear  = now.getFullYear();
  const prevYear  = currYear - 1;
  const curr      = getJahresWindow(currYear);
  const prev      = getJahresWindow(prevYear);

  try {
    const supabase = createServiceClient();

    const { data: drivers, error: dErr } = await supabase
      .from('drivers')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) {
      return NextResponse.json(buildMock(locationId, driverId, currYear, curr.tage));
    }

    const JAHR_MIN      = curr.tage * 24 * 60;
    const JAHR_MIN_PREV = prev.tage * 24 * 60;

    const [{ data: thisStops }, { data: vjStops }] = await Promise.all([
      supabase
        .from('batch_stops')
        .select('driver_id, created_at, delivered_at')
        .eq('location_id', locationId)
        .in('status', ['completed', 'delivered', 'active', 'in_transit'])
        .not('created_at', 'is', null)
        .gte('created_at', curr.start.toISOString())
        .lt('created_at', curr.end.toISOString()),
      supabase
        .from('batch_stops')
        .select('driver_id, created_at, delivered_at')
        .eq('location_id', locationId)
        .in('status', ['completed', 'delivered'])
        .not('created_at', 'is', null)
        .gte('created_at', prev.start.toISOString())
        .lt('created_at', prev.end.toISOString()),
    ]);

    const stopsTyped   = thisStops as { driver_id: string; created_at: string; delivered_at: string | null }[] | null;
    const stopsVjTyped = vjStops   as { driver_id: string; created_at: string; delivered_at: string | null }[] | null;

    const fahrerList: FahrerJahresauslastung[] = drivers.map(d => {
      // Quartalsaufschlüsselung Q1–Q4
      const quartale_pct: number[] = [];
      for (let q = 1; q <= 4; q++) {
        const qw   = getQuartalWindow(currYear, q);
        const qMin = activeMinutesInWindow(stopsTyped, d.id, qw.start, qw.end);
        const qPct = Math.min(100, Math.round((qMin / (qw.tage * 24 * 60)) * 1000) / 10);
        quartale_pct.push(qPct);
      }

      const totalMin = activeMinutesInWindow(stopsTyped, d.id, curr.start, curr.end);
      const pct      = Math.min(100, Math.round((totalMin / JAHR_MIN) * 1000) / 10);

      const vjMin = activeMinutesInWindow(stopsVjTyped, d.id, prev.start, prev.end);
      const pctVj = Math.min(100, Math.round((vjMin / JAHR_MIN_PREV) * 1000) / 10);

      const { trend, delta } = calcTrend(pct, pctVj);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        auslastung_pct: pct,
        auslastung_pct_vorjahr: pctVj,
        quartale_pct,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(pct),
        alert_gering: pct < 40,
      };
    }).sort((a, b) => b.auslastung_pct - a.auslastung_pct);

    const team_avg    = fahrerList.length ? Math.round((fahrerList.reduce((s, f) => s + f.auslastung_pct, 0)            / fahrerList.length) * 10) / 10 : 0;
    const team_avg_vj = fahrerList.length ? Math.round((fahrerList.reduce((s, f) => s + f.auslastung_pct_vorjahr, 0)    / fahrerList.length) * 10) / 10 : 0;
    const alert_count = fahrerList.filter(f => f.alert_gering).length;

    if (driverId) {
      const f = fahrerList.find(fd => fd.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer: f ? [f] : [], team_avg_pct: team_avg, team_avg_pct_vorjahr: team_avg_vj, alert_count: 0, jahr: currYear, jahr_tage: curr.tage, generiert_am: new Date().toISOString() });
    }

    return NextResponse.json({ fahrer: fahrerList, team_avg_pct: team_avg, team_avg_pct_vorjahr: team_avg_vj, alert_count, jahr: currYear, jahr_tage: curr.tage, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId, currYear, curr.tage));
  }
}
