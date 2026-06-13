/**
 * GET+POST /api/delivery/admin/peak-intelligence
 *
 * Phase 120: Smart Peak Day Intelligence & Event Preparation Engine
 *
 * GET  → getPeakDashboard()
 * POST action=analyze        → detectUpcomingPeaks + generatePeakAlerts
 * POST action=add_event      → createDeliveryEvent
 * POST action=update_event   → updateDeliveryEvent
 * POST action=delete_event   → deleteDeliveryEvent
 * POST action=dismiss_alert  → dismissPeakAlert
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getPeakDashboard,
  generatePeakAlerts,
  createDeliveryEvent,
  updateDeliveryEvent,
  deleteDeliveryEvent,
  dismissPeakAlert,
  type CreateEventInput,
  type DeliveryEventType,
} from '@/lib/delivery/peak-intelligence';

export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<{ locationId: string; employeeId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('id, location_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return null;
  return { locationId: emp.location_id as string, employeeId: emp.id as string };
}

export async function GET(req: NextRequest) {
  const auth = await resolveLocationId(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const dashboard = await getPeakDashboard(auth.locationId);
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error('[peak-intelligence] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await resolveLocationId(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = body.action as string | undefined;

  try {
    if (action === 'analyze') {
      const result = await generatePeakAlerts(auth.locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'add_event') {
      const input: CreateEventInput = {
        locationId: auth.locationId,
        eventDate: body.eventDate as string,
        eventType: body.eventType as DeliveryEventType,
        title: body.title as string,
        description: (body.description as string | undefined) ?? null,
        expectedDemandMult: (body.expectedDemandMult as number | undefined) ?? 1.0,
        extraDriversNeeded: (body.extraDriversNeeded as number | undefined) ?? 0,
        kitchenOpenEarlierMin: (body.kitchenOpenEarlierMin as number | undefined) ?? 0,
        notesForTeam: (body.notesForTeam as string | undefined) ?? null,
        createdBy: auth.employeeId,
      };
      if (!input.eventDate || !input.title) {
        return NextResponse.json({ error: 'eventDate and title required' }, { status: 400 });
      }
      const event = await createDeliveryEvent(input);
      return NextResponse.json({ ok: true, event });
    }

    if (action === 'update_event') {
      const id = body.id as string | undefined;
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
      const event = await updateDeliveryEvent(id, auth.locationId, {
        eventDate: body.eventDate as string | undefined,
        eventType: body.eventType as DeliveryEventType | undefined,
        title: body.title as string | undefined,
        description: body.description as string | null | undefined,
        expectedDemandMult: body.expectedDemandMult as number | undefined,
        extraDriversNeeded: body.extraDriversNeeded as number | undefined,
        kitchenOpenEarlierMin: body.kitchenOpenEarlierMin as number | undefined,
        notesForTeam: body.notesForTeam as string | null | undefined,
      });
      return NextResponse.json({ ok: true, event });
    }

    if (action === 'delete_event') {
      const id = body.id as string | undefined;
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
      await deleteDeliveryEvent(id, auth.locationId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'dismiss_alert') {
      const alertId = body.alertId as string | undefined;
      if (!alertId) return NextResponse.json({ error: 'alertId required' }, { status: 400 });
      await dismissPeakAlert(alertId, auth.locationId, auth.employeeId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[peak-intelligence] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
