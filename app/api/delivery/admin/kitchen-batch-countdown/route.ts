/**
 * GET /api/delivery/admin/kitchen-batch-countdown?location_id=...
 *
 * Phase 533 — Küchen-Batch-Fertigstellungs-Countdown
 * Aktive Batches (Status: vorbereitung/bereit) mit verbleibender Zeit bis zur Abholung.
 * Ø Kochzeit aus Batch-Größe × konfigurierter Prep-Zeit (Fallback: 8 Min/Bestellung, min 12 Min).
 *
 * Response: { ok, batches: KitchenBatchCountdown[], summary: BatchCountdownSummary, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type BatchUrgency = 'on_track' | 'due_soon' | 'overdue';

export interface KitchenBatchCountdown {
  batchId: string;
  zone: string | null;
  ordersCount: number;
  startedAt: string | null;
  estimatedPrepMin: number;
  elapsedMin: number;
  remainingMin: number;
  urgency: BatchUrgency;
  status: string;
  driverName: string | null;
}

export interface BatchCountdownSummary {
  activeBatches: number;
  overdueCount: number;
  dueSoonCount: number;
  avgRemainingMin: number | null;
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

function urgency(remainingMin: number): BatchUrgency {
  if (remainingMin <= 0)  return 'overdue';
  if (remainingMin <= 5)  return 'due_soon';
  return 'on_track';
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

  // Get prep time config (minutes per order)
  type ConfigRow = { prep_time_minutes: number | null };
  const { data: configRow } = await ssb
    .from('tenants')
    .select('prep_time_minutes')
    .eq('id', locationId)
    .maybeSingle();
  const prepTimePerOrder = (configRow as ConfigRow | null)?.prep_time_minutes ?? 8;

  type BatchRow = {
    id: string;
    zone: string | null;
    status: string;
    gestartet_am: string | null;
    driver: { name: string | null } | { name: string | null }[] | null;
  };

  const { data: batches } = await ssb
    .from('mise_delivery_batches')
    .select('id, zone, status, gestartet_am, driver:fahrer_id(name)')
    .eq('location_id', locationId)
    .in('status', ['vorbereitung', 'bereit']);

  if (!batches || batches.length === 0) {
    return NextResponse.json({
      ok: true,
      batches: [],
      summary: { activeBatches: 0, overdueCount: 0, dueSoonCount: 0, avgRemainingMin: null },
      generatedAt: now.toISOString(),
    });
  }

  type StopCountRow = { batch_id: string };
  const batchIds = (batches as BatchRow[]).map((b) => b.id);

  const { data: stopRows } = await ssb
    .from('mise_delivery_batch_stops')
    .select('batch_id')
    .eq('location_id', locationId)
    .in('batch_id', batchIds);

  const stops = (stopRows ?? []) as StopCountRow[];

  const result: KitchenBatchCountdown[] = (batches as BatchRow[]).map((batch) => {
    const ordersCount = stops.filter((s) => s.batch_id === batch.id).length;
    const estimatedPrepMin = Math.max(12, ordersCount * prepTimePerOrder);

    const startedAt = batch.gestartet_am ? new Date(batch.gestartet_am) : null;
    const elapsedMin = startedAt
      ? Math.floor((now.getTime() - startedAt.getTime()) / 60_000)
      : 0;
    const remainingMin = estimatedPrepMin - elapsedMin;

    const driverRaw = batch.driver;
    const driverName = Array.isArray(driverRaw)
      ? ((driverRaw[0] as { name: string | null })?.name ?? null)
      : ((driverRaw as { name: string | null } | null)?.name ?? null);

    return {
      batchId: batch.id,
      zone: batch.zone,
      ordersCount,
      startedAt: batch.gestartet_am,
      estimatedPrepMin,
      elapsedMin,
      remainingMin,
      urgency: urgency(remainingMin),
      status: batch.status,
      driverName,
    };
  });

  // Sort: overdue first, then due_soon, then on_track; within group by remainingMin asc
  const urgencyOrder: Record<BatchUrgency, number> = { overdue: 0, due_soon: 1, on_track: 2 };
  result.sort((a, b) => {
    const diff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    return diff !== 0 ? diff : a.remainingMin - b.remainingMin;
  });

  const overdueCount = result.filter((b) => b.urgency === 'overdue').length;
  const dueSoonCount = result.filter((b) => b.urgency === 'due_soon').length;
  const onTrackBatches = result.filter((b) => b.urgency === 'on_track');
  const avgRemainingMin =
    onTrackBatches.length > 0
      ? Math.round(onTrackBatches.reduce((s, b) => s + b.remainingMin, 0) / onTrackBatches.length)
      : null;

  const summary: BatchCountdownSummary = {
    activeBatches: result.length,
    overdueCount,
    dueSoonCount,
    avgRemainingMin,
  };

  return NextResponse.json({ ok: true, batches: result, summary, generatedAt: now.toISOString() });
}
