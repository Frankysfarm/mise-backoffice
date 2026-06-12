import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createTest,
  getTest,
  listTests,
  updateTestStatus,
  deleteTest,
  getTestMetrics,
} from '@/lib/delivery/loyalty-ab';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('location_id');
  if (fromQuery) return fromQuery;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

async function requireAuth(): Promise<boolean> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  return !!user;
}

// ── GET ── list tests or single test with metrics
export async function GET(req: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  }

  const url = new URL(req.url);
  const testId = url.searchParams.get('test_id');

  if (testId) {
    const [test, metrics] = await Promise.all([
      getTest(testId, locationId),
      getTestMetrics(testId, locationId),
    ]);
    if (!test) return NextResponse.json({ error: 'Test nicht gefunden' }, { status: 404 });
    return NextResponse.json({ test, metrics });
  }

  const tests = await listTests(locationId);
  return NextResponse.json({ tests });
}

// ── POST ── create test
export async function POST(req: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  }

  const body = await req.json() as {
    name?: string;
    description?: string;
    variants?: Array<{
      name: string;
      description?: string;
      pointsMultiplier: number;
      allocationPct: number;
    }>;
  };

  if (!body.name || !body.variants || body.variants.length < 2) {
    return NextResponse.json(
      { error: 'name und mind. 2 variants erforderlich' },
      { status: 400 },
    );
  }

  const totalPct = body.variants.reduce((s, v) => s + (v.allocationPct ?? 0), 0);
  if (totalPct !== 100) {
    return NextResponse.json(
      { error: `Summe allocation_pct muss 100 sein (aktuell: ${totalPct})` },
      { status: 400 },
    );
  }

  try {
    const test = await createTest({
      locationId,
      name:        body.name,
      description: body.description,
      variants:    body.variants,
    });
    return NextResponse.json({ test }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}

// ── PATCH ── update status
export async function PATCH(req: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  }

  const body = await req.json() as {
    test_id?: string;
    status?: string;
  };

  if (!body.test_id || !body.status) {
    return NextResponse.json({ error: 'test_id und status erforderlich' }, { status: 400 });
  }

  const allowed = ['active', 'paused', 'completed'] as const;
  if (!allowed.includes(body.status as typeof allowed[number])) {
    return NextResponse.json({ error: 'Ungültiger Status' }, { status: 400 });
  }

  try {
    await updateTestStatus(
      body.test_id,
      locationId,
      body.status as 'active' | 'paused' | 'completed',
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}

// ── DELETE ── delete draft test
export async function DELETE(req: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  }

  const url = new URL(req.url);
  const testId = url.searchParams.get('test_id');
  if (!testId) {
    return NextResponse.json({ error: 'test_id fehlt' }, { status: 400 });
  }

  try {
    await deleteTest(testId, locationId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
