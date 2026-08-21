/**
 * GET  /api/delivery/admin/payouts?location_id=...&view=records|periods|summary
 * POST /api/delivery/admin/payouts  — Perioden generieren oder Periode freigeben/bezahlen
 *
 * GET-Parameter:
 *   location_id  — Pflicht
 *   view         — "records" | "periods" | "summary" (default: "summary")
 *   driver_id    — Optional: Filterung nach Fahrer
 *   status       — Optional (periods): draft|approved|paid
 *   since        — Optional: ISO-Datum (default: 7 Tage)
 *   paid_out     — Optional (records): true|false
 *   limit        — Optional: max. Ergebnisse (default: 100)
 *
 * POST-Body (Aktion wählen):
 *   { action: "generate_daily", location_id, date: "YYYY-MM-DD" }
 *   { action: "generate_weekly", location_id }
 *   { action: "approve_period", period_id }
 *   { action: "bulk_approve", period_ids: string[] }
 *   { action: "mark_paid",      period_id }
 *   { action: "bulk_mark_paid", period_ids: string[] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getDriverPayouts,
  getPeriodPayouts,
  getPayoutSummary,
  generateAllPeriodsForDate,
  approvePeriod,
  markPeriodPaid,
} from '@/lib/delivery/payout';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';
import type { CurrentEmployee } from '@/lib/auth/getCurrentEmployee';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function areAuthorizedPayoutPeriods(actor: CurrentEmployee, periodIds: string[]): Promise<boolean> {
  const uniqueIds = Array.from(new Set(periodIds));
  if (uniqueIds.length === 0 || uniqueIds.length > 500) return false;

  const { data: periods } = await createServiceClient()
    .from('driver_payout_periods')
    .select('id, location_id')
    .in('id', uniqueIds);
  if (!periods || periods.length !== uniqueIds.length) return false;

  const locationIds = Array.from(new Set(periods.map((period) => period.location_id as string)));
  const ownership = await Promise.all(
    locationIds.map((locationId) => isDeliveryAdminLocation(actor, locationId)),
  );
  return ownership.every(Boolean);
}

export async function GET(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
  }

  const view = searchParams.get('view') ?? 'summary';
  const driverId = searchParams.get('driver_id') ?? undefined;
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 100;

  const sinceParam = searchParams.get('since');
  const since = sinceParam
    ? new Date(sinceParam)
    : new Date(Date.now() - 7 * 86_400_000);

  try {
    if (view === 'records') {
      const paidOutParam = searchParams.get('paid_out');
      const paidOut = paidOutParam === 'true' ? true : paidOutParam === 'false' ? false : undefined;
      const records = await getDriverPayouts(locationId, { driverId, since, paidOut, limit });
      return NextResponse.json({ records, count: records.length });
    }

    if (view === 'periods') {
      const statusParam = searchParams.get('status') as 'draft' | 'approved' | 'paid' | null;
      const periods = await getPeriodPayouts(locationId, {
        driverId,
        status: statusParam ?? undefined,
        since,
        limit,
      });
      const totalPayout = periods.reduce((s, p) => s + p.totalPayout, 0);
      return NextResponse.json({ periods, count: periods.length, total_payout_eur: Math.round(totalPayout * 100) / 100 });
    }

    // Default: summary
    const summary = await getPayoutSummary(locationId);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const action = body.action as string | undefined;

  try {
    // Tages-Perioden für alle Fahrer generieren
    if (action === 'generate_daily') {
      const locationId = body.location_id as string | undefined;
      if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
      if (!await isDeliveryAdminLocation(actor, locationId)) {
        return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
      }

      const dateStr = (body.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
      const date = new Date(dateStr + 'T00:00:00');

      const result = await generateAllPeriodsForDate(locationId, date, 'daily');
      return NextResponse.json({
        ok: true,
        date: dateStr,
        driver_count: result.driverCount,
        period_ids: result.periodIds,
        total_payout_eur: Math.round(result.totalPayout * 100) / 100,
      });
    }

    // Periode freigeben
    if (action === 'approve_period') {
      const periodId = body.period_id as string | undefined;
      if (!periodId) return NextResponse.json({ error: 'period_id fehlt' }, { status: 400 });
      if (!await areAuthorizedPayoutPeriods(actor, [periodId])) {
        return NextResponse.json({ error: 'Abrechnungsperiode nicht autorisiert' }, { status: 403 });
      }
      await approvePeriod(periodId, actor.auth_user_id ?? actor.id);
      return NextResponse.json({ ok: true, period_id: periodId, status: 'approved' });
    }

    // Periode als bezahlt markieren
    if (action === 'mark_paid') {
      const periodId = body.period_id as string | undefined;
      if (!periodId) return NextResponse.json({ error: 'period_id fehlt' }, { status: 400 });
      if (!await areAuthorizedPayoutPeriods(actor, [periodId])) {
        return NextResponse.json({ error: 'Abrechnungsperiode nicht autorisiert' }, { status: 403 });
      }
      await markPeriodPaid(periodId);
      return NextResponse.json({ ok: true, period_id: periodId, status: 'paid' });
    }

    // Wochenperioden für alle Fahrer generieren (Montag–Sonntag dieser Woche)
    if (action === 'generate_weekly') {
      const locationId = body.location_id as string | undefined;
      if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
      if (!await isDeliveryAdminLocation(actor, locationId)) {
        return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
      }

      const now = new Date();
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      const result = await generateAllPeriodsForDate(locationId, monday, 'weekly');
      return NextResponse.json({
        ok: true,
        week_start: monday.toISOString().slice(0, 10),
        driver_count: result.driverCount,
        period_ids: result.periodIds,
        total_payout_eur: Math.round(result.totalPayout * 100) / 100,
      });
    }

    // Bulk: Mehrere Perioden auf einmal freigeben
    if (action === 'bulk_approve') {
      const periodIds = body.period_ids as string[] | undefined;
      if (!Array.isArray(periodIds) || periodIds.length === 0) {
        return NextResponse.json({ error: 'period_ids muss ein nicht-leeres Array sein' }, { status: 400 });
      }
      if (!await areAuthorizedPayoutPeriods(actor, periodIds)) {
        return NextResponse.json({ error: 'Mindestens eine Abrechnungsperiode ist nicht autorisiert' }, { status: 403 });
      }
      await Promise.all(periodIds.map((id) => approvePeriod(id, actor.auth_user_id ?? actor.id)));
      return NextResponse.json({ ok: true, approved: periodIds.length, status: 'approved' });
    }

    // Bulk: Mehrere Perioden auf einmal als bezahlt markieren
    if (action === 'bulk_mark_paid') {
      const periodIds = body.period_ids as string[] | undefined;
      if (!Array.isArray(periodIds) || periodIds.length === 0) {
        return NextResponse.json({ error: 'period_ids muss ein nicht-leeres Array sein' }, { status: 400 });
      }
      if (!await areAuthorizedPayoutPeriods(actor, periodIds)) {
        return NextResponse.json({ error: 'Mindestens eine Abrechnungsperiode ist nicht autorisiert' }, { status: 403 });
      }
      await Promise.all(periodIds.map((id) => markPeriodPaid(id)));
      return NextResponse.json({ ok: true, marked_paid: periodIds.length, status: 'paid' });
    }

    return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
