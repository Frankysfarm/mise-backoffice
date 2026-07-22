import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

const WOCHEN_MINUTEN = 7 * 24 * 60; // 10080 Min (7 Tage)
const TAGES_MINUTEN  = 24 * 60;     // 1440 Min

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

export interface FahrerWochenauslastung {
  fahrer_id: string;
  fahrer_name: string;
  auslastung_pct: number;
  auslastung_pct_vorwoche: number;
  tage_pct: number[];
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_gering: boolean;
}

export interface FahrerWochenauslastungResponse {
  fahrer: FahrerWochenauslastung[];
  team_avg_pct: number;
  team_avg_pct_vorwoche: number;
  alert_count: number;
  generiert_am: string;
}

function getMonday(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const day = d.getDay(); // 0=So, 1=Mo, ..., 6=Sa
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function buildMock(_locationId: string, driverId?: string): FahrerWochenauslastungResponse {
  const drivers = [
    { id: 'd1', name: 'Max M.',   pct: 78.2, tage: [80, 75, 82, 79, 76, 78, 77] },
    { id: 'd2', name: 'Sara K.',  pct: 65.4, tage: [70, 68, 66, 64, 62, 65, 63] },
    { id: 'd3', name: 'Tim B.',   pct: 45.7, tage: [50, 48, 46, 44, 43, 47, 46] },
    { id: 'd4', name: 'Julia F.', pct: 88.3, tage: [90, 87, 89, 88, 86, 90, 88] },
  ];

  const fahrer: FahrerWochenauslastung[] = drivers.map(d => {
    const pct_vw = Math.max(0, Math.min(100, d.pct + (d.pct > 70 ? -3 : 3)));
    const { trend, delta } = calcTrend(d.pct, pct_vw);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      auslastung_pct: d.pct,
      auslastung_pct_vorwoche: Math.round(pct_vw * 10) / 10,
      tage_pct: d.tage,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(d.pct),
      alert_gering: d.pct < 50,
    };
  }).sort((a, b) => b.auslastung_pct - a.auslastung_pct);

  const team_avg    = Math.round((fahrer.reduce((s, f) => s + f.auslastung_pct, 0)          / fahrer.length) * 10) / 10;
  const team_avg_vw = Math.round((fahrer.reduce((s, f) => s + f.auslastung_pct_vorwoche, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_gering).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer: [f], team_avg_pct: team_avg, team_avg_pct_vorwoche: team_avg_vw, alert_count: 0, generiert_am: new Date().toISOString() };
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

    const now    = new Date();
    const monday = getMonday(now);
    const weekStart = new Date(monday); weekStart.setHours(0, 0, 0, 0);
    const weekEnd   = new Date(monday); weekEnd.setDate(weekEnd.getDate() + 7);

    const mondayVw    = new Date(monday); mondayVw.setDate(mondayVw.getDate() - 7);
    const weekStartVw = new Date(mondayVw); weekStartVw.setHours(0, 0, 0, 0);
    const weekEndVw   = new Date(mondayVw); weekEndVw.setDate(weekEndVw.getDate() + 7);

    const [{ data: thisStops }, { data: vwStops }] = await Promise.all([
      supabase
        .from('batch_stops')
        .select('driver_id, created_at, delivered_at')
        .eq('location_id', locationId)
        .in('status', ['completed', 'delivered', 'active', 'in_transit'])
        .not('created_at', 'is', null)
        .gte('created_at', weekStart.toISOString())
        .lt('created_at', weekEnd.toISOString()),
      supabase
        .from('batch_stops')
        .select('driver_id, created_at, delivered_at')
        .eq('location_id', locationId)
        .in('status', ['completed', 'delivered'])
        .not('created_at', 'is', null)
        .gte('created_at', weekStartVw.toISOString())
        .lt('created_at', weekEndVw.toISOString()),
    ]);

    const stopsTyped   = thisStops as { driver_id: string; created_at: string; delivered_at: string | null }[] | null;
    const stopsVwTyped = vwStops   as { driver_id: string; created_at: string; delivered_at: string | null }[] | null;

    const fahrerList: FahrerWochenauslastung[] = drivers.map(d => {
      let totalMin = 0;
      const tage_pct: number[] = [];

      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(weekStart); dayStart.setDate(dayStart.getDate() + i);
        const dayEnd   = new Date(dayStart);  dayEnd.setDate(dayEnd.getDate() + 1);
        const dayMin   = activeMinutesInWindow(stopsTyped, d.id, dayStart, dayEnd);
        totalMin += dayMin;
        tage_pct.push(Math.min(100, Math.round((dayMin / TAGES_MINUTEN) * 1000) / 10));
      }

      let totalMinVw = 0;
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(weekStartVw); dayStart.setDate(dayStart.getDate() + i);
        const dayEnd   = new Date(dayStart);    dayEnd.setDate(dayEnd.getDate() + 1);
        totalMinVw += activeMinutesInWindow(stopsVwTyped, d.id, dayStart, dayEnd);
      }

      const pct   = Math.min(100, Math.round((totalMin   / WOCHEN_MINUTEN) * 1000) / 10);
      const pctVw = Math.min(100, Math.round((totalMinVw / WOCHEN_MINUTEN) * 1000) / 10);

      const { trend, delta } = calcTrend(pct, pctVw);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        auslastung_pct: pct,
        auslastung_pct_vorwoche: pctVw,
        tage_pct,
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
      const f = fahrerList.find(fd => fd.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer: f ? [f] : [], team_avg_pct: team_avg, team_avg_pct_vorwoche: team_avg_vw, alert_count: 0, generiert_am: new Date().toISOString() });
    }

    return NextResponse.json({ fahrer: fahrerList, team_avg_pct: team_avg, team_avg_pct_vorwoche: team_avg_vw, alert_count, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
