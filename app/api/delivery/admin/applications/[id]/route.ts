import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getApplicationById,
  updateApplicationStatus,
  type ApplicationStatus,
} from '@/lib/delivery/onboarding';

type Params = { params: Promise<{ id: string }> };

// GET /api/delivery/admin/applications/[id]?location_id=
export async function GET(req: NextRequest, { params }: Params) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const result = await getApplicationById(id, locationId);
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[admin/applications/[id] GET]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}

// PATCH /api/delivery/admin/applications/[id]
// Body: { location_id, status, admin_notes? }
export async function PATCH(req: NextRequest, { params }: Params) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const locationId = body.location_id as string | undefined;
  const status     = body.status as ApplicationStatus | undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 });

  const validStatuses: ApplicationStatus[] = ['pending', 'reviewing', 'approved', 'rejected', 'withdrawn'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: `Ungültiger Status. Erlaubt: ${validStatuses.join(', ')}` }, { status: 400 });
  }

  try {
    const application = await updateApplicationStatus(
      id,
      locationId,
      status,
      body.admin_notes ? String(body.admin_notes) : null,
      user.id,
    );
    return NextResponse.json({ application });
  } catch (err) {
    console.error('[admin/applications/[id] PATCH]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
