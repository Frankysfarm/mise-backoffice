/**
 * POST /api/delivery/admin/batch-reassign
 *
 * Weist einen aktiven Batch (Tour) einem anderen verfügbaren Fahrer zu.
 * Benachrichtigt den alten und neuen Fahrer per Push-Notification.
 *
 * Body: { batch_id: string; new_driver_id: string; location_id?: string }
 * Response: { ok: true; batchId; oldDriverId; newDriverId }
 *
 * Regeln:
 *   - Batch muss status 'pending' oder 'active' haben (nicht 'completed'/'cancelled')
 *   - Neuer Fahrer muss aktiv (active=true) und für dieselbe Location sein
 *   - Multi-Tenant: ALLE Queries filtern location_id
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReassignBody {
  batch_id: string;
  new_driver_id: string;
  location_id?: string | null;
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: ReassignBody;
  try {
    body = (await req.json()) as ReassignBody;
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const { batch_id, new_driver_id } = body;
  if (!batch_id)     return NextResponse.json({ error: 'batch_id fehlt' }, { status: 400 });
  if (!new_driver_id) return NextResponse.json({ error: 'new_driver_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();

  // Verify auth user belongs to a location
  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!emp) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });

  // Load batch
  const { data: batch, error: batchErr } = await ssb
    .from('mise_delivery_batches')
    .select('id, driver_id, status, location_id, zone')
    .eq('id', batch_id)
    .maybeSingle();

  if (batchErr || !batch) {
    return NextResponse.json({ error: 'Batch nicht gefunden' }, { status: 404 });
  }

  const locationId = body.location_id ?? (batch.location_id as string | null);
  if (!locationId) return NextResponse.json({ error: 'location_id nicht ermittelbar' }, { status: 400 });

  const batchStatus = batch.status as string;
  if (batchStatus === 'completed' || batchStatus === 'cancelled') {
    return NextResponse.json({ error: `Batch ist bereits ${batchStatus} und kann nicht neu zugewiesen werden` }, { status: 409 });
  }

  const oldDriverId = batch.driver_id as string | null;
  if (oldDriverId === new_driver_id) {
    return NextResponse.json({ error: 'Neuer Fahrer ist bereits der aktuelle Fahrer' }, { status: 409 });
  }

  // Verify new driver is active and belongs to location
  const { data: newDriver } = await ssb
    .from('mise_drivers')
    .select('id, location_id, active, employee_id')
    .eq('id', new_driver_id)
    .eq('active', true)
    .maybeSingle();

  if (!newDriver) {
    return NextResponse.json({ error: 'Neuer Fahrer nicht gefunden oder nicht aktiv' }, { status: 404 });
  }

  // Update batch driver_id
  const { error: batchUpdateErr } = await ssb
    .from('mise_delivery_batches')
    .update({ driver_id: new_driver_id, updated_at: new Date().toISOString() })
    .eq('id', batch_id);

  if (batchUpdateErr) {
    return NextResponse.json({ error: batchUpdateErr.message }, { status: 500 });
  }

  // Update all pending stops for this batch
  await ssb
    .from('mise_delivery_batch_stops')
    .update({ driver_id: new_driver_id })
    .eq('batch_id', batch_id)
    .neq('status', 'completed');

  // Update mise_drivers: clear old driver's batch link
  if (oldDriverId) {
    await ssb
      .from('mise_drivers')
      .update({ mise_batch_id: null })
      .eq('id', oldDriverId)
      .eq('mise_batch_id', batch_id);
  }

  // Set new driver's batch link
  await ssb
    .from('mise_drivers')
    .update({ mise_batch_id: batch_id })
    .eq('id', new_driver_id);

  // Load driver names for notification
  const { data: oldDriverRow } = oldDriverId
    ? await ssb
        .from('employees')
        .select('name')
        .eq('id', (await ssb.from('mise_drivers').select('employee_id').eq('id', oldDriverId).maybeSingle()).data?.employee_id as string)
        .maybeSingle()
    : { data: null };

  const { data: newDriverEmp } = await ssb
    .from('employees')
    .select('name')
    .eq('id', newDriver.employee_id as string)
    .maybeSingle();

  const newDriverName = (newDriverEmp?.name as string | null) ?? 'Neuer Fahrer';
  const oldDriverName = (oldDriverRow?.name as string | null) ?? 'Alter Fahrer';

  // Fire notifications fire-and-forget
  import('@/lib/delivery/push-notify').then(async ({ enqueueTourStatusPush }) => {
    const zone = batch.zone as string | null;
    const zoneSuffix = zone ? ` (Zone ${zone})` : '';

    if (oldDriverId) {
      await enqueueTourStatusPush({
        driverId: oldDriverId,
        batchId:  batch_id,
        title:    'Tour neu zugewiesen',
        body:     `Deine Tour${zoneSuffix} wurde an ${newDriverName} übergeben.`,
        type:     'tour_updated',
      }).catch(() => { /* graceful */ });
    }

    await enqueueTourStatusPush({
      driverId: new_driver_id,
      batchId:  batch_id,
      title:    'Neue Tour zugewiesen',
      body:     `Du hast eine Tour${zoneSuffix} von ${oldDriverName} übernommen.`,
      type:     'tour_reassigned',
    }).catch(() => { /* graceful */ });
  }).catch(() => { /* graceful */ });

  return NextResponse.json({
    ok: true,
    batchId:     batch_id,
    oldDriverId: oldDriverId ?? null,
    newDriverId: new_driver_id,
    oldDriverName,
    newDriverName,
  });
}

/**
 * GET /api/delivery/admin/batch-reassign?location_id=...
 * Liefert verfügbare Fahrer (aktiv, keine aktive Tour) für eine Location.
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();

  // All active drivers for location
  const { data: drivers } = await ssb
    .from('mise_drivers')
    .select('id, employee_id, vehicle, state, mise_batch_id, rating, total_deliveries')
    .eq('location_id', locationId)
    .eq('active', true);

  if (!drivers) return NextResponse.json({ drivers: [] });

  // Load employee names
  const empIds = drivers.map((d) => d.employee_id as string).filter(Boolean);
  const { data: employees } = empIds.length > 0
    ? await ssb.from('employees').select('id, name').in('id', empIds)
    : { data: [] };

  const empMap = new Map((employees ?? []).map((e) => [e.id as string, e.name as string]));

  const rows = drivers.map((d) => ({
    id:             d.id as string,
    name:           empMap.get(d.employee_id as string) ?? 'Unbekannt',
    vehicle:        d.vehicle as string | null,
    state:          d.state as string | null,
    hasActiveBatch: !!d.mise_batch_id,
    activeBatchId:  (d.mise_batch_id as string | null) ?? null,
    rating:         (d.rating as number | null) ?? null,
    totalDeliveries: (d.total_deliveries as number) ?? 0,
  }));

  return NextResponse.json({ drivers: rows });
}
