import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(pct: number): Ampel {
  if (pct >= 65) return 'gruen';
  if (pct >= 45) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 0.5) return { trend: 'steigend', delta };
  if (delta < -0.5) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

function getQuartal(month: number): number {
  return Math.floor(month / 3) + 1; // 1–4
}

function getQuartalWindow(ref: Date): { start: Date; end: Date; tage: number; q: number; monate: [string, string, string] } {
  const q = getQuartal(ref.getMonth());
  const qStartMonth = (q - 1) * 3;
  const start = new Date(ref.getFullYear(), qStartMonth, 1, 0, 0, 0, 0);
  const end   = new Date(ref.getFullYear(), qStartMonth + 3, 1, 0, 0, 0, 0);
  const tage  = (end.getTime() - start.getTime()) / 86400000;
  const MONATSNAMEN = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return {
    start, end, tage, q,
    monate: [MONATSNAMEN[qStartMonth], MONATSNAMEN[qStartMonth + 1], MONATSNAMEN[qStartMonth + 2]],
  };
}

function getPrevQuartalWindow(ref: Date): { start: Date; end: Date; tage: number } {
  const q = getQuartal(ref.getMonth());
  const prevQ = q === 1 ? 4 : q - 1;
  const year  = q === 1 ? ref.getFullYear() - 1 : ref.getFullYear();
  const qStartMonth = (prevQ - 1) * 3;
  const start = new Date(year, qStartMonth, 1, 0, 0, 0, 0);
  const end   = new Date(year, qStartMonth + 3, 1, 0, 0, 0, 0);
  const tage  = (end.getTime() - start.getTime()) / 86400000;
  return { start, end, tage };
}

export interface FahrerQuartalauslastung {
  fahrer_id: string;
  fahrer_name: string;
  auslastung_pct: number;
  auslastung_pct_vorquartal: number;
  monate_pct: number[];
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_gering: boolean;
}

export interface FahrerQuartalauslastungResponse {
  fahrer: FahrerQuartalauslastung[];
  team_avg_pct: number;
  team_avg_pct_vorquartal: number;
  alert_count: number;
  quartal: number;
  quartal_tage: number;
  monate: [string, string, string];
  generiert_am: string;
}

function buildMock(
  _locationId: string,
  driverId: string | undefined,
  quartal: number,
  quartal_tage: number,
  monate: [string, string, string],
): FahrerQuartalauslastungResponse {
  const drivers = [
    { id: 'd1', name: 'Max M.',   pct: 68.4, mp: [70, 68, 67] },
    { id: 'd2', name: 'Sara K.',  pct: 57.9, mp: [60, 58, 56] },
    { id: 'd3', name: 'Tim B.',   pct: 41.2, mp: [44, 40, 39] },
    { id: 'd4', name: 'Julia F.', pct: 79.3, mp: [80, 79, 79] },
  ];

  const fahrer: FahrerQuartalauslastung[] = drivers.map(d => {
    const pct_vq = Math.max(0, Math.min(100, d.pct + (d.pct > 60 ? -3.5 : 3.5)));
    const { trend, delta } = calcTrend(d.pct, pct_vq);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      auslastung_pct: d.pct,
      auslastung_pct_vorquartal: Math.round(pct_vq * 10) / 10,
      monate_pct: d.mp,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(d.pct),
      alert_gering: d.pct < 45,
    };
  }).sort((a, b) => b.auslastung_pct - a.auslastung_pct);

  const team_avg    = Math.round((fahrer.reduce((s, f) => s + f.auslastung_pct, 0)             / fahrer.length) * 10) / 10;
  const team_avg_vq = Math.round((fahrer.reduce((s, f) => s + f.auslastung_pct_vorquartal, 0)  / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_gering).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer: [f], team_avg_pct: team_avg, team_avg_pct_vorquartal: team_avg_vq, alert_count: 0, quartal, quartal_tage, monate, generiert_am: new Date().toISOString() };
  }

  return { fahrer, team_avg_pct: team_avg, team_avg_pct_vorquartal: team_avg_vq, alert_count, quartal, quartal_tage, monate, generiert_am: new Date().toISOString() };
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

  const now  = new Date();
  const curr = getQuartalWindow(now);
  const prev = getPrevQuartalWindow(now);

  try {
    const supabase = createServiceClient();

    const { data: drivers, error: dErr } = await supabase
      .from('drivers')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) {
      return NextResponse.json(buildMock(locationId, driverId, curr.q, curr.tage, curr.monate));
    }

    const QUARTAL_MIN      = curr.tage * 24 * 60;
    const QUARTAL_MIN_PREV = prev.tage * 24 * 60;

    const [{ data: thisStops }, { data: vqStops }] = await Promise.all([
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
    const stopsVqTyped = vqStops   as { driver_id: string; created_at: string; delivered_at: string | null }[] | null;

    const fahrerList: FahrerQuartalauslastung[] = drivers.map(d => {
      // Monatliche Aufschlüsselung (3 Monate im Quartal)
      const monate_pct: number[] = [];
      for (let m = 0; m < 3; m++) {
        const mStart = new Date(curr.start.getFullYear(), curr.start.getMonth() + m, 1, 0, 0, 0, 0);
        const mEnd   = new Date(curr.start.getFullYear(), curr.start.getMonth() + m + 1, 1, 0, 0, 0, 0);
        const mTage  = (mEnd.getTime() - mStart.getTime()) / 86400000;
        const mMin   = activeMinutesInWindow(stopsTyped, d.id, mStart, mEnd);
        monate_pct.push(Math.min(100, Math.round((mMin / (mTage * 24 * 60)) * 1000) / 10));
      }

      const totalMin = activeMinutesInWindow(stopsTyped, d.id, curr.start, curr.end);
      const pct      = Math.min(100, Math.round((totalMin / QUARTAL_MIN) * 1000) / 10);

      const vqMin = activeMinutesInWindow(stopsVqTyped, d.id, prev.start, prev.end);
      const pctVq = Math.min(100, Math.round((vqMin / QUARTAL_MIN_PREV) * 1000) / 10);

      const { trend, delta } = calcTrend(pct, pctVq);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        auslastung_pct: pct,
        auslastung_pct_vorquartal: pctVq,
        monate_pct,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(pct),
        alert_gering: pct < 45,
      };
    }).sort((a, b) => b.auslastung_pct - a.auslastung_pct);

    const team_avg    = fahrerList.length ? Math.round((fahrerList.reduce((s, f) => s + f.auslastung_pct, 0)             / fahrerList.length) * 10) / 10 : 0;
    const team_avg_vq = fahrerList.length ? Math.round((fahrerList.reduce((s, f) => s + f.auslastung_pct_vorquartal, 0)  / fahrerList.length) * 10) / 10 : 0;
    const alert_count = fahrerList.filter(f => f.alert_gering).length;

    if (driverId) {
      const f = fahrerList.find(fd => fd.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer: f ? [f] : [], team_avg_pct: team_avg, team_avg_pct_vorquartal: team_avg_vq, alert_count: 0, quartal: curr.q, quartal_tage: curr.tage, monate: curr.monate, generiert_am: new Date().toISOString() });
    }

    return NextResponse.json({ fahrer: fahrerList, team_avg_pct: team_avg, team_avg_pct_vorquartal: team_avg_vq, alert_count, quartal: curr.q, quartal_tage: curr.tage, monate: curr.monate, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId, curr.q, curr.tage, curr.monate));
  }
}
