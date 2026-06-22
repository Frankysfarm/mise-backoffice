/**
 * GET  /api/delivery/admin/emergency-capacity?location_id=...
 *   → EmergencyDashboard (offene Events + Standby-Pool + 7-Tage-Summary)
 *
 * POST { action: 'detect', location_id }
 *   → { event } | { ok: true } wenn kein Engpass
 *
 * POST { action: 'notify', event_id, location_id }
 *   → { notified: number }
 *
 * POST { action: 'respond', event_id, driver_id, response, location_id }
 *   → { ok: boolean }
 *
 * POST { action: 'resolve', event_id, location_id, resolution_type? }
 *   → { ok: boolean }
 *
 * POST { action: 'register-standby', driver_id, location_id, available_until, available_from?, notes? }
 *   → { ok: boolean }
 *
 * POST { action: 'remove-standby', driver_id, location_id }
 *   → { ok: boolean }
 *
 * POST { action: 'prune', days_old? }
 *   → { pruned: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  detectCapacityEmergency,
  notifyStandbyDrivers,
  recordDriverResponse,
  resolveEmergency,
  registerForStandby,
  removeFromStandby,
  getEmergencyDashboard,
  pruneOldEmergencyEvents,
  type EmergencyResolution,
  type DriverResponse,
} from '@/lib/delivery/emergency-capacity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getAuthContext(req: NextRequest): Promise<
  { userId: string; locationId: string } | NextResponse
> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId =
    new URL(req.url).searchParams.get('location_id') ??
    ((await req.clone().json().catch(() => ({} as Record<string, unknown>))) as Record<string, unknown>)
      .location_id as string | undefined ??
    '';

  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  return { userId: user.id, locationId };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await getAuthContext(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const dashboard = await getEmergencyDashboard(ctx.locationId);
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error('[emergency-capacity GET]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const action     = body.action as string | undefined;
  const locationId = body.location_id as string | undefined;

  try {
    switch (action) {
      case 'detect': {
        if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
        const event = await detectCapacityEmergency(locationId);
        return NextResponse.json(event ? { event } : { ok: true, message: 'Kein Engpass erkannt' });
      }

      case 'notify': {
        const eventId = body.event_id as string | undefined;
        if (!eventId || !locationId)
          return NextResponse.json({ error: 'event_id + location_id erforderlich' }, { status: 400 });
        const result = await notifyStandbyDrivers(eventId, locationId);
        return NextResponse.json(result);
      }

      case 'respond': {
        const eventId  = body.event_id  as string | undefined;
        const driverId = body.driver_id as string | undefined;
        const response = body.response  as DriverResponse | undefined;
        if (!eventId || !driverId || !response)
          return NextResponse.json({ error: 'event_id, driver_id, response erforderlich' }, { status: 400 });
        const result = await recordDriverResponse(eventId, driverId, response);
        return NextResponse.json(result);
      }

      case 'resolve': {
        const eventId        = body.event_id         as string | undefined;
        const resolutionType = (body.resolution_type as EmergencyResolution | undefined) ?? 'manual';
        if (!eventId || !locationId)
          return NextResponse.json({ error: 'event_id + location_id erforderlich' }, { status: 400 });
        const result = await resolveEmergency(eventId, locationId, resolutionType);
        return NextResponse.json(result);
      }

      case 'register-standby': {
        const driverId       = body.driver_id       as string | undefined;
        const availableUntil = body.available_until as string | undefined;
        if (!driverId || !locationId || !availableUntil)
          return NextResponse.json({ error: 'driver_id, location_id, available_until erforderlich' }, { status: 400 });
        const result = await registerForStandby({
          driverId,
          locationId,
          availableUntil,
          availableFrom: body.available_from as string | undefined,
          notes:         body.notes         as string | undefined,
        });
        return NextResponse.json(result);
      }

      case 'remove-standby': {
        const driverId = body.driver_id as string | undefined;
        if (!driverId || !locationId)
          return NextResponse.json({ error: 'driver_id + location_id erforderlich' }, { status: 400 });
        const result = await removeFromStandby(driverId, locationId);
        return NextResponse.json(result);
      }

      case 'prune': {
        const daysOld = typeof body.days_old === 'number' ? body.days_old : 90;
        const result  = await pruneOldEmergencyEvents(daysOld);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unbekannte action: ${action ?? '(keine)'}` }, { status: 400 });
    }
  } catch (err) {
    console.error('[emergency-capacity POST]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
