/**
 * GET  /api/delivery/admin/review-flags             — Stats + offene Flags
 * GET  /api/delivery/admin/review-flags?action=history — Erledigte (30 Tage)
 * POST /api/delivery/admin/review-flags  action=update_status | create | scan
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getFlagStats,
  getOpenFlags,
  updateFlagStatus,
  createManualFlag,
  checkAllDrivers,
} from '@/lib/delivery/review-flags';
import type { ReviewFlagStatus } from '@/lib/delivery/review-flags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return qp;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const svc = createServiceClient();
  const { data: emp } = await svc
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

  try {
    if (action === 'history') {
      // Resolved / dismissed flags in last 30 days
      const svc = createServiceClient();
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data, error } = await svc
        .from('driver_review_flags')
        .select('id, driver_id, flag_reason, review_status, bad_rating_count, avg_rating_window, admin_notes, resolved_at, created_at, updated_at')
        .eq('location_id', locationId)
        .in('review_status', ['resolved', 'dismissed'])
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, history: data ?? [] });
    }

    const [stats, flags] = await Promise.all([
      getFlagStats(locationId),
      getOpenFlags(locationId, true),
    ]);
    return NextResponse.json({ ok: true, stats, flags });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    action?: string;
    flagId?: string;
    status?: ReviewFlagStatus;
    adminNotes?: string;
    driverId?: string;
  };

  const action = body.action ?? '';

  try {
    if (action === 'update_status') {
      if (!body.flagId || !body.status) {
        return NextResponse.json({ error: 'flagId und status erforderlich' }, { status: 400 });
      }
      const flag = await updateFlagStatus(body.flagId, locationId, body.status, body.adminNotes);
      return NextResponse.json({ ok: true, flag });
    }

    if (action === 'create') {
      if (!body.driverId) {
        return NextResponse.json({ error: 'driverId erforderlich' }, { status: 400 });
      }
      const flag = await createManualFlag(body.driverId, locationId, body.adminNotes);
      return NextResponse.json({ ok: true, flag });
    }

    if (action === 'scan') {
      const result = await checkAllDrivers();
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
