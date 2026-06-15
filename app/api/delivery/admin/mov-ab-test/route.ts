/**
 * GET+POST /api/delivery/admin/mov-ab-test
 *
 * Phase 194 — Smart MOV A/B-Test Engine
 *
 * GET  ?action=dashboard                        → MovAbDashboard
 * GET  ?action=list                             → MovAbTest[]
 * GET  ?action=get&testId=...                   → MovAbTest | null
 * GET  ?action=metrics&testId=...               → MovAbMetrics[]
 * POST { action: 'create', ...CreateMovTestInput } → MovAbTest
 * POST { action: 'status', testId, status }    → { ok: true }
 * POST { action: 'delete', testId }            → { ok: true }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createTest,
  listTests,
  getTest,
  getTestMetrics,
  updateTestStatus,
  deleteTest,
  getMovAbDashboard,
  type CreateMovTestInput,
  type MovTestStatus,
} from '@/lib/delivery/mov-ab-test';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getLocationId(req: NextRequest): Promise<string | null> {
  const sb = createServiceClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id, role')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (!emp?.location_id) return null;
  if (!['manager', 'owner', 'admin', 'superadmin'].includes(emp.role as string)) return null;
  return emp.location_id as string;
}

export async function GET(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'dashboard') {
      return NextResponse.json(await getMovAbDashboard(locationId));
    }
    if (action === 'list') {
      return NextResponse.json(await listTests(locationId));
    }
    if (action === 'get') {
      const testId = searchParams.get('testId');
      if (!testId) return NextResponse.json({ error: 'testId fehlt' }, { status: 400 });
      return NextResponse.json(await getTest(testId));
    }
    if (action === 'metrics') {
      const testId = searchParams.get('testId') ?? undefined;
      return NextResponse.json(await getTestMetrics(locationId, testId));
    }
    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as Record<string, unknown>;
    const action = body.action as string;

    if (action === 'create') {
      const input: CreateMovTestInput = {
        locationId,
        name:        body.name as string,
        description: body.description as string | undefined,
        zoneFilter:  body.zoneFilter as string[] | undefined as Parameters<typeof createTest>[0]['zoneFilter'],
        hourFrom:    body.hourFrom != null ? Number(body.hourFrom) : undefined,
        hourTo:      body.hourTo != null ? Number(body.hourTo) : undefined,
        startAt:     body.startAt as string | undefined,
        endAt:       body.endAt as string | undefined,
        variants:    body.variants as CreateMovTestInput['variants'],
      };
      return NextResponse.json(await createTest(input), { status: 201 });
    }

    if (action === 'status') {
      const { testId, status } = body as { testId: string; status: MovTestStatus };
      await updateTestStatus(testId, status);
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      await deleteTest(body.testId as string);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
