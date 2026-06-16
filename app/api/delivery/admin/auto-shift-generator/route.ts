import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  createShiftDraft,
  applyShiftDraft,
  discardShiftDraft,
  skipDraftItem,
  getPendingDraft,
  getDraftDetails,
  getGeneratorDashboard,
  pruneOldDrafts,
} from '@/lib/delivery/auto-shift-generator';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = createServiceClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const qp = new URL(req.url).searchParams.get('location_id');
  if (qp) return qp;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return emp?.location_id ? String(emp.location_id) : null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = new URL(req.url).searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const data = await getGeneratorDashboard(locationId);
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'pending_draft') {
    const data = await getPendingDraft(locationId);
    return NextResponse.json({ ok: true, data });
  }

  if (action === 'draft') {
    const draftId = new URL(req.url).searchParams.get('draft_id');
    if (!draftId) return NextResponse.json({ error: 'draft_id required' }, { status: 400 });
    const data = await getDraftDetails(draftId, locationId);
    return NextResponse.json({ ok: true, data });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const sb = createServiceClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    action: string;
    draft_id?: string;
    item_id?: string;
  };

  if (body.action === 'create_draft') {
    const result = await createShiftDraft(locationId);
    return NextResponse.json({ ok: true, data: result });
  }

  if (body.action === 'apply_draft') {
    if (!body.draft_id) return NextResponse.json({ error: 'draft_id required' }, { status: 400 });
    const result = await applyShiftDraft(body.draft_id, locationId, user.id);
    return NextResponse.json({ ok: true, data: result });
  }

  if (body.action === 'discard_draft') {
    if (!body.draft_id) return NextResponse.json({ error: 'draft_id required' }, { status: 400 });
    const ok = await discardShiftDraft(body.draft_id, locationId);
    return NextResponse.json({ ok });
  }

  if (body.action === 'skip_item') {
    if (!body.item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 });
    const ok = await skipDraftItem(body.item_id, locationId);
    return NextResponse.json({ ok });
  }

  if (body.action === 'prune') {
    const deleted = await pruneOldDrafts(30);
    return NextResponse.json({ ok: true, data: { deleted } });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
