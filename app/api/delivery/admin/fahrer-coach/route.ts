/**
 * GET  /api/delivery/admin/fahrer-coach?location_id=...&date=YYYY-MM-DD
 *      → Coaching-Hinweise für eine Location (heute oder angegebenes Datum)
 *
 * POST /api/delivery/admin/fahrer-coach
 *      action=generate      → Hinweise für Location generieren
 *      action=generate-all  → Alle Standorte (Cron-Trigger)
 *      action=seen          → Hinweis als gesehen markieren { id }
 *      action=prune         → Alte Hinweise löschen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateCoachingForLocation,
  generateCoachingAllLocations,
  getCoachingForLocation,
  markCoachingGesehen,
  pruneOldCoaching,
} from '@/lib/delivery/fahrer-coach';

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
    const date = searchParams.get('date') ?? undefined;

    const hinweise = await getCoachingForLocation(locationId, date);
    return NextResponse.json({ ok: true, hinweise });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const emp = await getEmployee(supabase);
    if (!emp) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({})) as {
      action?: string;
      location_id?: string;
      date?: string;
      id?: string;
    };
    const action = body.action;
    const locationId = body.location_id ?? emp.location_id;

    if (action === 'generate') {
      const result = await generateCoachingForLocation(locationId, body.date);
      return NextResponse.json({ ok: true, result });
    }

    if (action === 'generate-all') {
      const result = await generateCoachingAllLocations(body.date);
      return NextResponse.json({ ok: true, result });
    }

    if (action === 'seen') {
      if (!body.id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
      await markCoachingGesehen(body.id);
      return NextResponse.json({ ok: true });
    }

    if (action === 'prune') {
      const result = await pruneOldCoaching(60);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
