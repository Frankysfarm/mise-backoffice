/**
 * GET  /api/delivery/admin/menu-analytics
 *   → getDashboard(locationId)
 *
 * POST /api/delivery/admin/menu-analytics
 *   body: { action: 'snapshot', date?: 'YYYY-MM-DD' }
 *   → snapshotMenuAnalytics(locationId, date?)
 *
 *   body: { action: 'item_trend', item_name: string, days?: number }
 *   → getItemTrend(locationId, itemName, days)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getMenuDashboard,
  snapshotMenuAnalytics,
  getItemTrend,
} from '@/lib/delivery/menu-analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: emp } = await supabase
    .from('employees')
    .select('location_id')
    .eq('auth_id', user.id)
    .single();

  if (emp?.location_id) return emp.location_id as string;

  // Superadmin: Query-Param
  const fromUrl = req.nextUrl.searchParams.get('location_id');
  return fromUrl ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const dashboard = await getMenuDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { action?: string; date?: string; item_name?: string; days?: number };
  const action = body.action ?? 'snapshot';

  try {
    if (action === 'snapshot') {
      const result = await snapshotMenuAnalytics(locationId, body.date);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'item_trend') {
      if (!body.item_name) return NextResponse.json({ error: 'item_name fehlt' }, { status: 400 });
      const trend = await getItemTrend(locationId, body.item_name, body.days ?? 14);
      return NextResponse.json({ ok: true, item_name: body.item_name, trend });
    }

    return NextResponse.json({ error: `Unbekannte Action: ${action}` }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
