/**
 * GET /api/delivery/driver/periods
 *
 * Gibt die Abrechnungsperioden des authentifizierten Fahrers zurück.
 * Jede Periode enthält den Lohnzettel-Download-Link.
 */
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = createServiceClient();

  const { data: miseDriver } = await svc
    .from('mise_drivers')
    .select('id, location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!miseDriver?.location_id) {
    return NextResponse.json({ periods: [] });
  }

  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data: periods } = await svc
    .from('driver_payout_periods')
    .select(`
      id, period_type, period_start, period_end,
      deliveries_count, total_km, total_payout,
      avg_rating, on_time_rate_pct, status, approved_at, paid_at
    `)
    .eq('driver_id', String(miseDriver.id))
    .eq('location_id', String(miseDriver.location_id))
    .gte('period_start', since.toISOString())
    .order('period_start', { ascending: false })
    .limit(30);

  return NextResponse.json({
    periods: (periods ?? []).map((p) => ({
      id: p.id,
      periodType: p.period_type,
      periodStart: p.period_start,
      periodEnd: p.period_end,
      deliveriesCount: Number(p.deliveries_count),
      totalKm: Number(p.total_km),
      totalPayout: Number(p.total_payout),
      avgRating: p.avg_rating != null ? Number(p.avg_rating) : null,
      onTimeRatePct: p.on_time_rate_pct != null ? Number(p.on_time_rate_pct) : null,
      status: p.status,
      approvedAt: p.approved_at ?? null,
      paidAt: p.paid_at ?? null,
      pdfUrl: `/api/pdf/lohnzettel?period_id=${p.id as string}&location_id=${String(miseDriver.location_id)}`,
    })),
    locationId: String(miseDriver.location_id),
  });
}
