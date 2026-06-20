/**
 * GET  /api/delivery/admin/incentive-v2?location_id=...
 *        → Dashboard (default) | ?action=config
 *
 * POST /api/delivery/admin/incentive-v2
 * Body: { action, location_id, ...params }
 *   action=update_config       — Konfiguration speichern
 *   action=approve_driver      — Ausstehende Punkte eines Fahrers genehmigen  { driver_id }
 *   action=mark_paid           — Genehmigte Punkte als bezahlt markieren       { driver_id }
 *   action=evaluate_now        — Sofort-Scan (letzten 5 Min)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getConfig,
  updateConfig,
  getIncentiveV2Dashboard,
  approveDriverPoints,
  markDriverPointsPaid,
  evaluateRecentDeliveries,
} from '@/lib/delivery/driver-incentive-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQs = req.nextUrl.searchParams.get('location_id');
  if (fromQs) return fromQs;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  if (action === 'config') {
    const config = await getConfig(locationId);
    return NextResponse.json({ ok: true, config });
  }

  const dashboard = await getIncentiveV2Dashboard(locationId);
  return NextResponse.json({ ok: true, ...dashboard });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const locationId = (body.location_id as string | null) ?? await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const action = (body.action as string) ?? '';

  if (action === 'update_config') {
    const config = await updateConfig(locationId, {
      enabled: body.enabled as boolean | undefined,
      basePointsPerDelivery: body.base_points_per_delivery != null ? Number(body.base_points_per_delivery) : undefined,
      peakHours: body.peak_hours as number[] | undefined,
      peakMultiplier: body.peak_multiplier != null ? Number(body.peak_multiplier) : undefined,
      loyaltyMinShifts: body.loyalty_min_shifts != null ? Number(body.loyalty_min_shifts) : undefined,
      loyaltyMultiplier: body.loyalty_multiplier != null ? Number(body.loyalty_multiplier) : undefined,
      pointsToEurRate: body.points_to_eur_rate != null ? Number(body.points_to_eur_rate) : undefined,
      minPayoutPoints: body.min_payout_points != null ? Number(body.min_payout_points) : undefined,
      autoApprove: body.auto_approve as boolean | undefined,
    });
    return NextResponse.json({ ok: true, config });
  }

  if (action === 'approve_driver') {
    if (!body.driver_id) return NextResponse.json({ error: 'driver_id fehlt' }, { status: 400 });
    const result = await approveDriverPoints(body.driver_id as string, locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'mark_paid') {
    if (!body.driver_id) return NextResponse.json({ error: 'driver_id fehlt' }, { status: 400 });
    const result = await markDriverPointsPaid(body.driver_id as string, locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  if (action === 'evaluate_now') {
    const result = await evaluateRecentDeliveries(locationId);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
