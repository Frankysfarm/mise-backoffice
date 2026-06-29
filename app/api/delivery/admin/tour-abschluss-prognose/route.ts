/**
 * GET /api/delivery/admin/tour-abschluss-prognose?location_id=...
 *
 * Tour-Abschluss-Prognose: Wann kommt jeder aktive Fahrer zurück?
 * ETA = verbleibende Stopps × Ø Stopp-Zeit + Rückweg-Puffer.
 * Phase 510
 *
 * Response: { ok, drivers: TourAbschlussEntry[], generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type ReturnUrgency = 'soon' | 'coming' | 'later';

export interface TourAbschlussEntry {
  driverId: string;
  driverName: string;
  vehicle: string | null;
  batchId: string | null;
  completedStops: number;
  pendingStops: number;
  totalStops: number;
  avgStopMinutes: number;
  estimatedReturnMinutes: number;
  estimatedReturnAt: string;
  urgency: ReturnUrgency;
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();
  const now = new Date();

  // Aktive Fahrer mit laufendem Batch
  const ACTIVE_STATES = ['unterwegs', 'pickup', 'on_route', 'at_restaurant', 'assigned'];
  const { data: batches } = await ssb
    .from('mise_delivery_batches')
    .select('id, driver_id, started_at')
    .eq('location_id', locationId)
    .in('status', ACTIVE_STATES);

  if (!batches || batches.length === 0) {
    return NextResponse.json({ ok: true, drivers: [], generatedAt: now.toISOString() });
  }

  const driverIds = batches.map((b) => b.driver_id as string).filter(Boolean);

  // Fahrerdaten
  const { data: drivers } = await ssb
    .from('mise_drivers')
    .select('id, name, vehicle')
    .in('id', driverIds);

  const driverMap = new Map<string, { name: string; vehicle: string | null }>();
  for (const d of drivers ?? []) {
    driverMap.set(d.id as string, { name: d.name as string, vehicle: (d.vehicle as string) ?? null });
  }

  // Stopps je Batch
  const batchIds = batches.map((b) => b.id as string);
  const { data: stops } = await ssb
    .from('mise_delivery_batch_stops')
    .select('batch_id, status, arrived_at, departed_at, sequence')
    .in('batch_id', batchIds);

  const stopsMap = new Map<string, typeof stops>();
  for (const s of stops ?? []) {
    const bId = s.batch_id as string;
    if (!stopsMap.has(bId)) stopsMap.set(bId, []);
    stopsMap.get(bId)!.push(s);
  }

  const result: TourAbschlussEntry[] = [];

  for (const batch of batches) {
    const dId = batch.driver_id as string;
    if (!dId) continue;
    const dInfo = driverMap.get(dId);
    const batchStops = stopsMap.get(batch.id as string) ?? [];

    const completed = batchStops.filter((s) =>
      s.status === 'delivered' || s.status === 'geliefert' || s.status === 'completed'
    );
    const pending = batchStops.filter((s) =>
      s.status !== 'delivered' && s.status !== 'geliefert' && s.status !== 'completed'
    );

    // Ø Stopp-Zeit aus abgeschlossenen Stopps (arrived → departed)
    let avgStopMin = 8; // Fallback: 8 Min/Stopp
    const timings: number[] = [];
    for (const cs of completed) {
      if (cs.arrived_at && cs.departed_at) {
        const diff = (new Date(cs.departed_at as string).getTime() - new Date(cs.arrived_at as string).getTime()) / 60_000;
        if (diff > 0 && diff < 60) timings.push(diff);
      }
    }
    if (timings.length > 0) {
      avgStopMin = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
    }

    // Rückweg-Puffer: 5 Min pauschal
    const returnBuffer = 5;
    const estimatedReturnMin = pending.length * avgStopMin + returnBuffer;
    const estimatedReturnAt = new Date(now.getTime() + estimatedReturnMin * 60_000);

    const urgency: ReturnUrgency =
      estimatedReturnMin <= 5 ? 'soon' : estimatedReturnMin <= 20 ? 'coming' : 'later';

    result.push({
      driverId: dId,
      driverName: dInfo?.name ?? 'Unbekannt',
      vehicle: dInfo?.vehicle ?? null,
      batchId: batch.id as string,
      completedStops: completed.length,
      pendingStops: pending.length,
      totalStops: batchStops.length,
      avgStopMinutes: avgStopMin,
      estimatedReturnMinutes: estimatedReturnMin,
      estimatedReturnAt: estimatedReturnAt.toISOString(),
      urgency,
    });
  }

  result.sort((a, b) => a.estimatedReturnMinutes - b.estimatedReturnMinutes);

  return NextResponse.json({ ok: true, drivers: result, generatedAt: now.toISOString() });
}
