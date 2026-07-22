import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(delta: number): Ampel {
  if (delta >= 2)  return 'gruen';
  if (delta > -2)  return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta >= 2)  return { trend: 'steigend', delta };
  if (delta <= -2) return { trend: 'fallend',  delta };
  return { trend: 'stabil', delta };
}

function getJahresWindow(year: number): { start: Date; end: Date; tage: number } {
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end   = new Date(year + 1, 0, 1, 0, 0, 0, 0);
  const tage  = (end.getTime() - start.getTime()) / 86400000;
  return { start, end, tage };
}

export interface FahrerMehrjahresTrend {
  fahrer_id: string;
  fahrer_name: string;
  jahre_pct: number[];
  aktuell_pct: number;
  vorjahr_pct: number;
  vorvorjahr_pct: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_negativ: boolean;
}

export interface FahrerMehrjahresTrendResponse {
  fahrer: FahrerMehrjahresTrend[];
  team_avg_pct: number;
  team_avg_pct_vorjahr: number;
  team_avg_pct_vorvorjahr: number;
  alert_count: number;
  jahre: number[];
  generiert_am: string;
}

function buildMock(
  _locationId: string,
  driverId: string | undefined,
  jahre: number[],
): FahrerMehrjahresTrendResponse {
  const drivers = [
    { id: 'd1', name: 'Julia F.', pcts: [55.0, 60.2, 64.2] },
    { id: 'd2', name: 'Max M.',   pcts: [60.0, 63.5, 67.1] },
    { id: 'd3', name: 'Sara K.',  pcts: [58.0, 54.3, 52.7] },
    { id: 'd4', name: 'Tim B.',   pcts: [45.0, 41.2, 37.5] },
  ];

  const fahrer: FahrerMehrjahresTrend[] = drivers.map(d => {
    const [vvj, vj, akt] = d.pcts;
    const { trend, delta } = calcTrend(akt, vvj);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      jahre_pct: d.pcts,
      aktuell_pct: akt,
      vorjahr_pct: vj,
      vorvorjahr_pct: vvj,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(delta),
      alert_negativ: delta <= -2,
    };
  }).sort((a, b) => b.trend_delta - a.trend_delta);

  const teamAkt  = Math.round(fahrer.reduce((s, f) => s + f.aktuell_pct, 0)   / fahrer.length * 10) / 10;
  const teamVj   = Math.round(fahrer.reduce((s, f) => s + f.vorjahr_pct, 0)   / fahrer.length * 10) / 10;
  const teamVvj  = Math.round(fahrer.reduce((s, f) => s + f.vorvorjahr_pct, 0) / fahrer.length * 10) / 10;
  const alertCnt = fahrer.filter(f => f.alert_negativ).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer: [f], team_avg_pct: teamAkt, team_avg_pct_vorjahr: teamVj, team_avg_pct_vorvorjahr: teamVvj, alert_count: 0, jahre, generiert_am: new Date().toISOString() };
  }

  return { fahrer, team_avg_pct: teamAkt, team_avg_pct_vorjahr: teamVj, team_avg_pct_vorvorjahr: teamVvj, alert_count: alertCnt, jahre, generiert_am: new Date().toISOString() };
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

  const now         = new Date();
  const currYear    = now.getFullYear();
  const prevYear    = currYear - 1;
  const prevPrevYear = currYear - 2;
  const jahre       = [prevPrevYear, prevYear, currYear];

  const curr   = getJahresWindow(currYear);
  const prev   = getJahresWindow(prevYear);
  const prevPrev = getJahresWindow(prevPrevYear);

  try {
    const supabase = createServiceClient();

    const { data: drivers, error: dErr } = await supabase
      .from('drivers')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) {
      return NextResponse.json(buildMock(locationId, driverId, jahre));
    }

    const [{ data: thisStops }, { data: vjStops }, { data: vvjStops }] = await Promise.all([
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
      supabase
        .from('batch_stops')
        .select('driver_id, created_at, delivered_at')
        .eq('location_id', locationId)
        .in('status', ['completed', 'delivered'])
        .not('created_at', 'is', null)
        .gte('created_at', prevPrev.start.toISOString())
        .lt('created_at', prevPrev.end.toISOString()),
    ]);

    type Stop = { driver_id: string; created_at: string; delivered_at: string | null };
    const stopsAkt  = thisStops  as Stop[] | null;
    const stopsVj   = vjStops    as Stop[] | null;
    const stopsVvj  = vvjStops   as Stop[] | null;

    const JAHREMIN     = curr.tage * 24 * 60;
    const JAHREMIN_VJ  = prev.tage * 24 * 60;
    const JAHREMIN_VVJ = prevPrev.tage * 24 * 60;

    const fahrerList: FahrerMehrjahresTrend[] = drivers.map(d => {
      const aktMin = activeMinutesInWindow(stopsAkt, d.id, curr.start, curr.end);
      const vjMin  = activeMinutesInWindow(stopsVj,  d.id, prev.start, prev.end);
      const vvjMin = activeMinutesInWindow(stopsVvj, d.id, prevPrev.start, prevPrev.end);

      const aktPct = Math.min(100, Math.round(aktMin / JAHREMIN     * 1000) / 10);
      const vjPct  = Math.min(100, Math.round(vjMin  / JAHREMIN_VJ  * 1000) / 10);
      const vvjPct = Math.min(100, Math.round(vvjMin / JAHREMIN_VVJ * 1000) / 10);

      const { trend, delta } = calcTrend(aktPct, vvjPct);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        jahre_pct: [vvjPct, vjPct, aktPct],
        aktuell_pct: aktPct,
        vorjahr_pct: vjPct,
        vorvorjahr_pct: vvjPct,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(delta),
        alert_negativ: delta <= -2,
      };
    }).sort((a, b) => b.trend_delta - a.trend_delta);

    const teamAkt  = fahrerList.length ? Math.round(fahrerList.reduce((s, f) => s + f.aktuell_pct, 0)    / fahrerList.length * 10) / 10 : 0;
    const teamVj   = fahrerList.length ? Math.round(fahrerList.reduce((s, f) => s + f.vorjahr_pct, 0)    / fahrerList.length * 10) / 10 : 0;
    const teamVvj  = fahrerList.length ? Math.round(fahrerList.reduce((s, f) => s + f.vorvorjahr_pct, 0) / fahrerList.length * 10) / 10 : 0;
    const alertCnt = fahrerList.filter(f => f.alert_negativ).length;

    if (driverId) {
      const f = fahrerList.find(fd => fd.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer: f ? [f] : [], team_avg_pct: teamAkt, team_avg_pct_vorjahr: teamVj, team_avg_pct_vorvorjahr: teamVvj, alert_count: 0, jahre, generiert_am: new Date().toISOString() });
    }

    return NextResponse.json({ fahrer: fahrerList, team_avg_pct: teamAkt, team_avg_pct_vorjahr: teamVj, team_avg_pct_vorvorjahr: teamVvj, alert_count: alertCnt, jahre, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId, jahre));
  }
}
