/**
 * GET  /api/delivery/reviews?location_id=...            — Offene Review-Flags
 * POST /api/delivery/reviews?location_id=...            — Manuellen Flag anlegen
 *
 * GET response:
 *   { flags: ReviewFlagWithDriver[], stats: FlagStats }
 *
 * POST body:
 *   { driver_id: string, admin_notes?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOpenFlags, getFlagStats, createManualFlag } from '@/lib/delivery/review-flags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const [flags, stats] = await Promise.all([
      getOpenFlags(locationId),
      getFlagStats(locationId),
    ]);
    return NextResponse.json({ flags, stats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  let body: { driver_id?: string; admin_notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  if (!body.driver_id) {
    return NextResponse.json({ error: 'driver_id fehlt' }, { status: 400 });
  }

  try {
    const flag = await createManualFlag(body.driver_id, locationId, body.admin_notes);
    return NextResponse.json({ flag }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConflict = msg.includes('bereits einen offenen');
    return NextResponse.json({ error: msg }, { status: isConflict ? 409 : 500 });
  }
}
