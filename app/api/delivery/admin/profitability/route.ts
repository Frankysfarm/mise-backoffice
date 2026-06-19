import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getDashboard,
  getSnapshots,
  snapshotProfitability,
} from '@/lib/delivery/profitability';

export const dynamic = 'force-dynamic';

async function resolveAuth(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const serviceSb = createServiceClient();
  const { data: emp } = await serviceSb
    .from('employees')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return (emp?.tenant_id as string) ?? null;
}

/** GET /api/delivery/admin/profitability
 *  ?action=dashboard|trend&days=30
 */
export async function GET(req: NextRequest) {
  const locationId = await resolveAuth(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'dashboard';
  const days   = Math.min(90, Math.max(1, Number(searchParams.get('days') ?? '30')));

  try {
    if (action === 'trend') {
      const trend = await getSnapshots(locationId, days);
      return NextResponse.json({ trend });
    }

    const dashboard = await getDashboard(locationId);

    if (action === 'profitability_shift') {
      const s = dashboard.summary;
      return NextResponse.json({
        umsatz:           s.revenueEur,
        kosten:           s.costEur,
        marge:            s.profitEur,
        margePct:         s.marginPct ?? 0,
        fahrerpauschale:  s.costEur,
        lieferungenAnzahl: s.totalOrders,
      });
    }

    return NextResponse.json(dashboard);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST /api/delivery/admin/profitability
 *  Body: { date?: 'YYYY-MM-DD' }  — manuellen Snapshot triggern
 */
export async function POST(req: NextRequest) {
  const locationId = await resolveAuth(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({})) as { date?: string };
    const snapshot = await snapshotProfitability(locationId, body.date);
    return NextResponse.json({ ok: true, snapshot });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
