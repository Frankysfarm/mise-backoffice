import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getDriverPayouts } from '@/lib/delivery/payout';

export const dynamic = 'force-dynamic';

/**
 * GET /api/delivery/driver/earnings
 *
 * Returns the authenticated driver's own payout records from driver_payout_records.
 * Auth: must be a mise_driver.
 * Response includes today's total, last 7 days total, and last 20 records.
 */
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
    return NextResponse.json({
      records: [],
      today: { deliveries: 0, totalEur: 0 },
      week: { deliveries: 0, totalEur: 0 },
    });
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const records = await getDriverPayouts(String(miseDriver.location_id), {
    driverId: String(miseDriver.id),
    since,
    limit: 100,
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const todayRecs = records.filter(r => new Date(r.completedAt) >= todayStart);
  const weekRecs  = records.filter(r => new Date(r.completedAt) >= weekStart);

  return NextResponse.json({
    records: records.slice(0, 20).map(r => ({
      id: r.id,
      totalAmount: r.totalAmount,
      baseAmount: r.baseAmount,
      kmBonus: r.kmBonus,
      peakBonus: r.peakBonus,
      ratingBonus: r.ratingBonus,
      deliveryKm: r.deliveryKm,
      wasPeakTime: r.wasPeakTime,
      completedAt: r.completedAt,
      paidOut: r.paidOut,
    })),
    today: {
      deliveries: todayRecs.length,
      totalEur: Math.round(todayRecs.reduce((s, r) => s + r.totalAmount, 0) * 100) / 100,
    },
    week: {
      deliveries: weekRecs.length,
      totalEur: Math.round(weekRecs.reduce((s, r) => s + r.totalAmount, 0) * 100) / 100,
    },
  });
}
