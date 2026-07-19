/**
 * GET /api/delivery/admin/fahrer-erreichbarkeit-score?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2534 — Fahrer-Erreichbarkeits-Score
 * Ø Reaktionszeit auf Aufträge in Sek je Fahrer heute;
 * Ampel grün(≤30s)/gelb(30–60s)/rot(>60s); Alert >60s; Trend vs. Vorwoche;
 * driver_id-Modus; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALERT_SEC = 60;
const GELB_SEC = 30;

export type TrendErreich = 'steigend' | 'fallend' | 'stabil';
export type AmpelErreich = 'gruen' | 'gelb' | 'rot';

export interface FahrerErreichbarkeitEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_reaktionszeit_sek: number;
  avg_reaktionszeit_vw: number | null;
  angebote_anzahl: number;
  trend: TrendErreich;
  trend_delta: number;
  ampel: AmpelErreich;
  alert: boolean;
}

export interface FahrerErreichbarkeitAntwort {
  location_id: string;
  fahrer: FahrerErreichbarkeitEntry[];
  fahrer_single?: FahrerErreichbarkeitEntry;
  team_avg_reaktionszeit_sek: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(sek: number): AmpelErreich {
  if (sek > ALERT_SEC) return 'rot';
  if (sek > GELB_SEC) return 'gelb';
  return 'gruen';
}

function trendVon(heute: number, vw: number | null): { trend: TrendErreich; delta: number } {
  if (vw === null || vw === 0) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - vw) * 10) / 10;
  if (delta > 2) return { trend: 'steigend', delta };
  if (delta < -2) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: FahrerErreichbarkeitEntry[] = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',     avg_reaktionszeit_sek: 22.4, avg_reaktionszeit_vw: 25.0, angebote_anzahl: 14, trend: 'fallend',  trend_delta: -2.6, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',    avg_reaktionszeit_sek: 78.3, avg_reaktionszeit_vw: 55.1, angebote_anzahl: 9,  trend: 'steigend', trend_delta: 23.2, ampel: 'rot',   alert: true  },
  { fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider', avg_reaktionszeit_sek: 44.7, avg_reaktionszeit_vw: 42.0, angebote_anzahl: 11, trend: 'stabil',   trend_delta:  2.7, ampel: 'gelb',  alert: false },
  { fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',     avg_reaktionszeit_sek: 18.2, avg_reaktionszeit_vw: 21.5, angebote_anzahl: 7,  trend: 'fallend',  trend_delta: -3.3, ampel: 'gruen', alert: false },
  { fahrer_id: 'mock-f5', fahrer_name: 'Anna Braun',     avg_reaktionszeit_sek: 95.0, avg_reaktionszeit_vw: 80.0, angebote_anzahl: 6,  trend: 'steigend', trend_delta: 15.0, ampel: 'rot',   alert: true  },
];

function buildMockResponse(location_id: string, driver_id?: string | null): FahrerErreichbarkeitAntwort {
  const fahrer = [...MOCK_FAHRER].sort((a, b) => b.avg_reaktionszeit_sek - a.avg_reaktionszeit_sek);
  const alertCount = fahrer.filter((f) => f.alert).length;
  const teamAvg = Math.round((fahrer.reduce((s, f) => s + f.avg_reaktionszeit_sek, 0) / fahrer.length) * 10) / 10;
  const single = driver_id ? fahrer.find((f) => f.fahrer_id === driver_id) ?? fahrer[0] : undefined;
  return { location_id, fahrer, fahrer_single: single, team_avg_reaktionszeit_sek: teamAvg, alert_count: alertCount, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  const driverId = req.nextUrl.searchParams.get('driver_id');

  try {
    const supabase = await createClient();

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekStr = lastWeek.toISOString().slice(0, 10);

    // Reaktionszeit = Zeit zwischen Auftragsangebot (created_at) und Annahme (accepted_at)
    const { data: assignments, error } = await supabase
      .from('delivery_assignments')
      .select('driver_id, driver_name, created_at, accepted_at')
      .eq('location_id', locationId)
      .not('accepted_at', 'is', null)
      .gte('created_at', todayStr)
      .lt('created_at', todayStr + 'T23:59:59');

    if (error || !assignments || assignments.length === 0) {
      return NextResponse.json(buildMockResponse(locationId, driverId));
    }

    const byDriver = new Map<string, { name: string; sekunden: number[] }>();
    for (const a of assignments) {
      if (!a.driver_id || !a.accepted_at) continue;
      const sek = (new Date(a.accepted_at).getTime() - new Date(a.created_at).getTime()) / 1000;
      if (sek < 0 || sek > 600) continue;
      const entry = byDriver.get(a.driver_id) ?? { name: a.driver_name ?? a.driver_id, sekunden: [] };
      entry.sekunden.push(sek);
      byDriver.set(a.driver_id, entry);
    }

    if (byDriver.size === 0) {
      return NextResponse.json(buildMockResponse(locationId, driverId));
    }

    const { data: assignmentsVW } = await supabase
      .from('delivery_assignments')
      .select('driver_id, created_at, accepted_at')
      .eq('location_id', locationId)
      .not('accepted_at', 'is', null)
      .gte('created_at', lastWeekStr)
      .lt('created_at', lastWeekStr + 'T23:59:59');

    const vwByDriver = new Map<string, number[]>();
    for (const a of assignmentsVW ?? []) {
      if (!a.driver_id || !a.accepted_at) continue;
      const sek = (new Date(a.accepted_at).getTime() - new Date(a.created_at).getTime()) / 1000;
      if (sek < 0 || sek > 600) continue;
      const arr = vwByDriver.get(a.driver_id) ?? [];
      arr.push(sek);
      vwByDriver.set(a.driver_id, arr);
    }

    const fahrer: FahrerErreichbarkeitEntry[] = [];
    for (const [dId, entry] of byDriver.entries()) {
      const avg = Math.round((entry.sekunden.reduce((a, b) => a + b, 0) / entry.sekunden.length) * 10) / 10;
      const vwList = vwByDriver.get(dId);
      const avgVW = vwList && vwList.length > 0
        ? Math.round((vwList.reduce((a, b) => a + b, 0) / vwList.length) * 10) / 10
        : null;
      const { trend, delta } = trendVon(avg, avgVW);
      const ampel = ampelVon(avg);
      fahrer.push({
        fahrer_id: dId,
        fahrer_name: entry.name,
        avg_reaktionszeit_sek: avg,
        avg_reaktionszeit_vw: avgVW,
        angebote_anzahl: entry.sekunden.length,
        trend,
        trend_delta: delta,
        ampel,
        alert: ampel === 'rot',
      });
    }

    fahrer.sort((a, b) => b.avg_reaktionszeit_sek - a.avg_reaktionszeit_sek);

    const alertCount = fahrer.filter((f) => f.alert).length;
    const teamAvg = fahrer.length > 0
      ? Math.round((fahrer.reduce((s, f) => s + f.avg_reaktionszeit_sek, 0) / fahrer.length) * 10) / 10
      : 0;
    const single = driverId ? fahrer.find((f) => f.fahrer_id === driverId) : undefined;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      fahrer_single: single,
      team_avg_reaktionszeit_sek: teamAvg,
      alert_count: alertCount,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerErreichbarkeitAntwort);
  } catch {
    return NextResponse.json(buildMockResponse(locationId, driverId));
  }
}
