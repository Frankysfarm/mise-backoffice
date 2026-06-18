/**
 * GET  /api/delivery/admin/cost-per-order              — Dashboard
 * GET  /api/delivery/admin/cost-per-order?days=7       — 7-Tage-Fenster
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCostPerOrderDashboard } from '@/lib/delivery/cost-per-order';

export const dynamic = 'force-dynamic';

async function resolveContext(req: NextRequest): Promise<{ locationId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return { locationId: qp };

  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return null;
  return { locationId: emp.location_id as string };
}

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const daysParam = Number(req.nextUrl.searchParams.get('days') ?? '30');
  const days = [7, 14, 30, 60, 90].includes(daysParam) ? daysParam : 30;

  try {
    const dashboard = await getCostPerOrderDashboard(ctx.locationId, days);
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
