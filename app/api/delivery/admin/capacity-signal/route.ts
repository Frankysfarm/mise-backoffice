/**
 * GET  /api/delivery/admin/capacity-signal?location_id=<uuid>
 *      → aktueller Snapshot + 24h-Trendhistorie
 *
 * POST /api/delivery/admin/capacity-signal
 *      Body: { location_id, action: 'snapshot' | 'prune' }
 *      → manuell Snapshot berechnen oder Events bereinigen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  snapshotCapacity,
  getCapacitySnapshot,
  getCapacityTrend,
  pruneCapacityEvents,
} from '@/lib/delivery/driver-capacity-signal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getLocationId(req: NextRequest): Promise<string | null> {
  return req.nextUrl.searchParams.get('location_id')?.trim() ?? null;
}

async function authenticate(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function GET(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const [snapshot, trend] = await Promise.all([
    getCapacitySnapshot(locationId),
    getCapacityTrend(locationId, 24),
  ]);

  return NextResponse.json({ snapshot, trend });
}

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { location_id?: string; action?: string; days_old?: number };
  const { location_id, action, days_old } = body;

  if (action === 'prune') {
    const result = await pruneCapacityEvents(days_old ?? 14);
    return NextResponse.json({ ok: true, ...result });
  }

  if (!location_id) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  if (action === 'snapshot') {
    const result = await snapshotCapacity(location_id);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
