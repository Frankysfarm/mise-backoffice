/**
 * GET /api/delivery/admin/kitchen-batch-readiness?location_id=...
 *
 * Batch-Fertigstellungs-Prognose: Wird ein Batch rechtzeitig für den Fahrer fertig?
 * Alert wenn projizierte Kochzeit > verfügbare Zeit bis Fahrer-Ankunft.
 *
 * Response:
 *   { ok, batches: BatchReadiness[], alertCount: number, generatedAt: string }
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type ReadinessStatus = 'ok' | 'tight' | 'alert' | 'unknown';

export interface BatchReadiness {
  batchId: string;
  driverName: string | null;
  etaAt: string | null;
  minutesUntilEta: number | null;
  prepTimeMin: number;
  prepStartedAt: string | null;
  elapsedPrepMin: number | null;
  remainingPrepMin: number | null;
  status: ReadinessStatus;
  gapMin: number | null;
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
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // Get default prep time from kitchen_timings
  const { data: timing } = await ssb
    .from('kitchen_timings')
    .select('prep_time_min')
    .eq('location_id', locationId)
    .maybeSingle();
  const defaultPrepTimeMin: number = (timing?.prep_time_min as number | null) ?? 15;

  // Try delivery_batches first
  const { data: batches, error: batchError } = await ssb
    .from('delivery_batches')
    .select('id, status, eta_at, driver_id, created_at')
    .eq('location_id', locationId)
    .in('status', ['pending', 'assigned', 'pickup', 'in_progress'])
    .gte('created_at', todayStart.toISOString());

  type RawBatch = { id: string; status: string; eta_at: string | null; driver_id: string | null; created_at: string | null };
  let rawBatches: RawBatch[] = [];

  if (!batchError && batches && batches.length > 0) {
    rawBatches = batches as RawBatch[];
  } else {
    // Fall back to driver_tours
    const { data: tours } = await ssb
      .from('driver_tours')
      .select('id, status, eta_at, driver_id, created_at')
      .eq('location_id', locationId)
      .in('status', ['pending', 'assigned', 'gestartet', 'in_progress'])
      .gte('created_at', todayStart.toISOString());
    rawBatches = (tours ?? []) as RawBatch[];
  }

  if (rawBatches.length === 0) {
    return NextResponse.json({ ok: true, batches: [], alertCount: 0, generatedAt: now.toISOString() });
  }

  // Resolve driver names
  const driverIds = [...new Set(rawBatches.map((b) => b.driver_id).filter((id): id is string => id !== null))];
  const driverNameMap = new Map<string, string>();
  if (driverIds.length > 0) {
    const { data: drivers } = await ssb
      .from('mise_drivers')
      .select('id, name')
      .in('id', driverIds);
    for (const d of drivers ?? []) {
      driverNameMap.set(d.id as string, d.name as string);
    }
  }

  const result: BatchReadiness[] = rawBatches.map((b) => {
    const etaAt = b.eta_at ?? null;
    const minutesUntilEta = etaAt ? Math.round((new Date(etaAt).getTime() - now.getTime()) / 60_000) : null;
    const prepTimeMin = defaultPrepTimeMin;

    // Estimate prep start: if batch was created today, use created_at as proxy
    const prepStartedAt = b.created_at ?? null;
    const elapsedPrepMin = prepStartedAt
      ? Math.round((now.getTime() - new Date(prepStartedAt).getTime()) / 60_000)
      : null;
    const remainingPrepMin =
      elapsedPrepMin !== null ? Math.max(0, prepTimeMin - elapsedPrepMin) : prepTimeMin;

    // Gap: time available minus remaining prep time
    const gapMin = minutesUntilEta !== null ? minutesUntilEta - remainingPrepMin : null;

    let status: ReadinessStatus = 'unknown';
    if (gapMin !== null) {
      if (gapMin < 0) status = 'alert';
      else if (gapMin <= 3) status = 'tight';
      else status = 'ok';
    }

    return {
      batchId: b.id,
      driverName: b.driver_id ? (driverNameMap.get(b.driver_id) ?? null) : null,
      etaAt,
      minutesUntilEta,
      prepTimeMin,
      prepStartedAt,
      elapsedPrepMin,
      remainingPrepMin,
      status,
      gapMin,
    };
  }).sort((a, b) => {
    const order: ReadinessStatus[] = ['alert', 'tight', 'ok', 'unknown'];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  const alertCount = result.filter((r) => r.status === 'alert' || r.status === 'tight').length;

  return NextResponse.json({ ok: true, batches: result, alertCount, generatedAt: now.toISOString() });
}
