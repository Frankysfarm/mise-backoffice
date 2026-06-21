/**
 * GET  /api/delivery/admin/transparency?location_id=<uuid>
 *      → TransparencyDashboard (30-Tage-Trend + heutiger Score + Badge)
 *
 * GET  /api/delivery/admin/transparency?location_id=<uuid>&action=live
 *      → Live-Berechnung ohne Persistenz (für Admin-Preview)
 *
 * POST /api/delivery/admin/transparency
 *      Body: { location_id, action: 'snapshot' | 'prune', days_old?: number }
 *      action=snapshot → Snapshot für heute berechnen + speichern
 *      action=prune    → Alte Snapshots löschen (Standard: 365 Tage)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getTransparencyDashboard,
  snapshotTransparency,
  calculateTransparencyScore,
  pruneTransparencySnapshots,
} from '@/lib/delivery/transparency-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authenticate(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'live') {
      const live = await calculateTransparencyScore(locationId);
      return NextResponse.json({ ok: true, ...live });
    }

    const dashboard = await getTransparencyDashboard(locationId);
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  let body: { location_id?: string; action?: string; days_old?: number };
  try { body = await req.json(); } catch { body = {}; }

  const { location_id: locationId, action, days_old: daysOld } = body;

  try {
    if (action === 'prune') {
      const result = await pruneTransparencySnapshots(daysOld ?? 365);
      return NextResponse.json({ ok: true, ...result });
    }

    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

    if (action === 'snapshot') {
      const snapshot = await snapshotTransparency(locationId);
      return NextResponse.json({ ok: true, snapshot });
    }

    return NextResponse.json({ error: 'Ungültige action' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
