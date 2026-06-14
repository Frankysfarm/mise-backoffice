import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getDashboard,
  upsertProgram,
  getTopReferrers,
  processReferralConversions,
  expireStaleConversions,
} from '@/lib/delivery/referral-program';

export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('id', user.id)
    .maybeSingle();
  return (emp?.location_id as string | null) ?? (req.nextUrl.searchParams.get('location_id'));
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'top-referrers') {
      const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10), 100);
      const data = await getTopReferrers(locationId, limit);
      return NextResponse.json({ ok: true, data });
    }

    const dashboard = await getDashboard(locationId);
    return NextResponse.json({ ok: true, ...dashboard });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = (body.action as string) ?? '';

    if (action === 'upsert_program') {
      const program = await upsertProgram(locationId, {
        is_enabled:            body.is_enabled as boolean | undefined,
        referrer_reward_eur:   body.referrer_reward_eur as number | undefined,
        referee_reward_eur:    body.referee_reward_eur as number | undefined,
        min_order_eur:         body.min_order_eur as number | undefined,
        valid_days:            body.valid_days as number | undefined,
        max_referrals_per_user: body.max_referrals_per_user as number | undefined,
        requires_first_order:  body.requires_first_order as boolean | undefined,
      });
      return NextResponse.json({ ok: true, program });
    }

    if (action === 'process_rewards') {
      const result = await processReferralConversions(locationId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'expire_stale') {
      const expired = await expireStaleConversions();
      return NextResponse.json({ ok: true, expired });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
