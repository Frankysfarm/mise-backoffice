/**
 * GET  /api/delivery/driver/absences
 *   ?action=my_absences&year=YYYY  → AbsenceRow[] für eingeloggten Fahrer
 *   ?action=balance&year=YYYY      → AbsenceBalance
 *
 * POST /api/delivery/driver/absences
 *   action=submit  { absence_type, start_date, end_date, reason? }
 *   action=cancel  { id }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  submitAbsenceRequest,
  cancelAbsence,
  getDriverAbsences,
  getDriverAbsenceBalance,
  type AbsenceType,
} from '@/lib/delivery/driver-absences';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TYPES: AbsenceType[] = ['sick_day', 'vacation', 'personal_day', 'training', 'other'];

async function getDriverContext(req: NextRequest): Promise<{ driverId: string; locationId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: driver } = await sb
    .from('mise_drivers')
    .select('id,location_id')
    .eq('employee_id', user.id)
    .maybeSingle();

  if (!driver) return null;
  const d = driver as Record<string, unknown>;
  return {
    driverId: d['id'] as string,
    locationId: d['location_id'] as string,
  };
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await getDriverContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'my_absences';
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10);

    switch (action) {
      case 'my_absences':
        return NextResponse.json(await getDriverAbsences(ctx.driverId, ctx.locationId, year));

      case 'balance':
        return NextResponse.json(await getDriverAbsenceBalance(ctx.driverId, ctx.locationId, year));

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[driver absences GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getDriverContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as Record<string, unknown>;
    const action = body['action'] as string;

    switch (action) {
      case 'submit': {
        const absenceType = body['absence_type'] as AbsenceType;
        const startDate = body['start_date'] as string;
        const endDate = body['end_date'] as string;
        const reason = body['reason'] as string | undefined;

        if (!VALID_TYPES.includes(absenceType)) {
          return NextResponse.json({ error: 'Invalid absence_type' }, { status: 400 });
        }
        if (!startDate || !endDate) {
          return NextResponse.json({ error: 'start_date and end_date required' }, { status: 400 });
        }

        const result = await submitAbsenceRequest(
          ctx.driverId, ctx.locationId, absenceType, startDate, endDate, reason,
        );
        return NextResponse.json(result);
      }

      case 'cancel': {
        const id = body['id'] as string;
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
        await cancelAbsence(id, ctx.driverId);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[driver absences POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
