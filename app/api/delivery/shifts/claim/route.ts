import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  claimShift,
  cancelShiftClaim,
  getDriverClaims,
} from '@/lib/delivery/shift-booking';

export const dynamic = 'force-dynamic';

async function resolveDriver(userId: string): Promise<{ id: string } | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('mise_drivers')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return data ?? null;
}

/**
 * GET /api/delivery/shifts/claim?days_ahead=14
 *
 * Fahrer sieht eigene Schicht-Anmeldungen (alle Status, nächste N Tage).
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const driver = await resolveDriver(user.id);
  if (!driver) return NextResponse.json({ error: 'Not a driver' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const daysAhead = Math.min(30, Math.max(1, parseInt(searchParams.get('days_ahead') ?? '14', 10)));
  const claims = await getDriverClaims(driver.id, daysAhead);

  return NextResponse.json({ claims });
}

/**
 * POST /api/delivery/shifts/claim
 *
 * Body: { location_id, planned_start, planned_end, notes? }
 * Fahrer meldet sich für einen Slot an.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;

  if (!body?.location_id || !body?.planned_start || !body?.planned_end) {
    return NextResponse.json(
      { error: 'location_id, planned_start, planned_end are required' },
      { status: 400 },
    );
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const driver = await resolveDriver(user.id);
  if (!driver) return NextResponse.json({ error: 'Not a driver' }, { status: 403 });

  const start = new Date(String(body.planned_start));
  const end   = new Date(String(body.planned_end));

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid datetime format' }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json({ error: 'planned_end must be after planned_start' }, { status: 400 });
  }
  if (start <= new Date()) {
    return NextResponse.json({ error: 'planned_start must be in the future' }, { status: 400 });
  }
  if (end.getTime() - start.getTime() > 12 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Schicht darf maximal 12 Stunden dauern' }, { status: 400 });
  }

  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : undefined;

  try {
    const claim = await claimShift(
      driver.id,
      String(body.location_id),
      body.planned_start as string,
      body.planned_end as string,
      notes,
    );

    if (!claim) {
      return NextResponse.json({ error: 'Schicht-Buchung vorübergehend nicht verfügbar' }, { status: 503 });
    }

    return NextResponse.json({ claim }, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('23505')) {
      return NextResponse.json(
        { error: 'Du hast dich für diesen Zeitslot bereits angemeldet' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/delivery/shifts/claim?claim_id=...
 *
 * Fahrer zieht pendende Anmeldung zurück.
 */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const claimId = searchParams.get('claim_id');

  if (!claimId) {
    return NextResponse.json({ error: 'claim_id required' }, { status: 400 });
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const driver = await resolveDriver(user.id);
  if (!driver) return NextResponse.json({ error: 'Not a driver' }, { status: 403 });

  await cancelShiftClaim(claimId, driver.id);
  return NextResponse.json({ ok: true });
}
