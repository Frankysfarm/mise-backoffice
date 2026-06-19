/**
 * GET  /api/delivery/surge?locationId=...
 *   → Dashboard-Daten (aktive Alerts + letzte Detektionen + Baseline-Status)
 *
 * POST /api/delivery/surge
 *   body: { locationId, action: 'detect' | 'rebuild_baseline' | 'dismiss' | 'resolve_old', alertId? }
 *   → Surge erkennen / Baseline neu aufbauen / Alert schließen
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  detectDemandSurgeV2,
  getDemandSurgeDashboard,
  dismissAlert,
  rebuildHourlyBaseline,
} from '@/lib/delivery/demand-surge-v2';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('locationId');
  if (!locationId) {
    return NextResponse.json({ error: 'locationId fehlt' }, { status: 400 });
  }

  const dashboard = await getDemandSurgeDashboard(locationId);
  return NextResponse.json({ ok: true, dashboard });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { locationId, action, alertId } = body as {
    locationId: string;
    action:     'detect' | 'rebuild_baseline' | 'dismiss' | 'resolve_old';
    alertId?:   string;
  };

  if (!locationId || !action) {
    return NextResponse.json({ error: 'locationId + action erforderlich' }, { status: 400 });
  }

  switch (action) {
    case 'detect': {
      const result = await detectDemandSurgeV2(locationId);
      return NextResponse.json({ ok: true, result });
    }

    case 'rebuild_baseline': {
      const result = await rebuildHourlyBaseline(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    case 'dismiss': {
      if (!alertId) {
        return NextResponse.json({ error: 'alertId für dismiss erforderlich' }, { status: 400 });
      }
      const ok = await dismissAlert(alertId, locationId);
      return NextResponse.json({ ok });
    }

    case 'resolve_old': {
      const svc = createServiceClient();
      const { data } = await svc.rpc('resolve_old_surge_alerts', { p_location_id: locationId });
      return NextResponse.json({ ok: true, resolved: data ?? 0 });
    }

    default:
      return NextResponse.json({ error: `Unbekannte action: ${action}` }, { status: 400 });
  }
}
