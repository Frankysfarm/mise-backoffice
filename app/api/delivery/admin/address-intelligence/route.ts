/**
 * GET  /api/delivery/admin/address-intelligence
 *      ?action=dashboard|problematic|issues|stats
 *      &location_id=... (optional, wird aus employee gelöst)
 *
 * POST /api/delivery/admin/address-intelligence
 *      body: { action: 'resolve_issue', issue_id }
 *            { action: 'record_issue', order_id, issue_type, driver_notes? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getAddressIntelligenceDashboard,
  getAddressStats,
  getProblematicAddresses,
  getRecentIssues,
  recordAddressIssue,
  resolveAddressIssue,
  type IssueType,
} from '@/lib/delivery/address-intelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(
  req: NextRequest,
): Promise<{ locationId: string | null; error?: NextResponse }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user)
    return {
      locationId: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, tenant_id')
    .eq('id', user.id)
    .maybeSingle();

  const fromQs = req.nextUrl.searchParams.get('location_id');
  const locationId = fromQs ?? emp?.location_id ?? null;
  if (!locationId)
    return {
      locationId: null,
      error: NextResponse.json({ error: 'location_id required' }, { status: 400 }),
    };
  return { locationId };
}

export async function GET(req: NextRequest) {
  const { locationId, error } = await resolveLocationId(req);
  if (error) return error;

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'dashboard') {
      const dashboard = await getAddressIntelligenceDashboard(locationId!);
      return NextResponse.json(dashboard);
    }

    if (action === 'stats') {
      const stats = await getAddressStats(locationId!);
      return NextResponse.json({ stats });
    }

    if (action === 'problematic') {
      const minIssues = Number(req.nextUrl.searchParams.get('min_issues') ?? 2);
      const list = await getProblematicAddresses(locationId!, minIssues);
      return NextResponse.json({ problematic: list });
    }

    if (action === 'issues') {
      const limit = Math.min(100, Number(req.nextUrl.searchParams.get('limit') ?? 30));
      const issues = await getRecentIssues(locationId!, limit);
      return NextResponse.json({ issues });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[address-intelligence GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { locationId, error } = await resolveLocationId(req);
  if (error) return error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = body.action as string;

    if (action === 'resolve_issue') {
      const issueId = body.issue_id as string;
      if (!issueId) return NextResponse.json({ error: 'issue_id required' }, { status: 400 });
      await resolveAddressIssue(issueId, locationId!);
      return NextResponse.json({ ok: true });
    }

    if (action === 'record_issue') {
      const orderId = body.order_id as string;
      const issueType = body.issue_type as IssueType;
      if (!orderId || !issueType)
        return NextResponse.json({ error: 'order_id and issue_type required' }, { status: 400 });

      await recordAddressIssue({
        locationId: locationId!,
        orderId,
        issueType,
        driverNotes: (body.driver_notes as string | undefined) ?? undefined,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[address-intelligence POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
