/**
 * GET/POST /api/delivery/admin/shift-swap
 *
 * Phase 324 — Shift-Swap Engine Admin API
 *
 * GET  ?action=dashboard|open|history|config|partners&shift_id=
 * POST { action: 'approve'|'reject'|'save_config'|'expire' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getSwapDashboard,
  getOpenRequests,
  getSwapHistory,
  getConfig,
  upsertConfig,
  adminApproveSwap,
  adminRejectSwap,
  autoExpireStaleSwaps,
  getAvailableSwapPartners,
} from '@/lib/delivery/shift-swap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveAuth(): Promise<{ locationId: string; userId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!emp?.location_id) return null;
  return { locationId: emp.location_id as string, userId: user.id };
}

export async function GET(req: NextRequest) {
  const auth = await resolveAuth();
  if (!auth) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action  = searchParams.get('action') ?? 'dashboard';
  const shiftId = searchParams.get('shift_id');
  const limit   = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

  try {
    switch (action) {
      case 'dashboard':
        return NextResponse.json(await getSwapDashboard(auth.locationId));

      case 'open':
        return NextResponse.json({ requests: await getOpenRequests(auth.locationId) });

      case 'history':
        return NextResponse.json({ history: await getSwapHistory(auth.locationId, limit) });

      case 'config':
        return NextResponse.json(await getConfig(auth.locationId));

      case 'partners': {
        if (!shiftId) {
          return NextResponse.json({ error: 'shift_id erforderlich' }, { status: 400 });
        }
        return NextResponse.json({
          partners: await getAvailableSwapPartners(shiftId, auth.locationId),
        });
      }

      default:
        return NextResponse.json({ error: 'Unbekannte Action' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await resolveAuth();
  if (!auth) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  try {
    const body = await req.json() as Record<string, unknown>;
    const action = body.action as string;

    switch (action) {
      case 'approve': {
        const swapId = body.swap_id as string;
        if (!swapId) return NextResponse.json({ error: 'swap_id erforderlich' }, { status: 400 });
        await adminApproveSwap(swapId, auth.userId);
        return NextResponse.json({ ok: true });
      }

      case 'reject': {
        const swapId = body.swap_id as string;
        const reason = (body.reason as string) ?? 'Abgelehnt';
        if (!swapId) return NextResponse.json({ error: 'swap_id erforderlich' }, { status: 400 });
        await adminRejectSwap(swapId, auth.userId, reason);
        return NextResponse.json({ ok: true });
      }

      case 'save_config': {
        const cfg = await upsertConfig(auth.locationId, {
          enabled:                body.enabled                    as boolean  | undefined,
          requireAdminApproval:   body.require_admin_approval     as boolean  | undefined,
          maxSwapsPerDriverMonth: body.max_swaps_per_driver_month as number   | undefined,
          minNoticeHours:         body.min_notice_hours           as number   | undefined,
          allowOpenRequests:      body.allow_open_requests        as boolean  | undefined,
        });
        return NextResponse.json(cfg);
      }

      case 'expire': {
        const result = await autoExpireStaleSwaps(auth.locationId);
        return NextResponse.json({ expired: result });
      }

      default:
        return NextResponse.json({ error: 'Unbekannte Action' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
