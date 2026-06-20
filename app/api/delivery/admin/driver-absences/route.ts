/**
 * GET  /api/delivery/admin/driver-absences
 *   ?action=dashboard          → AbsenceDashboard
 *   ?action=config             → AbsenceConfig
 *   ?action=pending            → AbsenceRow[]
 *   ?action=today              → AbsenceRow[]
 *   ?action=upcoming&days=N    → AbsenceRow[]
 *   ?action=coverage&from=&to= → CoverageImpact[]
 *
 * POST /api/delivery/admin/driver-absences
 *   action=approve  { id, admin_notes? }
 *   action=reject   { id, admin_notes? }
 *   action=update_config { ...AbsenceConfig-Felder }
 *   action=prune    { days_to_keep? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getDashboard,
  getConfig,
  getPendingAbsences,
  getTodaysAbsences,
  getUpcomingAbsences,
  getCoverageImpact,
  approveAbsence,
  rejectAbsence,
  upsertConfig,
  pruneOldAbsences,
} from '@/lib/delivery/driver-absences';

export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';

async function getLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb.from('employees').select('location_id').eq('id', user.id).maybeSingle();
  return (emp as Record<string, unknown> | null)?.['location_id'] as string | null;
}

async function getEmployeeId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  return user?.id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const locationId = await getLocationId(req);
    if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'dashboard';

    switch (action) {
      case 'dashboard':
        return NextResponse.json(await getDashboard(locationId));

      case 'config':
        return NextResponse.json(await getConfig(locationId));

      case 'pending':
        return NextResponse.json(await getPendingAbsences(locationId));

      case 'today':
        return NextResponse.json(await getTodaysAbsences(locationId));

      case 'upcoming': {
        const days = parseInt(searchParams.get('days') ?? '14', 10);
        return NextResponse.json(await getUpcomingAbsences(locationId, days));
      }

      case 'coverage': {
        const from = searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
        const to = searchParams.get('to') ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        return NextResponse.json(await getCoverageImpact(locationId, from, to));
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[driver-absences GET]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const locationId = await getLocationId(req);
    if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as Record<string, unknown>;
    const action = body['action'] as string;
    const employeeId = await getEmployeeId(req);
    if (!employeeId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    switch (action) {
      case 'approve': {
        const id = body['id'] as string;
        const adminNotes = body['admin_notes'] as string | undefined;
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
        await approveAbsence(id, locationId, employeeId, adminNotes);
        return NextResponse.json({ ok: true });
      }

      case 'reject': {
        const id = body['id'] as string;
        const adminNotes = body['admin_notes'] as string | undefined;
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
        await rejectAbsence(id, locationId, employeeId, adminNotes);
        return NextResponse.json({ ok: true });
      }

      case 'update_config': {
        const updated = await upsertConfig(locationId, {
          isEnabled: body['isEnabled'] as boolean | undefined,
          requiresApproval: body['requiresApproval'] as boolean | undefined,
          maxVacationDaysPerYear: body['maxVacationDaysPerYear'] as number | undefined,
          maxSickDaysPerYear: body['maxSickDaysPerYear'] as number | undefined,
          minNoticeDays: body['minNoticeDays'] as number | undefined,
          autoApproveSickDays: body['autoApproveSickDays'] as boolean | undefined,
        });
        return NextResponse.json(updated);
      }

      case 'prune': {
        const days = (body['days_to_keep'] as number | undefined) ?? 365;
        const pruned = await pruneOldAbsences(days);
        return NextResponse.json({ pruned });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[driver-absences POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
