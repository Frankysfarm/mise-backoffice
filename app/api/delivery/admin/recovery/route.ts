/**
 * GET  /api/delivery/admin/recovery?location_id=...&limit=20
 *   → Recovery event history for a location
 *
 * POST /api/delivery/admin/recovery
 *   Body: { batch_id: string; reason?: string }
 *   → Manually trigger recovery for a cancelled (or stuck) batch
 */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getRecoveryEvents, recoverCancelledBatch } from '@/lib/delivery/recovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorizeRecovery(requestedLocationId?: string) {
  const sb = await createClient();
  const { data: { user }, error: userError } = await sb.auth.getUser();
  if (userError || !user) return { error: 'UNAUTHENTICATED', status: 401 } as const;
  const { data: employee, error } = await sb.from('employees')
    .select('location_id,role').eq('auth_user_id', user.id).maybeSingle();
  if (error || !employee) return { error: 'RECOVERY_ROLE_REQUIRED', status: 403 } as const;
  const role = String(employee.role ?? '');
  if (!['admin', 'manager', 'dispatcher', 'superadmin'].includes(role)) {
    return { error: 'RECOVERY_ROLE_REQUIRED', status: 403 } as const;
  }
  const locationId = requestedLocationId ?? null;
  if (role !== 'superadmin' && locationId && employee.location_id !== locationId) {
    return { error: 'RECOVERY_TENANT_FORBIDDEN', status: 403 } as const;
  }
  return { sb, role, employeeLocationId: String(employee.location_id), locationId } as const;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  const auth = await authorizeRecovery(locationId);
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

  try {
    const events = await getRecoveryEvents(locationId, limit);
    return NextResponse.json({ events, count: events.length });
  } catch (err) {
    const correlationId = randomUUID();
    console.error('[delivery-recovery:get]', {
      correlation_id: correlationId, location_id: locationId,
      error: err instanceof Error ? err.message : 'UNKNOWN_RECOVERY_READ_ERROR',
    });
    return NextResponse.json({
      error: 'RECOVERY_EVENTS_LOOKUP_FAILED', correlation_id: correlationId,
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { batch_id?: string; reason?: string };
  if (!body.batch_id) return NextResponse.json({ error: 'batch_id fehlt' }, { status: 400 });
  const preliminary = await authorizeRecovery();
  if ('error' in preliminary) return NextResponse.json({ error: preliminary.error }, { status: preliminary.status });
  const { data: batch, error: batchError } = await preliminary.sb.from('mise_delivery_batches')
    .select('location_id').eq('id', body.batch_id).maybeSingle();
  if (batchError || !batch) return NextResponse.json({ error: 'BATCH_NOT_FOUND' }, { status: 404 });
  const auth = await authorizeRecovery(String(batch.location_id));
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const t0 = Date.now();
  const result = await recoverCancelledBatch(
    body.batch_id,
    body.reason ?? 'manual_admin',
    true,
  );

  return NextResponse.json({
    ...result,
    duration_ms: Date.now() - t0,
  });
}
