import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getChurnDashboard,
  analyzeChurnForLocation,
  runReEngagementCampaign,
  type ReEngagementOptions,
} from '@/lib/delivery/churn-prevention';

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

/** GET /api/delivery/admin/churn-prevention
 *  ?action=dashboard (default)
 */
export async function GET(req: NextRequest) {
  const locationId = await resolveAuth(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const dashboard = await getChurnDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** POST /api/delivery/admin/churn-prevention
 *  Body: { action: 'analyze' | 'campaign', dryRun?: boolean,
 *           maxCustomers?: number, creditAtRiskEur?: number, creditChurnedEur?: number }
 */
export async function POST(req: NextRequest) {
  const locationId = await resolveAuth(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = (body.action as string) ?? 'campaign';

    if (action === 'analyze') {
      const result = await analyzeChurnForLocation(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    // action === 'campaign'
    const opts: ReEngagementOptions = {
      maxCustomers:     body.maxCustomers     != null ? Number(body.maxCustomers)     : undefined,
      creditAtRiskEur:  body.creditAtRiskEur  != null ? Number(body.creditAtRiskEur)  : undefined,
      creditChurnedEur: body.creditChurnedEur != null ? Number(body.creditChurnedEur) : undefined,
      dryRun:           Boolean(body.dryRun),
    };

    const result = await runReEngagementCampaign(locationId, opts);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
