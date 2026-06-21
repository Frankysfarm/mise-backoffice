/**
 * GET+POST /api/delivery/admin/tour-feedback-analytics
 *
 * Phase 360 — Tour Feedback Analytics API
 *
 * GET  ?action=dashboard          → FeedbackAnalyticsDashboard
 * GET  ?action=report&months=3    → MonthlyReportEntry[]
 * GET  ?action=driver_profile&driver_id=...&weeks=8 → DriverFeedbackProfileEntry[]
 *
 * POST { action: 'aggregate', period_type?: 'week'|'month' } → AggregateResult
 * POST { action: 'prune', days_old?: number }                → { pruned: number }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getTourFeedbackAnalyticsDashboard,
  getFeedbackManagementReport,
  getDriverFeedbackProfile,
  aggregateTourFeedbackForLocation,
  pruneOldFeedbackAggregates,
  type FeedbackPeriodType,
} from '@/lib/delivery/tour-feedback-analytics';

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

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') ?? 'dashboard';

    if (action === 'report') {
      const months = Math.min(Number(searchParams.get('months') ?? 3), 12);
      const trend = await getFeedbackManagementReport(locationId, months);
      return NextResponse.json({ trend });
    }

    if (action === 'driver_profile') {
      const driverId = searchParams.get('driver_id');
      if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
      const weeks = Math.min(Number(searchParams.get('weeks') ?? 8), 26);
      const profile = await getDriverFeedbackProfile(locationId, driverId, weeks);
      return NextResponse.json({ profile });
    }

    const dashboard = await getTourFeedbackAnalyticsDashboard(locationId);
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

    const body = await req.json() as { action?: string; period_type?: FeedbackPeriodType; days_old?: number };
    const action = body.action ?? '';

    if (action === 'aggregate') {
      const periodType: FeedbackPeriodType = body.period_type === 'month' ? 'month' : 'week';
      const result = await aggregateTourFeedbackForLocation(locationId, periodType);
      return NextResponse.json(result);
    }

    if (action === 'prune') {
      const pruned = await pruneOldFeedbackAggregates(body.days_old ?? 365);
      return NextResponse.json({ pruned });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
