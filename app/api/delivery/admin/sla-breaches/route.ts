/**
 * GET+POST /api/delivery/admin/sla-breaches
 *
 * SLA Breach Detector API — Phase 256
 *
 * GET  ?action=list   → aktive SLA-Breaches + Dashboard-Zahlen
 * GET  ?action=count  → nur Anzahl aktiver Breaches (für Badge)
 * POST action=resolve → Breach manuell auflösen
 * POST action=scan    → Scan für Location manuell auslösen
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getSlaBreachDashboard,
  resolveSlaBreach,
  detectSlaBreachesForLocation,
} from '@/lib/delivery/sla-breach-detector';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveLocationId(sb: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const locationId = await resolveLocationId(sb);
    if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const action = new URL(req.url).searchParams.get('action') ?? 'list';

    if (action === 'count') {
      const dashboard = await getSlaBreachDashboard(locationId);
      return NextResponse.json({
        total:    dashboard.totalActive,
        critical: dashboard.criticalCount,
        warning:  dashboard.warningCount,
      });
    }

    // action === 'list' (default)
    const dashboard = await getSlaBreachDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = await createClient();
    const locationId = await resolveLocationId(sb);
    if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as Record<string, unknown>;
    const action = body.action as string | undefined;

    if (action === 'resolve') {
      const breachId = body.breach_id as string | undefined;
      if (!breachId) return NextResponse.json({ error: 'breach_id erforderlich' }, { status: 400 });

      const result = await resolveSlaBreach(breachId, locationId);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'scan') {
      const result = await detectSlaBreachesForLocation(locationId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
