import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  computeWeeklyRanking,
  getWeeklyRankingDashboard,
  getRankingHistory,
  approveReward,
  rejectReward,
  markRewardPaid,
  upsertRewardConfig,
} from '@/lib/delivery/driver-ranking';

export const dynamic = 'force-dynamic';

async function getLocationId(req: NextRequest): Promise<{ locationId: string; employeeId: string } | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('id, location_id, rolle')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return null;
  if (!['admin', 'manager', 'dispatcher'].includes(emp.rolle)) return null;

  const paramLocationId = req.nextUrl.searchParams.get('location_id');
  return { locationId: paramLocationId ?? emp.location_id, employeeId: emp.id };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await getLocationId(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'dashboard') {
    const dashboard = await getWeeklyRankingDashboard(auth.locationId);
    return NextResponse.json(dashboard);
  }

  if (action === 'history') {
    const weeks = parseInt(req.nextUrl.searchParams.get('weeks') ?? '8', 10);
    const history = await getRankingHistory(auth.locationId, weeks);
    return NextResponse.json({ history });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await getLocationId(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = body.action as string | undefined;

  if (action === 'compute') {
    const result = await computeWeeklyRanking(auth.locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'approve_reward') {
    const rewardId = body.reward_id as string | undefined;
    if (!rewardId) return NextResponse.json({ error: 'reward_id required' }, { status: 400 });
    const ok = await approveReward(rewardId, auth.employeeId);
    return NextResponse.json({ ok });
  }

  if (action === 'reject_reward') {
    const rewardId = body.reward_id as string | undefined;
    const note = (body.note as string | undefined) ?? '';
    if (!rewardId) return NextResponse.json({ error: 'reward_id required' }, { status: 400 });
    const ok = await rejectReward(rewardId, auth.employeeId, note);
    return NextResponse.json({ ok });
  }

  if (action === 'mark_paid') {
    const rewardId = body.reward_id as string | undefined;
    if (!rewardId) return NextResponse.json({ error: 'reward_id required' }, { status: 400 });
    const ok = await markRewardPaid(rewardId);
    return NextResponse.json({ ok });
  }

  if (action === 'update_config') {
    const ok = await upsertRewardConfig(auth.locationId, {
      rank1BonusEur: body.rank1_bonus_eur as number | undefined,
      rank2BonusEur: body.rank2_bonus_eur as number | undefined,
      rank3BonusEur: body.rank3_bonus_eur as number | undefined,
      minToursRequired: body.min_tours_required as number | undefined,
      autoApprove: body.auto_approve as boolean | undefined,
      notifyDriver: body.notify_driver as boolean | undefined,
      active: body.active as boolean | undefined,
    });
    return NextResponse.json({ ok });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
