import { NextRequest, NextResponse } from 'next/server';
import { getDeliveryAdminActor } from '@/lib/delivery/admin-auth';
import {
  getPendingClaims,
  approveShiftClaim,
  rejectShiftClaim,
  getClaimStats,
} from '@/lib/delivery/shift-booking';

export const dynamic = 'force-dynamic';

/**
 * GET /api/delivery/admin/shift-claims
 * GET /api/delivery/admin/shift-claims?action=stats
 *
 * Admin-Zugriff: offene Schicht-Anmeldungen oder Statistiken.
 */
export async function GET(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const locationId = actor.location_id;
  if (!locationId) return NextResponse.json({ error: 'No location assigned' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'list';

  if (action === 'stats') {
    const stats = await getClaimStats(locationId);
    return NextResponse.json({ stats });
  }

  const claims = await getPendingClaims(locationId);
  return NextResponse.json({ claims });
}

/**
 * PATCH /api/delivery/admin/shift-claims
 *
 * Body: { action: 'approve' | 'reject', claim_id, reason? }
 * Genehmigt oder lehnt eine Schicht-Anmeldung ab.
 * Bei 'approve' wird automatisch ein driver_shifts-Eintrag angelegt.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;

  if (!body?.action || !body?.claim_id) {
    return NextResponse.json({ error: 'action and claim_id are required' }, { status: 400 });
  }

  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const locationId = actor.location_id;
  if (!locationId) return NextResponse.json({ error: 'No location assigned' }, { status: 403 });

  const claimId = String(body.claim_id);

  if (body.action === 'approve') {
    const claim = await approveShiftClaim(claimId, locationId, actor.auth_user_id!);
    return NextResponse.json({ claim });
  }

  if (body.action === 'reject') {
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 300) : undefined;
    await rejectShiftClaim(claimId, locationId, actor.auth_user_id!, reason);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
}
