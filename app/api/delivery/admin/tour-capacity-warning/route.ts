/**
 * GET /api/delivery/admin/tour-capacity-warning?location_id=...
 *
 * Tour-Kapazitäts-Warnsignal: Alert wenn aktive Touren den Schwellwert überschreiten
 * oder die durchschnittliche Stopp-Last pro Tour zu hoch ist.
 *
 * Schwellwerte aus delivery_config:
 *   max_concurrent_tours  (Default: 8)
 *   max_stops_per_tour    (Default: 6)
 *
 * Alert-Level:
 *   ok       — Alle Werte im grünen Bereich
 *   warning  — Touren ≥ 75% des Schwellwerts ODER Ø Stops nahe Maximum
 *   critical — Touren > Schwellwert ODER Ø Stops > Maximum
 *
 * Response:
 *   { ok, alertLevel, activeTours, tourThreshold, avgStopsPerTour, stopsThreshold,
 *     totalPendingStops, warnings, tours }
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_TOUR_THRESHOLD = 8;
const DEFAULT_STOPS_THRESHOLD = 6;

type AlertLevel = 'ok' | 'warning' | 'critical';

export interface TourCapacityWarningResponse {
  ok: boolean;
  alertLevel: AlertLevel;
  activeTours: number;
  tourThreshold: number;
  tourPct: number;
  avgStopsPerTour: number;
  stopsThreshold: number;
  totalPendingStops: number;
  warnings: string[];
  tours: Array<{
    id: string;
    zone: string | null;
    driverName: string | null;
    state: string;
    stopCount: number;
    pendingStops: number;
    createdMinAgo: number;
  }>;
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();

  // Load thresholds from delivery_config
  const { data: configs } = await ssb
    .from('delivery_config')
    .select('key, value')
    .eq('location_id', locationId)
    .in('key', ['max_concurrent_tours', 'max_stops_per_tour']);

  const configMap = new Map((configs ?? []).map((c) => [c.key as string, Number(c.value)]));
  const tourThreshold = configMap.get('max_concurrent_tours') ?? DEFAULT_TOUR_THRESHOLD;
  const stopsThreshold = configMap.get('max_stops_per_tour') ?? DEFAULT_STOPS_THRESHOLD;

  // Active tours = batches in non-terminal states
  const ACTIVE_STATES = ['pending', 'assigned', 'active', 'in_transit', 'picking_up'];

  const { data: batchData } = await ssb
    .from('mise_delivery_batches')
    .select(`
      id,
      zone,
      state,
      stop_count,
      created_at,
      driver:mise_drivers!assigned_driver_id(name)
    `)
    .eq('location_id', locationId)
    .in('state', ACTIVE_STATES)
    .order('created_at', { ascending: true })
    .limit(50);

  const batches = (batchData ?? []) as Array<{
    id: string;
    zone: string | null;
    state: string;
    stop_count: number | null;
    created_at: string;
    driver: { name: string } | null;
  }>;

  const nowMs = Date.now();

  // Get pending stop counts per batch
  const batchIds = batches.map((b) => b.id);
  let pendingStopMap = new Map<string, number>();

  if (batchIds.length > 0) {
    const { data: stops } = await ssb
      .from('mise_delivery_batch_stops')
      .select('batch_id, status')
      .in('batch_id', batchIds)
      .in('status', ['pending', 'en_route', 'arrived']);

    for (const stop of stops ?? []) {
      const s = stop as { batch_id: string; status: string };
      pendingStopMap.set(s.batch_id, (pendingStopMap.get(s.batch_id) ?? 0) + 1);
    }
  }

  const tours = batches.map((b) => {
    const driverRaw = b.driver as { name?: string } | null;
    return {
      id: b.id,
      zone: b.zone ?? null,
      driverName: driverRaw?.name ?? null,
      state: b.state,
      stopCount: b.stop_count ?? 0,
      pendingStops: pendingStopMap.get(b.id) ?? 0,
      createdMinAgo: Math.floor((nowMs - new Date(b.created_at).getTime()) / 60_000),
    };
  });

  const activeTours = tours.length;
  const tourPct = Math.round((activeTours / tourThreshold) * 100);
  const totalPendingStops = tours.reduce((s, t) => s + t.pendingStops, 0);
  const avgStopsPerTour = activeTours > 0
    ? Math.round((totalPendingStops / activeTours) * 10) / 10
    : 0;

  const warnings: string[] = [];

  if (activeTours > tourThreshold) {
    warnings.push(`${activeTours} aktive Touren überschreiten Limit von ${tourThreshold}`);
  } else if (activeTours >= Math.ceil(tourThreshold * 0.75)) {
    warnings.push(`${activeTours}/${tourThreshold} Touren — Kapazitätsgrenze naht`);
  }

  if (avgStopsPerTour > stopsThreshold) {
    warnings.push(`Ø ${avgStopsPerTour} Stopps/Tour überschreitet Limit von ${stopsThreshold}`);
  } else if (avgStopsPerTour >= stopsThreshold * 0.8) {
    warnings.push(`Ø ${avgStopsPerTour} Stopps/Tour — Auslastung hoch`);
  }

  const overloadedTours = tours.filter((t) => t.pendingStops > stopsThreshold);
  if (overloadedTours.length > 0) {
    warnings.push(`${overloadedTours.length} Tour(en) mit mehr als ${stopsThreshold} offenen Stopps`);
  }

  let alertLevel: AlertLevel = 'ok';
  if (
    activeTours > tourThreshold ||
    avgStopsPerTour > stopsThreshold ||
    overloadedTours.length > 0
  ) {
    alertLevel = 'critical';
  } else if (
    activeTours >= Math.ceil(tourThreshold * 0.75) ||
    avgStopsPerTour >= stopsThreshold * 0.8
  ) {
    alertLevel = 'warning';
  }

  return NextResponse.json({
    ok: true,
    alertLevel,
    activeTours,
    tourThreshold,
    tourPct,
    avgStopsPerTour,
    stopsThreshold,
    totalPendingStops,
    warnings,
    tours,
  } satisfies TourCapacityWarningResponse);
}
