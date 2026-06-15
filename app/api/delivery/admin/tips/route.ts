/**
 * GET  /api/delivery/admin/tips          — Dashboard (summary + leaderboard + config)
 * POST /api/delivery/admin/tips          — action: save_config | snapshot
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getTipDashboard,
  getTipLeaderboard,
  upsertTipConfig,
  snapshotDriverTips,
} from '@/lib/delivery/tips';

export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const locFromQuery = req.nextUrl.searchParams.get('location_id');
  if (locFromQuery) return locFromQuery;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'leaderboard') {
      const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '10', 10), 50);
      const data = await getTipLeaderboard(locationId, limit);
      return NextResponse.json({ leaderboard: data });
    }

    const data = await getTipDashboard(locationId);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[tips] GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = (body.action as string) ?? '';

  try {
    if (action === 'save_config') {
      const cfg = body.config as {
        isEnabled?: boolean;
        suggestionsPct?: number[];
        customAllowed?: boolean;
        minTipEur?: number;
        maxTipEur?: number;
      };
      const updated = await upsertTipConfig(locationId, cfg);
      return NextResponse.json({ success: true, config: updated });
    }

    if (action === 'snapshot') {
      const date = body.date as string | undefined;
      const result = await snapshotDriverTips(locationId, date);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[tips] POST error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
