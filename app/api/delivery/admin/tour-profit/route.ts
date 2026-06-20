import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getTourProfitDashboard,
  getTourProfitHistory,
  getDriverProfitBreakdown,
  snapshotDailyProfit,
} from '@/lib/delivery/tour-profit';

async function getLocationId(req: NextRequest): Promise<string | null> {
  const override = req.nextUrl.searchParams.get('location_id');
  if (override) return override;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();

  return (emp as { location_id: string | null } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'live';

  try {
    if (action === 'history') {
      const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get('days') ?? '30')));
      const history = await getTourProfitHistory(locationId, days);
      return NextResponse.json({ ok: true, history, days });
    }

    if (action === 'drivers') {
      const days = Math.min(90, Math.max(7, Number(req.nextUrl.searchParams.get('days') ?? '30')));
      const drivers = await getDriverProfitBreakdown(locationId, days);
      return NextResponse.json({ ok: true, drivers, days });
    }

    // default: live dashboard
    const dashboard = await getTourProfitDashboard(locationId);
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await getLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string; date?: string };
    const action = body.action ?? 'snapshot';

    if (action === 'snapshot') {
      const date = body.date ? new Date(body.date) : new Date();
      const result = await snapshotDailyProfit(locationId, date);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
