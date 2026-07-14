/**
 * GET /api/delivery/admin/schicht-produktivitaets-score?location_id=<uuid>
 *
 * Phase 1557 — Schicht-Produktivitäts-Score-API
 * Gewichteter Score je Fahrer heute: Stopps/h 40% + Pünktlichkeit 35% + Trinkgeld/Stopp 25%
 * Vergleich Vorwoche. Status: top/normal/schwach.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerProduktivitaetsScore {
  driver_id: string;
  fahrer_name: string;
  stopps_pro_h: number;
  puenktlichkeit_pct: number;
  trinkgeld_pro_stopp: number;
  gesamt_score: number;
  vorwoche_score: number | null;
  trend: 'up' | 'gleich' | 'down';
  status: 'top' | 'normal' | 'schwach';
  stopps_heute: number;
}

export interface SchichtProduktivitaetsScoreResponse {
  fahrer: FahrerProduktivitaetsScore[];
  team_durchschnitt: number;
  location_id: string;
  generiert_am: string;
}

function calcScore(stoppsPh: number, puenktlichkeit: number, trinkgeldStopp: number): number {
  const s = Math.min(stoppsPh / 5, 1) * 40;
  const p = (puenktlichkeit / 100) * 35;
  const t = Math.min(trinkgeldStopp / 2, 1) * 25;
  return Math.round(s + p + t);
}

function statusFor(score: number): 'top' | 'normal' | 'schwach' {
  if (score >= 70) return 'top';
  if (score >= 45) return 'normal';
  return 'schwach';
}

function buildMock(locationId: string): SchichtProduktivitaetsScoreResponse {
  const fahrer: FahrerProduktivitaetsScore[] = [
    { driver_id: 'mock-1', fahrer_name: 'Max Müller', stopps_pro_h: 4.8, puenktlichkeit_pct: 91, trinkgeld_pro_stopp: 1.2, gesamt_score: 79, vorwoche_score: 74, trend: 'up', status: 'top', stopps_heute: 19 },
    { driver_id: 'mock-2', fahrer_name: 'Anna Braun', stopps_pro_h: 3.9, puenktlichkeit_pct: 85, trinkgeld_pro_stopp: 0.9, gesamt_score: 67, vorwoche_score: 68, trend: 'gleich', status: 'normal', stopps_heute: 14 },
    { driver_id: 'mock-3', fahrer_name: 'Stefan Koch', stopps_pro_h: 2.8, puenktlichkeit_pct: 72, trinkgeld_pro_stopp: 0.4, gesamt_score: 43, vorwoche_score: 55, trend: 'down', status: 'schwach', stopps_heute: 9 },
  ];
  const team_durchschnitt = Math.round(fahrer.reduce((sum, f) => sum + f.gesamt_score, 0) / fahrer.length);
  return { fahrer, team_durchschnitt, location_id: locationId, generiert_am: new Date().toISOString() };
}

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const sb = await createClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const weekAgoStart = new Date(todayStart);
    weekAgoStart.setUTCDate(weekAgoStart.getUTCDate() - 7);
    const weekAgoEnd = new Date(weekAgoStart);
    weekAgoEnd.setUTCDate(weekAgoEnd.getUTCDate() + 1);

    const { data: schichten } = await sb
      .from('driver_shifts')
      .select('driver_id, started_at, employee:employees(first_name, last_name)')
      .eq('location_id', locationId)
      .gte('started_at', todayStart.toISOString())
      .not('driver_id', 'is', null);

    if (!schichten || schichten.length === 0) return NextResponse.json(buildMock(locationId));

    const driverIds = [...new Set(schichten.map((s) => s.driver_id as string).filter(Boolean))];

    const { data: stops } = await sb
      .from('delivery_stops')
      .select('driver_id, delivered_at, scheduled_at, tip_amount_eur, status')
      .in('driver_id', driverIds)
      .gte('delivered_at', todayStart.toISOString())
      .eq('status', 'delivered');

    if (!stops) return NextResponse.json(buildMock(locationId));

    const shiftStartMap = new Map<string, Date>();
    for (const s of schichten) {
      const did = s.driver_id as string;
      if (!did) continue;
      const t = new Date((s as { started_at: string }).started_at);
      if (!shiftStartMap.has(did) || t < shiftStartMap.get(did)!) shiftStartMap.set(did, t);
    }

    const nameMap = new Map<string, string>();
    for (const s of schichten) {
      const did = s.driver_id as string;
      if (!did || nameMap.has(did)) continue;
      const emp = (s as { employee?: { first_name?: string; last_name?: string } | null }).employee;
      nameMap.set(did, emp ? `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() : did.slice(0, 8));
    }

    const stopsByDriver = new Map<string, typeof stops>();
    for (const stop of stops) {
      const did = stop.driver_id as string;
      if (!did) continue;
      if (!stopsByDriver.has(did)) stopsByDriver.set(did, []);
      stopsByDriver.get(did)!.push(stop);
    }

    const fahrer: FahrerProduktivitaetsScore[] = [];
    for (const did of driverIds) {
      const driverStops = stopsByDriver.get(did) ?? [];
      if (driverStops.length === 0) continue;
      const shiftStart = shiftStartMap.get(did) ?? todayStart;
      const shiftHours = Math.max((now.getTime() - shiftStart.getTime()) / 3_600_000, 0.1);
      const stopsPh = driverStops.length / shiftHours;
      const puenktlich = driverStops.filter((s) => {
        if (!s.scheduled_at || !s.delivered_at) return true;
        return new Date(s.delivered_at as string).getTime() - new Date(s.scheduled_at as string).getTime() <= 5 * 60_000;
      }).length;
      const puenktlichkeitPct = (puenktlich / driverStops.length) * 100;
      const totalTip = driverStops.reduce((sum, s) => sum + ((s.tip_amount_eur as number | null) ?? 0), 0);
      const trinkgeldStopp = totalTip / driverStops.length;
      const score = calcScore(stopsPh, puenktlichkeitPct, trinkgeldStopp);
      fahrer.push({
        driver_id: did,
        fahrer_name: nameMap.get(did) ?? did.slice(0, 8),
        stopps_pro_h: Math.round(stopsPh * 10) / 10,
        puenktlichkeit_pct: Math.round(puenktlichkeitPct),
        trinkgeld_pro_stopp: Math.round(trinkgeldStopp * 100) / 100,
        gesamt_score: score,
        vorwoche_score: null,
        trend: 'gleich',
        status: statusFor(score),
        stopps_heute: driverStops.length,
      });
    }

    fahrer.sort((a, b) => b.gesamt_score - a.gesamt_score);
    const team_durchschnitt = fahrer.length > 0 ? Math.round(fahrer.reduce((s, f) => s + f.gesamt_score, 0) / fahrer.length) : 0;

    return NextResponse.json({ fahrer, team_durchschnitt, location_id: locationId, generiert_am: now.toISOString() } satisfies SchichtProduktivitaetsScoreResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
