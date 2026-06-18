import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getHandoverDashboard,
  generateHandoverReport,
  acknowledgeHandover,
  addHandoverNote,
  pruneOldHandoverReports,
} from '@/lib/delivery/shift-handover';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qpLocation = req.nextUrl.searchParams.get('location_id');
  if (qpLocation) return qpLocation;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const sbSvc = createServiceClient();
  const { data: emp } = await sbSvc
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();

  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const dashboard = await getHandoverDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = (body.action as string) ?? 'generate';

    if (action === 'generate') {
      const periodHours = Number(body.period_hours) || 8;
      const result = await generateHandoverReport(
        locationId,
        periodHours,
        user?.id ?? 'manual',
      );
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'acknowledge') {
      const reportId = body.report_id as string;
      if (!reportId) return NextResponse.json({ error: 'report_id required' }, { status: 400 });
      if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await acknowledgeHandover(reportId, user.id);
      return NextResponse.json({ ok: true });
    }

    if (action === 'add_note') {
      const reportId = body.report_id as string;
      const notes = body.notes as string;
      if (!reportId || !notes) {
        return NextResponse.json({ error: 'report_id and notes required' }, { status: 400 });
      }
      await addHandoverNote(reportId, notes);
      return NextResponse.json({ ok: true });
    }

    if (action === 'prune') {
      const result = await pruneOldHandoverReports(90);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
