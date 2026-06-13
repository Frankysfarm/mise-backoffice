/**
 * PATCH /api/delivery/reviews/[id]?location_id=...
 *
 * Admin-Aktion: Status eines Review-Flags ändern.
 *
 * Body:
 *   { status: 'open' | 'in_review' | 'resolved' | 'dismissed', admin_notes?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateFlagStatus } from '@/lib/delivery/review-flags';
import type { ReviewFlagStatus } from '@/lib/delivery/review-flags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES: ReviewFlagStatus[] = ['open', 'in_review', 'resolved', 'dismissed'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { id: flagId } = await params;
  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  let body: { status?: string; admin_notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.includes(body.status as ReviewFlagStatus)) {
    return NextResponse.json(
      { error: `status muss eines von ${VALID_STATUSES.join(', ')} sein` },
      { status: 400 },
    );
  }

  try {
    const flag = await updateFlagStatus(
      flagId,
      locationId,
      body.status as ReviewFlagStatus,
      body.admin_notes,
    );
    return NextResponse.json({ flag });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
