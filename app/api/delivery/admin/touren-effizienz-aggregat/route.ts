/**
 * GET /api/delivery/admin/touren-effizienz-aggregat
 *   ?location_id=<uuid>
 *
 * Tages-Aggregation aller abgeschlossenen Touren:
 * - Ø km/Lieferung
 * - Ø Min/Stopp
 * - Ø Score 0–100
 * - Gesamtumsatz
 *
 * Phase 578
 *
 * Response: { ok, aggregat: TourenEffizienzAggregat, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TourenEffizienzAggregat {
  toursCompleted: number;
  totalStops: number;
  totalRevenueEur: number;
  avgKmPerDelivery: number | null;
  avgMinPerStop: number | null;
  avgScore: number | null;
  onTimePct: number | null;
  avgBundleSize: number | null;
  warningLevel: 'ok' | 'niedrig' | 'kritisch';
  topDriverId: string | null;
  topDriverName: string | null;
}

export interface TourenEffizienzAggregateResponse {
  ok: boolean;
  aggregat: TourenEffizienzAggregat;
  generatedAt: string;
}

type SnapshotRow = {
  actual_stops: number;
  total_route_km: number | null;
  actual_delivery_min: number | null;
  bundle_efficiency_score: number | null;
  on_time_stops: number;
  late_stops: number;
  bundle_size: number;
  driver_id: string | null;
};

type OrderRow = { gesamtbetrag: number | null };

type DriverRow = { id: string; vorname: string; nachname: string };

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const param = new URL(req.url).searchParams.get('location_id');
  if (param) return param;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp as { location_id: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const locationId = await resolveLocationId(req);
    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

    const svc = createServiceClient();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dayStart = `${todayStr}T00:00:00.000Z`;
    const dayEnd   = `${todayStr}T23:59:59.999Z`;

    const [{ data: rawSnapshots }, { data: rawOrders }, { data: rawDrivers }] = await Promise.all([
      svc.from('tour_performance_snapshots')
        .select('actual_stops, total_route_km, actual_delivery_min, bundle_efficiency_score, on_time_stops, late_stops, bundle_size, driver_id')
        .eq('location_id', locationId)
        .gte('completed_at', dayStart)
        .lt('completed_at', dayEnd),

      svc.from('customer_orders')
        .select('gesamtbetrag')
        .eq('location_id', locationId)
        .neq('status', 'storniert')
        .gte('created_at', dayStart)
        .lt('created_at', dayEnd),

      svc.from('drivers')
        .select('id, vorname, nachname')
        .eq('location_id', locationId),
    ]);

    const snapshots = (rawSnapshots ?? []) as SnapshotRow[];
    const orders    = (rawOrders   ?? []) as OrderRow[];
    const drivers   = (rawDrivers  ?? []) as DriverRow[];

    const driverMap = new Map<string, DriverRow>(drivers.map(d => [d.id, d]));

    const toursCompleted = snapshots.length;
    const totalStops = snapshots.reduce((a, s) => a + s.actual_stops, 0);
    const totalRevenueEur = orders.reduce((a, o) => a + Math.max(0, Number(o.gesamtbetrag ?? 0)), 0);

    const withKm = snapshots.filter(s => s.total_route_km !== null && s.actual_stops > 0);
    const avgKmPerDelivery = withKm.length > 0
      ? withKm.reduce((a, s) => a + (s.total_route_km! / s.actual_stops), 0) / withKm.length
      : null;

    const withMin = snapshots.filter(s => s.actual_delivery_min !== null && s.actual_stops > 0);
    const avgMinPerStop = withMin.length > 0
      ? withMin.reduce((a, s) => a + (s.actual_delivery_min! / s.actual_stops), 0) / withMin.length
      : null;

    const withScore = snapshots.filter(s => s.bundle_efficiency_score !== null);
    const avgScore = withScore.length > 0
      ? withScore.reduce((a, s) => a + s.bundle_efficiency_score!, 0) / withScore.length
      : null;

    const totalOnTime = snapshots.reduce((a, s) => a + s.on_time_stops, 0);
    const totalLate   = snapshots.reduce((a, s) => a + s.late_stops, 0);
    const onTimePct   = (totalOnTime + totalLate) > 0
      ? (totalOnTime / (totalOnTime + totalLate)) * 100
      : null;

    const avgBundleSize = toursCompleted > 0
      ? snapshots.reduce((a, s) => a + s.bundle_size, 0) / toursCompleted
      : null;

    // Top driver by stops completed
    const driverStopsMap = new Map<string, number>();
    for (const s of snapshots) {
      if (s.driver_id) {
        driverStopsMap.set(s.driver_id, (driverStopsMap.get(s.driver_id) ?? 0) + s.actual_stops);
      }
    }
    let topDriverId: string | null = null;
    let topDriverStops = 0;
    for (const [dId, stops] of driverStopsMap) {
      if (stops > topDriverStops) { topDriverStops = stops; topDriverId = dId; }
    }
    const topDriverName = topDriverId
      ? (() => { const d = driverMap.get(topDriverId!); return d ? `${d.vorname} ${d.nachname}` : null; })()
      : null;

    const warningLevel: TourenEffizienzAggregat['warningLevel'] =
      avgScore !== null && avgScore < 40 ? 'kritisch' :
      avgScore !== null && avgScore < 65 ? 'niedrig'  : 'ok';

    const aggregat: TourenEffizienzAggregat = {
      toursCompleted,
      totalStops,
      totalRevenueEur: Math.round(totalRevenueEur * 100) / 100,
      avgKmPerDelivery: avgKmPerDelivery !== null ? Math.round(avgKmPerDelivery * 100) / 100 : null,
      avgMinPerStop:    avgMinPerStop    !== null ? Math.round(avgMinPerStop    * 10)  / 10  : null,
      avgScore:         avgScore         !== null ? Math.round(avgScore)                     : null,
      onTimePct:        onTimePct        !== null ? Math.round(onTimePct * 10) / 10          : null,
      avgBundleSize:    avgBundleSize    !== null ? Math.round(avgBundleSize * 10) / 10      : null,
      warningLevel,
      topDriverId,
      topDriverName,
    };

    const response: TourenEffizienzAggregateResponse = {
      ok: true,
      aggregat,
      generatedAt: now.toISOString(),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[touren-effizienz-aggregat]', err);
    return NextResponse.json({ ok: false, error: 'Interner Fehler' }, { status: 500 });
  }
}
