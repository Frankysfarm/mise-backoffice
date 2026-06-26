/**
 * GET /api/delivery/admin/kitchen-batch-schedule?location_id=...
 *
 * Kitchen-Batch-Zeitplan: Wann muss die Küche mit dem Kochen anfangen?
 *
 * Response:
 *   { ok, schedule: BatchSchedule[], generatedAt: string }
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface BatchSchedule {
  batchId: string;
  driverName: string | null;
  etaAt: string | null;
  prepTimeMin: number;
  optimalKochstart: string | null;
  status: string;
  minutesUntilKochstart: number | null;
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

  // Try to get prep time from kitchen_timings
  const { data: timing } = await ssb
    .from('kitchen_timings')
    .select('prep_time_min')
    .eq('location_id', locationId)
    .maybeSingle();

  const defaultPrepTimeMin: number = (timing?.prep_time_min as number | null) ?? 15;

  // Try delivery_batches first, fall back to driver_tours
  let schedule: BatchSchedule[] = [];

  const { data: batches, error: batchError } = await ssb
    .from('delivery_batches')
    .select('id, status, eta_at, driver_id')
    .eq('location_id', locationId)
    .in('status', ['pending', 'assigned', 'pickup'])
    .gte('created_at', todayStart.toISOString());

  if (!batchError && batches && batches.length > 0) {
    // Get driver names for batches
    const driverIds = [...new Set(
      (batches as { id: string; status: string; eta_at: string | null; driver_id: string | null }[])
        .map((b) => b.driver_id)
        .filter((id): id is string => id !== null),
    )];

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

    schedule = (batches as { id: string; status: string; eta_at: string | null; driver_id: string | null }[]).map((b) => {
      const etaAt = b.eta_at ?? null;
      const prepTimeMin = defaultPrepTimeMin;
      let optimalKochstart: string | null = null;
      let minutesUntilKochstart: number | null = null;

      if (etaAt) {
        const kochstartMs = new Date(etaAt).getTime() - prepTimeMin * 60_000;
        optimalKochstart = new Date(kochstartMs).toISOString();
        minutesUntilKochstart = Math.round((kochstartMs - now.getTime()) / 60_000);
      }

      return {
        batchId: b.id,
        driverName: b.driver_id ? (driverNameMap.get(b.driver_id) ?? null) : null,
        etaAt,
        prepTimeMin,
        optimalKochstart,
        status: b.status,
        minutesUntilKochstart,
      };
    });
  } else {
    // Fall back to driver_tours
    const { data: tours } = await ssb
      .from('driver_tours')
      .select('id, status, eta_at, driver_id')
      .eq('location_id', locationId)
      .in('status', ['pending', 'assigned'])
      .gte('created_at', todayStart.toISOString());

    if (tours && tours.length > 0) {
      const driverIds = [...new Set(
        (tours as { id: string; status: string; eta_at: string | null; driver_id: string | null }[])
          .map((t) => t.driver_id)
          .filter((id): id is string => id !== null),
      )];

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

      schedule = (tours as { id: string; status: string; eta_at: string | null; driver_id: string | null }[]).map((t) => {
        const etaAt = t.eta_at ?? null;
        const prepTimeMin = defaultPrepTimeMin;
        let optimalKochstart: string | null = null;
        let minutesUntilKochstart: number | null = null;

        if (etaAt) {
          const kochstartMs = new Date(etaAt).getTime() - prepTimeMin * 60_000;
          optimalKochstart = new Date(kochstartMs).toISOString();
          minutesUntilKochstart = Math.round((kochstartMs - now.getTime()) / 60_000);
        }

        return {
          batchId: t.id,
          driverName: t.driver_id ? (driverNameMap.get(t.driver_id) ?? null) : null,
          etaAt,
          prepTimeMin,
          optimalKochstart,
          status: t.status,
          minutesUntilKochstart,
        };
      });
    }
  }

  return NextResponse.json({ ok: true, schedule, generatedAt: now.toISOString() });
}
