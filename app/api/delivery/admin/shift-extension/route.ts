/**
 * GET/POST /api/delivery/admin/shift-extension
 *
 * Phase 383: Smart Shift Extension & Overtime Alert Engine
 *
 * GET ?action=dashboard&location_id=<uuid>   → OvertimeDashboard
 * GET ?action=risks&location_id=<uuid>       → OvertimeRisk[]
 * GET ?action=requests&location_id=<uuid>    → pending ExtensionRequest[]
 *
 * POST { action: 'approve', request_id, location_id, decided_by? }
 * POST { action: 'decline', request_id, location_id, decided_by? }
 * POST { action: 'detect',  location_id }     → auto-detect + create requests
 * POST { action: 'expire',  location_id }     → expire stale requests
 * POST { action: 'snapshot', location_id, date? } → daily overtime summary
 * POST { action: 'prune',   days_old? }       → cleanup
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  detectOvertimeRisk,
  autoDetectAndRequestExtensions,
  approveExtensionRequest,
  declineExtensionRequest,
  expireStaleRequests,
  recordDailyOvertimeSummary,
  getOvertimeDashboard,
  pruneOldRequests,
} from '@/lib/delivery/shift-extension';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const action      = searchParams.get('action') ?? 'dashboard';
  const locationId  = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    if (action === 'risks') {
      const risks = await detectOvertimeRisk(locationId);
      return NextResponse.json({ ok: true, risks });
    }

    if (action === 'requests') {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('shift_extension_requests')
        .select('id, shift_id, driver_id, extra_minutes, reason, auto_detected, status, requested_at, decided_at')
        .eq('location_id', locationId)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });
      if (error) throw error;
      return NextResponse.json({ ok: true, requests: data });
    }

    // default: dashboard
    const dashboard = await getOvertimeDashboard(locationId);
    return NextResponse.json({ ok: true, dashboard });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>;
  const action     = body['action'] as string | undefined;
  const locationId = body['location_id'] as string | undefined;
  const requestId  = body['request_id'] as string | undefined;
  const decidedBy  = body['decided_by'] as string | undefined;

  try {
    if (action === 'approve') {
      if (!requestId || !locationId) {
        return NextResponse.json({ error: 'request_id + location_id required' }, { status: 400 });
      }
      const result = await approveExtensionRequest(requestId, locationId, decidedBy);
      return NextResponse.json(result);
    }

    if (action === 'decline') {
      if (!requestId || !locationId) {
        return NextResponse.json({ error: 'request_id + location_id required' }, { status: 400 });
      }
      const result = await declineExtensionRequest(requestId, locationId, decidedBy);
      return NextResponse.json(result);
    }

    if (action === 'detect') {
      if (!locationId) {
        return NextResponse.json({ error: 'location_id required' }, { status: 400 });
      }
      const result = await autoDetectAndRequestExtensions(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'expire') {
      if (!locationId) {
        return NextResponse.json({ error: 'location_id required' }, { status: 400 });
      }
      const result = await expireStaleRequests(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'snapshot') {
      if (!locationId) {
        return NextResponse.json({ error: 'location_id required' }, { status: 400 });
      }
      const date   = body['date'] as string | undefined;
      const result = await recordDailyOvertimeSummary(locationId, date);
      return NextResponse.json(result);
    }

    if (action === 'prune') {
      const daysOld = typeof body['days_old'] === 'number' ? body['days_old'] : 60;
      const result = await pruneOldRequests(daysOld);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
