import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getGeofenceDashboard,
  getGeofenceConfig,
  upsertGeofenceConfig,
  scanLocationDrivers,
  pruneGeofenceScanLogs,
} from '@/lib/delivery/driver-geofence';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const qsLoc = req.nextUrl.searchParams.get('location_id');
  if (qsLoc) return qsLoc;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'config') {
    const config = await getGeofenceConfig(locationId);
    return NextResponse.json({ ok: true, config });
  }

  const dashboard = await getGeofenceDashboard(locationId);
  return NextResponse.json({ ok: true, ...dashboard });
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action: string = body.action ?? 'save_config';

  if (action === 'save_config') {
    const config = await upsertGeofenceConfig(locationId, {
      enabled: body.enabled,
      ring1_m: body.ring1_m != null ? Number(body.ring1_m) : undefined,
      ring2_m: body.ring2_m != null ? Number(body.ring2_m) : undefined,
    });
    return NextResponse.json({ ok: true, config });
  }

  if (action === 'scan_now') {
    const result = await scanLocationDrivers(locationId);
    return NextResponse.json({ ok: true, result });
  }

  if (action === 'prune') {
    const days = Number(body.days ?? 7);
    const result = await pruneGeofenceScanLogs(days);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
}
