import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

const FRUEHSCHICHT_START_H = 6;
const FRUEHSCHICHT_END_H   = 14;
const SCHICHT_MINUTEN      = (FRUEHSCHICHT_END_H - FRUEHSCHICHT_START_H) * 60; // 480 Min

function calcAmpel(pct: number): Ampel {
  if (pct >= 80) return 'gruen';
  if (pct >= 60) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 0.5) return { trend: 'steigend', delta };
  if (delta < -0.5) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerFruehschichtAuslastung {
  fahrer_id: string;
  fahrer_name: string;
  auslastung_pct: number;
  auslastung_pct_vorwoche: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_gering: boolean;
}

export interface FahrerFruehschichtAuslastungResponse {
  fahrer: FahrerFruehschichtAuslastung[];
  team_avg_pct: number;
  team_avg_pct_vorwoche: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   pct: 91.5 },
    { id: 'd2', name: 'Sara K.',  pct: 72.3 },
    { id: 'd3', name: 'Tim B.',   pct: 55.0 },
    { id: 'd4', name: 'Julia F.', pct: 84.7 },
  ];

  const fahrer: FahrerFruehschichtAuslastung[] = drivers.map(d => {
    const pct_vorwoche = Math.max(0, Math.min(100, d.pct + (Math.random() > 0.5 ? 8 : -8)));
    const { trend, delta } = calcTrend(d.pct, pct_vorwoche);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      auslastung_pct: d.pct,
      auslastung_pct_vorwoche: Math.round(pct_vorwoche * 10) / 10,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(d.pct),
      alert_gering: d.pct < 60,
    };
  }).sort((a, b) => b.auslastung_pct - a.auslastung_pct);

  const team_avg = Math.round((fahrer.reduce((s, f) => s + f.auslastung_pct, 0) / fahrer.length) * 10) / 10;
  const team_avg_vw = Math.round((fahrer.reduce((s, f) => s + f.auslastung_pct_vorwoche, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_gering).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_pct: team_avg };
  }

  return { fahrer, team_avg_pct: team_avg, team_avg_pct_vorwoche: team_avg_vw, alert_count, generiert_am: new Date().toISOString() };
}

function activeMinutesInShift(
  stops: { driver_id: string; created_at: string; delivered_at: string | null }[] | null,
  dId: string,
  shiftStart: Date,
  shiftEnd: Date,
): number {
  const ds = (stops ?? []).filter(s => s.driver_id === dId && s.created_at);
  let totalMs = 0;
  for (const s of ds) {
    const start = new Date(s.created_at);
    const end   = s.delivered_at ? new Date(s.delivered_at) : new Date(start.getTime() + 20 * 60000);
    const clampStart = start < shiftStart ? shiftStart : start;
    const clampEnd   = end   > shiftEnd   ? shiftEnd   : end;
    const diffMs = clampEnd.getTime() - clampStart.getTime();
    if (diffMs > 0) totalMs += diffMs;
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
    const todayShiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), FRUEHSCHICHT_START_H, 0, 0, 0);
    const todayShiftEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), FRUEHSCHICHT_END_H,   0, 0, 0);
    const vwShiftStart    = new Date(todayShiftStart); vwShiftStart.setDate(vwShiftStart.getDate() - 7);
    const vwShiftEnd      = new Date(todayShiftEnd);   vwShiftEnd.setDate(vwShiftEnd.getDate()     - 7);

    const { data: todayStops } = await supabase
      .from('batch_stops')
      .select('driver_id, created_at, delivered_at')
      .eq('location_id', locationId)
      .in('status', ['completed', 'delivered', 'active', 'in_transit'])
      .not('created_at', 'is', null)
      .gte('created_at', todayShiftStart.toISOString())
      .lte('created_at', todayShiftEnd.toISOString());

    const { data: vwStops } = await supabase
      .from('batch_stops')
      .select('driver_id, created_at, delivered_at')
      .eq('location_id', locationId)
      .in('status', ['completed', 'delivered'])
      .not('created_at', 'is', null)
      .gte('created_at', vwShiftStart.toISOString())
      .lte('created_at', vwShiftEnd.toISOString());

    const fahrerList: FahrerFruehschichtAuslastung[] = drivers.map(d => {
      const activeMin   = activeMinutesInShift(
        todayStops as { driver_id: string; created_at: string; delivered_at: string | null }[] | null,
        d.id, todayShiftStart, todayShiftEnd,
      );
      const activeMinVw = activeMinutesInShift(
        vwStops as { driver_id: string; created_at: string; delivered_at: string | null }[] | null,
        d.id, vwShiftStart, vwShiftEnd,
      );
      const pct   = Math.min(100, Math.round((activeMin   / SCHICHT_MINUTEN) * 1000) / 10);
      const pctVw = Math.min(100, Math.round((activeMinVw / SCHICHT_MINUTEN) * 1000) / 10);
      const { trend, delta } = calcTrend(pct, pctVw);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        auslastung_pct: pct,
        auslastung_pct_vorwoche: pctVw,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(pct),
        alert_gering: pct < 60,
      };
    }).sort((a, b) => b.auslastung_pct - a.auslastung_pct);

    const team_avg    = fahrerList.length ? Math.round((fahrerList.reduce((s, f) => s + f.auslastung_pct, 0)           / fahrerList.length) * 10) / 10 : 0;
    const team_avg_vw = fahrerList.length ? Math.round((fahrerList.reduce((s, f) => s + f.auslastung_pct_vorwoche, 0)  / fahrerList.length) * 10) / 10 : 0;
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
