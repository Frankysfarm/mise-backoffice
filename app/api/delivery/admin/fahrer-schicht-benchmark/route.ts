/**
 * GET /api/delivery/admin/fahrer-schicht-benchmark?location_id=<uuid>
 *
 * Phase 1893 — Fahrer-Schicht-Benchmark-API
 *
 * Vergleicht Schichtleistung aller Fahrer: Stopps + Verdienst + Pünktlichkeit
 * heute vs. 7-Tage-Schnitt. Spitzenreiter-Badge, Trend-Pfeil, Alert wenn
 * Fahrer >30% unter Team-Schnitt. Multi-Tenant. Supabase + Mock-Fallback.
 *
 * Response:
 * {
 *   location_id: string,
 *   fahrer: FahrerBenchmark[],
 *   team_schnitt: { stopps: number, verdienst_eur: number, puenktlichkeit_pct: number },
 *   generiert_am: ISO-string
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface FahrerBenchmark {
  fahrer_id: string;
  fahrer_name: string;
  stopps_heute: number;
  stopps_7d_schnitt: number;
  verdienst_eur_heute: number;
  verdienst_7d_schnitt: number;
  puenktlichkeit_pct: number;
  puenktlichkeit_7d_schnitt: number;
  trend_stopps: 'besser' | 'gleich' | 'schlechter';
  trend_verdienst: 'besser' | 'gleich' | 'schlechter';
  unter_schnitt_alert: boolean;
  spitzenreiter: boolean;
  ampel: 'gruen' | 'gelb' | 'rot';
  mock?: boolean;
}

const MOCK_FAHRER: FahrerBenchmark[] = [
  {
    fahrer_id: 'f1', fahrer_name: 'Max M.',
    stopps_heute: 14, stopps_7d_schnitt: 11.4,
    verdienst_eur_heute: 52.80, verdienst_7d_schnitt: 43.20,
    puenktlichkeit_pct: 94, puenktlichkeit_7d_schnitt: 88,
    trend_stopps: 'besser', trend_verdienst: 'besser',
    unter_schnitt_alert: false, spitzenreiter: true, ampel: 'gruen', mock: true,
  },
  {
    fahrer_id: 'f2', fahrer_name: 'Tom K.',
    stopps_heute: 9, stopps_7d_schnitt: 10.8,
    verdienst_eur_heute: 33.60, verdienst_7d_schnitt: 40.50,
    puenktlichkeit_pct: 72, puenktlichkeit_7d_schnitt: 85,
    trend_stopps: 'schlechter', trend_verdienst: 'schlechter',
    unter_schnitt_alert: true, spitzenreiter: false, ampel: 'rot', mock: true,
  },
  {
    fahrer_id: 'f3', fahrer_name: 'Lisa R.',
    stopps_heute: 12, stopps_7d_schnitt: 11.2,
    verdienst_eur_heute: 45.60, verdienst_7d_schnitt: 42.80,
    puenktlichkeit_pct: 88, puenktlichkeit_7d_schnitt: 87,
    trend_stopps: 'gleich', trend_verdienst: 'besser',
    unter_schnitt_alert: false, spitzenreiter: false, ampel: 'gruen', mock: true,
  },
  {
    fahrer_id: 'f4', fahrer_name: 'Jan S.',
    stopps_heute: 7, stopps_7d_schnitt: 10.0,
    verdienst_eur_heute: 26.40, verdienst_7d_schnitt: 38.00,
    puenktlichkeit_pct: 65, puenktlichkeit_7d_schnitt: 82,
    trend_stopps: 'schlechter', trend_verdienst: 'schlechter',
    unter_schnitt_alert: true, spitzenreiter: false, ampel: 'rot', mock: true,
  },
];

const MOCK_TEAM_SCHNITT = { stopps: 10.5, verdienst_eur: 39.60, puenktlichkeit_pct: 80 };

function trend(heute: number, schnitt: number): 'besser' | 'gleich' | 'schlechter' {
  const delta = schnitt > 0 ? (heute - schnitt) / schnitt : 0;
  if (delta > 0.05) return 'besser';
  if (delta < -0.05) return 'schlechter';
  return 'gleich';
}

function ampel(puenktlichkeit: number, unterSchnitt: boolean): 'gruen' | 'gelb' | 'rot' {
  if (unterSchnitt || puenktlichkeit < 70) return 'rot';
  if (puenktlichkeit < 85) return 'gelb';
  return 'gruen';
}

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return qp;
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

  const sb = await createClient();
  const now = new Date();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: todayOrders } = await sb
    .from('customer_orders')
    .select('driver_id, status, created_at, delivered_at, eta_minutes, total')
    .eq('location_id', locationId)
    .gte('created_at', todayStart.toISOString())
    .in('status', ['delivered', 'delivering', 'dispatched', 'abgeholt']);

  const { data: weekOrders } = await sb
    .from('customer_orders')
    .select('driver_id, status, created_at, delivered_at, eta_minutes, total')
    .eq('location_id', locationId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .lt('created_at', todayStart.toISOString())
    .eq('status', 'delivered');

  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, first_name, last_name')
    .eq('location_id', locationId);

  if (!todayOrders || todayOrders.length === 0 || !drivers || drivers.length === 0) {
    return NextResponse.json({
      location_id: locationId,
      fahrer: MOCK_FAHRER,
      team_schnitt: MOCK_TEAM_SCHNITT,
      generiert_am: now.toISOString(),
    });
  }

  const driverMap = new Map(
    (drivers ?? []).map((d) => [d.id, `${d.first_name ?? ''} ${(d.last_name ?? '').charAt(0)}.`.trim()]),
  );

  const driverIds = [...new Set([
    ...(todayOrders ?? []).map((o) => o.driver_id).filter(Boolean),
    ...(weekOrders ?? []).map((o) => o.driver_id).filter(Boolean),
  ])];

  const avgStopps7d = driverIds.length > 0
    ? (weekOrders ?? []).length / 7 / driverIds.length
    : 0;

  let maxStopps = 0;
  const fahrerList: FahrerBenchmark[] = driverIds.map((driverId) => {
    const today = (todayOrders ?? []).filter((o) => o.driver_id === driverId);
    const week = (weekOrders ?? []).filter((o) => o.driver_id === driverId);

    const stoppsHeute = today.length;
    const stopps7d = week.length > 0 ? week.length / 7 : avgStopps7d;

    const verdienstHeute = today.reduce((s, o) => s + ((o.total ?? 0) / 100) * 0.1, 0);
    const verdienst7d = week.length > 0
      ? week.reduce((s, o) => s + ((o.total ?? 0) / 100) * 0.1, 0) / 7
      : 0;

    const delivered = today.filter((o) => o.status === 'delivered');
    const puenktlich = delivered.filter((o) => {
      if (!o.eta_minutes || !o.created_at || !o.delivered_at) return true;
      const expected = new Date(o.created_at).getTime() + o.eta_minutes * 60_000;
      return new Date(o.delivered_at).getTime() <= expected + 5 * 60_000;
    });
    const puenktlichkeitPct = delivered.length > 0
      ? Math.round((puenktlich.length / delivered.length) * 100)
      : 85;

    const weekDelivered = week.filter((o) => o.status === 'delivered');
    const weekPuenktlich = weekDelivered.filter((o) => {
      if (!o.eta_minutes || !o.created_at || !o.delivered_at) return true;
      const expected = new Date(o.created_at).getTime() + o.eta_minutes * 60_000;
      return new Date(o.delivered_at).getTime() <= expected + 5 * 60_000;
    });
    const puenktlichkeit7d = weekDelivered.length > 0
      ? Math.round((weekPuenktlich.length / weekDelivered.length) * 100)
      : 85;

    if (stoppsHeute > maxStopps) maxStopps = stoppsHeute;

    const trendStopps = trend(stoppsHeute, stopps7d);
    const trendVerdienst = trend(verdienstHeute, verdienst7d);

    const teamAvgStopps = driverIds.length > 0
      ? (todayOrders ?? []).length / driverIds.length
      : 1;
    const unterSchnitt = teamAvgStopps > 0 && stoppsHeute < teamAvgStopps * 0.7;

    return {
      fahrer_id: driverId,
      fahrer_name: driverMap.get(driverId) ?? `Fahrer ${driverId.slice(0, 4)}`,
      stopps_heute: stoppsHeute,
      stopps_7d_schnitt: Math.round(stopps7d * 10) / 10,
      verdienst_eur_heute: Math.round(verdienstHeute * 100) / 100,
      verdienst_7d_schnitt: Math.round(verdienst7d * 100) / 100,
      puenktlichkeit_pct: puenktlichkeitPct,
      puenktlichkeit_7d_schnitt: puenktlichkeit7d,
      trend_stopps: trendStopps,
      trend_verdienst: trendVerdienst,
      unter_schnitt_alert: unterSchnitt,
      spitzenreiter: false,
      ampel: ampel(puenktlichkeitPct, unterSchnitt),
      mock: false,
    };
  });

  if (fahrerList.length > 0) {
    const spitze = fahrerList.reduce((best, f) =>
      f.stopps_heute > best.stopps_heute ? f : best, fahrerList[0]);
    spitze.spitzenreiter = true;
  }

  const teamSchnitt = {
    stopps: fahrerList.length > 0
      ? Math.round((fahrerList.reduce((s, f) => s + f.stopps_heute, 0) / fahrerList.length) * 10) / 10
      : 0,
    verdienst_eur: fahrerList.length > 0
      ? Math.round((fahrerList.reduce((s, f) => s + f.verdienst_eur_heute, 0) / fahrerList.length) * 100) / 100
      : 0,
    puenktlichkeit_pct: fahrerList.length > 0
      ? Math.round(fahrerList.reduce((s, f) => s + f.puenktlichkeit_pct, 0) / fahrerList.length)
      : 0,
  };

  return NextResponse.json({
    location_id: locationId,
    fahrer: fahrerList.sort((a, b) => b.stopps_heute - a.stopps_heute),
    team_schnitt: teamSchnitt,
    generiert_am: now.toISOString(),
  });
}
