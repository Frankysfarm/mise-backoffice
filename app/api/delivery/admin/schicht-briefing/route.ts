/**
 * GET  /api/delivery/admin/schicht-briefing?location_id=...
 *      &driver_id=...   → Briefing für einen Fahrer (heute)
 *      (ohne driver_id) → Alle Briefings für Location heute
 *
 * POST /api/delivery/admin/schicht-briefing
 *      action=generate          → Briefings für alle Fahrer der Location
 *      action=generate-driver   → Einzelner Fahrer (body: { driver_id })
 *      action=generate-all      → Alle Standorte (Cron-Trigger)
 *      action=seen              → Gesehen-Zeitstempel (body: { id })
 *      action=prune             → Alte Briefings löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateBriefingForDriver,
  generateBriefingsForLocation,
  generateBriefingsAllLocations,
  getBriefingForDriver,
  getTodaysBriefingsForLocation,
  markBriefingSeen,
  pruneOldBriefings,
} from '@/lib/delivery/schicht-briefing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getEmployee(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('employees')
    .select('id, location_id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return data as { id: string; location_id: string; role: string } | null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const emp = await getEmployee(supabase);
    if (!emp) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get('location_id') ?? emp.location_id;
    const driverId   = searchParams.get('driver_id');
    const date       = searchParams.get('date') ?? undefined;

    if (driverId) {
      const briefing = await getBriefingForDriver(driverId, locationId, date);
      return NextResponse.json({ ok: true, briefing });
    }

    const briefings = await getTodaysBriefingsForLocation(locationId);
    return NextResponse.json({ ok: true, briefings });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const emp = await getEmployee(supabase);
    if (!emp) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as { action?: string; location_id?: string; driver_id?: string; id?: string };
    const action     = body.action ?? 'generate';
    const locationId = body.location_id ?? emp.location_id;

    switch (action) {
      case 'generate': {
        const result = await generateBriefingsForLocation(locationId);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'generate-driver': {
        if (!body.driver_id) {
          return NextResponse.json({ ok: false, error: 'driver_id required' }, { status: 400 });
        }
        const result = await generateBriefingForDriver(body.driver_id, locationId);
        return NextResponse.json({ ok: true, ...result });
      }
      case 'generate-all': {
        const result = await generateBriefingsAllLocations();
        return NextResponse.json({ ok: true, ...result });
      }
      case 'seen': {
        if (!body.id) {
          return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
        }
        await markBriefingSeen(body.id);
        return NextResponse.json({ ok: true });
      }
      case 'prune': {
        const pruned = await pruneOldBriefings(30);
        return NextResponse.json({ ok: true, pruned });
      }
      default:
        return NextResponse.json({ ok: false, error: `unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
