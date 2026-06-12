/**
 * GET /api/pdf/lohnzettel?period_id=...&location_id=...
 *
 * Generiert einen individuellen Fahrer-Lohnzettel als PDF für eine
 * abgeschlossene Abrechnungsperiode.
 *
 * Auth: Manager+ (Admin) ODER Fahrer selbst (eigene Perioden).
 */
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { LohnzettelDocument, type LohnzettelData } from '@/lib/pdf/lohnzettel-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const periodId = searchParams.get('period_id');
  const locationId = searchParams.get('location_id');

  if (!periodId) return NextResponse.json({ error: 'period_id fehlt' }, { status: 400 });
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const svc = createServiceClient();

  // Perioden-Daten laden
  const { data: period, error: periodErr } = await svc
    .from('driver_payout_periods')
    .select(`
      id, driver_id, location_id, period_type, period_start, period_end,
      deliveries_count, total_km, total_base, total_km_bonus,
      total_peak_bonus, total_rating_bonus, total_milestone_bonus,
      total_payout, avg_rating, on_time_rate_pct, status,
      approved_at, paid_at,
      mise_drivers(id, name, auth_user_id)
    `)
    .eq('id', periodId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (periodErr || !period) {
    return NextResponse.json({ error: 'Periode nicht gefunden' }, { status: 404 });
  }

  // Auth-Prüfung: entweder Manager+ der zugehörigen Location oder Fahrer selbst
  const driver = Array.isArray(period.mise_drivers)
    ? (period.mise_drivers[0] as { id: string; name: string; auth_user_id: string | null } | undefined)
    : (period.mise_drivers as { id: string; name: string; auth_user_id: string | null } | null);

  const isOwnPeriod = driver?.auth_user_id === user.id;

  if (!isOwnPeriod) {
    // Prüfe ob Manager
    const { data: emp } = await sb
      .from('employees')
      .select('location_id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    const isManagerAtLocation =
      emp?.location_id === locationId &&
      ['manager', 'owner', 'admin'].includes(emp?.role ?? '');

    if (!isManagerAtLocation) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
    }
  }

  // Standortname laden
  const { data: loc } = await svc
    .from('locations')
    .select('name')
    .eq('id', locationId)
    .maybeSingle();

  const lohnzettelData: LohnzettelData = {
    driverName: (driver?.name as string) ?? 'Unbekannter Fahrer',
    driverId: period.driver_id as string,
    locationName: (loc?.name as string) ?? 'Standort',
    periodType: period.period_type as string,
    periodStart: period.period_start as string,
    periodEnd: period.period_end as string,
    deliveriesCount: Number(period.deliveries_count),
    totalKm: Number(period.total_km),
    totalBase: Number(period.total_base),
    totalKmBonus: Number(period.total_km_bonus),
    totalPeakBonus: Number(period.total_peak_bonus),
    totalRatingBonus: Number(period.total_rating_bonus),
    totalMilestoneBonus: Number(period.total_milestone_bonus),
    totalPayout: Number(period.total_payout),
    avgRating: period.avg_rating != null ? Number(period.avg_rating) : null,
    onTimeRatePct: period.on_time_rate_pct != null ? Number(period.on_time_rate_pct) : null,
    status: period.status as LohnzettelData['status'],
    approvedAt: (period.approved_at as string | null) ?? null,
    paidAt: (period.paid_at as string | null) ?? null,
    generatedAt: new Date().toISOString(),
  };

  const buffer = await renderToBuffer(
    LohnzettelDocument({ data: lohnzettelData }) as Parameters<typeof renderToBuffer>[0],
  );

  const dateStr = new Date(period.period_start as string).toISOString().slice(0, 10);
  const driverSlug = (driver?.name as string ?? 'fahrer')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  const filename = `lohnzettel-${driverSlug}-${dateStr}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
