import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getOnboardingSteps,
  updateOnboardingStep,
  type StepStatus,
} from '@/lib/delivery/onboarding';

type Params = { params: Promise<{ id: string }> };

// GET /api/delivery/admin/applications/[id]/steps?location_id=
export async function GET(req: NextRequest, { params }: Params) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const steps = await getOnboardingSteps(id, locationId);
    return NextResponse.json({ steps });
  } catch (err) {
    console.error('[admin/applications/[id]/steps GET]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

// PATCH /api/delivery/admin/applications/[id]/steps
// Body: { location_id, step_id, status, notes? }
export async function PATCH(req: NextRequest, { params }: Params) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: applicationId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const locationId = body.location_id as string | undefined;
  const stepId     = body.step_id as string | undefined;
  const status     = body.status as StepStatus | undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  if (!stepId)     return NextResponse.json({ error: 'step_id required' }, { status: 400 });
  if (!status)     return NextResponse.json({ error: 'status required' }, { status: 400 });

  const valid: StepStatus[] = ['pending', 'in_progress', 'completed', 'skipped', 'failed'];
  if (!valid.includes(status)) {
    return NextResponse.json({ error: `Ungültiger Status. Erlaubt: ${valid.join(', ')}` }, { status: 400 });
  }

  try {
    const step = await updateOnboardingStep(
      stepId,
      applicationId,
      locationId,
      status,
      body.notes ? String(body.notes) : undefined,
    );
    return NextResponse.json({ step });
  } catch (err) {
    console.error('[admin/applications/[id]/steps PATCH]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
